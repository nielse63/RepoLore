import { expect, test } from "./coverage";

/**
 * The Lore header's Analysis and Share dialogs (issue #84), available on
 * every Lore page. Reads the already-persisted `completed` run for
 * `nielse63/RepoLore` (this repository's own tree, persisted by
 * `npm run seed:e2e`), which records gaps; needs `DATABASE_URL`, not
 * `GITHUB_TOKEN`.
 */

const repoUrl = "/lore/nielse63/RepoLore";

test.describe("Analysis dialog", () => {
  test("opens from the header on a non-Overview page with the snapshot, sources, every certainty category, gaps, and Re-analyze", async ({
    page,
  }) => {
    await page.goto(`${repoUrl}/architecture`);
    await page.getByRole("button", { name: "Analysis", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: "Analysis details" });
    await expect(dialog).toBeVisible();

    // Snapshot: the same commit the status line names.
    const sha = await page.locator("#status-line code").getAttribute("title");
    const snapshot = dialog.getByRole("region", { name: "Snapshot" });
    await expect(snapshot).toContainText("Completed");
    // The default branch at analysis time, as the status line shows it.
    const branch = (await page.locator("#status-line").innerText()).match(
      /·\s*(\S+)/
    )![1];
    await expect(snapshot).toContainText(`Branch${branch}`);
    await expect(
      snapshot.getByRole("link", { name: new RegExp(sha!.slice(0, 7)) })
    ).toHaveAttribute(
      "href",
      `https://github.com/nielse63/RepoLore/commit/${sha}`
    );
    await expect(snapshot).toContainText(/js-ts-v\d+/);
    // The exact time is pinned to UTC, so server and browser agree on it.
    await expect(snapshot.locator("time")).toHaveAttribute(
      "title",
      /^[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2} [AP]M UTC$/
    );

    const sources = dialog.getByRole("region", { name: "Evidence sources" });
    await expect(sources).toContainText("typescript");
    await expect(sources).toContainText("react");
    await expect(sources).toContainText("package.json");

    // Every category is explained without relying on hover.
    const legend = dialog.getByRole("region", {
      name: "How to read the findings",
    });
    for (const category of ["Detected", "Inferred", "Unknown", "Unsupported"]) {
      await expect(legend.getByText(category, { exact: true })).toBeVisible();
    }

    const gaps = dialog.getByRole("region", { name: "Gaps and limitations" });
    await expect(gaps).toContainText(/recorded \d+ gaps? or limitations?/);
    await expect(
      gaps.getByRole("list", { name: "Recorded gaps" }).getByRole("listitem")
    ).not.toHaveCount(0);

    await expect(
      dialog.getByRole("button", { name: "Re-analyze" })
    ).toBeVisible();
  });

  test("opens from the status line and Escape returns focus to it", async ({
    page,
  }) => {
    await page.goto(repoUrl);
    const trigger = page.getByRole("button", { name: "Analysis details" });
    await trigger.click();
    await expect(
      page.getByRole("dialog", { name: "Analysis details" })
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Analysis details" })
    ).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("the Overview no longer has an always-open analysis rail", async ({
    page,
  }) => {
    await page.goto(repoUrl);
    await expect(page.getByText("Analyzer version")).toBeHidden();
    await expect(page.locator("#lore-inspector")).toHaveCount(0);
  });
});

test.describe("Share dialog", () => {
  test("offers the stable Lore URL and every badge format, and copies them", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(`${repoUrl}/dependencies`);
    await page.getByRole("button", { name: "Share", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: "Share this Lore" });
    await expect(dialog).toBeVisible();

    const loreUrl = dialog.getByRole("textbox", {
      name: "Lore URL",
      exact: true,
    });
    await expect(loreUrl).toHaveValue(
      new RegExp(String.raw`^https?://\S+${repoUrl}$`)
    );
    const lore = await loreUrl.inputValue();
    const image = lore.replace(repoUrl, "/badge.svg");

    await expect(
      dialog.getByRole("textbox", { name: "Markdown", exact: true })
    ).toHaveValue(`[![Repo Lore](${image})](${lore})`);
    await expect(
      dialog.getByRole("textbox", { name: "HTML", exact: true })
    ).toHaveValue(`<a href="${lore}"><img src="${image}" alt="Repo Lore"></a>`);
    await expect(
      dialog.getByRole("textbox", { name: "reStructuredText", exact: true })
    ).toHaveValue(
      `.. image:: ${image}\n   :target: ${lore}\n   :alt: Repo Lore`
    );
    await expect(
      dialog.getByRole("textbox", { name: "AsciiDoc", exact: true })
    ).toHaveValue(`image:${image}[Repo Lore,link=${lore}]`);
    await expect(
      dialog.getByRole("textbox", { name: "Badge image URL", exact: true })
    ).toHaveValue(image);

    for (const [button, field] of [
      ["Copy Lore URL", "Lore URL"],
      ["Copy Markdown", "Markdown"],
      ["Copy reStructuredText", "reStructuredText"],
    ]) {
      const copy = dialog.getByRole("button", { name: button });
      await copy.click();
      await expect(copy).toHaveText("Copied");
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
        await dialog
          .getByRole("textbox", { name: field, exact: true })
          .inputValue()
      );
    }
  });

  test("falls back to selecting the text for a manual copy when the clipboard is unavailable", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: () => Promise.reject(new Error("denied")),
        },
      });
    });
    await page.goto(repoUrl);
    await page.getByRole("button", { name: "Share", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Share this Lore" });

    await dialog.getByRole("button", { name: "Copy Markdown" }).click();

    const field = dialog.getByRole("textbox", {
      name: "Markdown",
      exact: true,
    });
    await expect(field).toBeFocused();
    const value = await field.inputValue();
    expect(
      await field.evaluate((el: HTMLTextAreaElement | HTMLInputElement) =>
        el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0)
      )
    ).toBe(value);
    await expect(
      dialog.getByRole("status").filter({ hasText: /Ctrl\+C/ })
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Copy Markdown" })
    ).toHaveText("Copy");
  });

  test("closes with Escape and returns focus to the Share button", async ({
    page,
  }) => {
    await page.goto(`${repoUrl}/architecture`);
    const share = page.getByRole("button", { name: "Share", exact: true });
    await share.click();
    await expect(
      page.getByRole("dialog", { name: "Share this Lore" })
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Share this Lore" })
    ).toBeHidden();
    await expect(share).toBeFocused();
  });
});
