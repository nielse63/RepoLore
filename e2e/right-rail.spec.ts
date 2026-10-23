import { expect, test } from "./coverage";

/**
 * The desktop right rail scrolls its own content: a long rail (Data Flow's
 * top-ranked function has many evidence `SourceLink`s, each with an
 * absolutely-positioned `sr-only` suffix) must not stretch the document
 * past the page content. Before the rail's scroller was made the containing
 * block for those descendants, `nielse63/RepoLore`'s Data Flow page was
 * ~3000px tall at an 800px viewport, almost all of it blank.
 */

const repoUrl = "/lore/nielse63/RepoLore";

test.use({ viewport: { width: 1440, height: 800 } });

for (const path of ["data-flow", "dependencies"]) {
  test(`the ${path} page's right rail doesn't extend the page past its content`, async ({
    page,
  }) => {
    await page.goto(`${repoUrl}/${path}`);
    const rail = page.locator("#right-rail");
    await expect(rail).toBeVisible();

    const { documentHeight, bodyHeight } = await page.evaluate(() => ({
      documentHeight: document.documentElement.scrollHeight,
      bodyHeight: Math.ceil(document.body.getBoundingClientRect().height),
    }));
    expect(documentHeight).toBeLessThanOrEqual(bodyHeight);
  });
}

test("the Data Flow rail is long enough to scroll within itself", async ({
  page,
}) => {
  await page.goto(`${repoUrl}/data-flow`);
  const scroller = page.locator("#right-rail > div").last();
  const { scrollHeight, clientHeight } = await scroller.evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
  expect(scrollHeight).toBeGreaterThan(clientHeight * 2);
});
