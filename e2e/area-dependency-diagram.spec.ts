import type { Page } from "@playwright/test";
import { expect, test } from "./coverage";

/**
 * `AreaDependencyDiagram` functional coverage (ADR-0009, amended by
 * ADR-0016 to render client-side with `@xyflow/react` instead of static
 * SVG): that the diagram actually renders real area nodes/edges as a
 * react-flow canvas on every page that embeds it, that its allowed
 * interactivity (pan/zoom/`fitView`, plus issue #79's selection, focus,
 * expand and show-all) works, and — as a regression guard for ADR-0016's
 * guardrails — that its disabled interactivity (drag, "Toggle
 * Interactivity") stays disabled. Like `systems.spec.ts`, this
 * needs `DATABASE_URL` (reading the already-persisted `completed` analysis
 * run for the pinned private fixture `nielse63/repo-lore-ts-react-app-fixture`,
 * see README "Fixtures") but not `GITHUB_TOKEN`. That fixture resolves to
 * three Major Areas in a single dependency chain — `/src` -> `/src/components`
 * -> `/src/utils` — confirmed against the real rendered HTML below; if the
 * fixture's source or re-analysis changes those areas or edges, the counts
 * below need updating to match.
 */

const repoUrl = "/lore/nielse63/repo-lore-ts-react-app-fixture";

/**
 * An area's node button on the map, by its full path. Its accessible name
 * is its visible text, "{directory name} {path}".
 */
function areaNode(page: Page, path: string) {
  return page
    .locator("#area-dependency-diagram .react-flow")
    .getByRole("button", {
      name: `${path.split("/").at(-1)} ${path}`,
      exact: true,
    });
}

const inspector = (page: Page) => page.locator("#lore-inspector");

/** A CSS color expression resolved to the computed `rgb(...)` form. */
async function resolvedColor(page: Page, expression: string) {
  return page.evaluate((value) => {
    const probe = document.createElement("span");
    probe.style.color = value;
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, expression);
}

test.describe("Architecture page", () => {
  const architectureUrl = `${repoUrl}/architecture`;

  test("renders the diagram as a react-flow canvas with the real major areas and their dependency edges", async ({
    page,
  }) => {
    await page.goto(architectureUrl);

    const diagram = page.locator("#area-dependency-diagram .react-flow");
    await expect(diagram).toBeVisible();

    const nodes = diagram.locator(".react-flow__node");
    await expect(nodes).toHaveCount(3);
    for (const path of ["/src", "/src/components", "/src/utils"]) {
      await expect(areaNode(page, path)).toHaveCount(1);
    }
    // Each node shows its directory name with the mono path beneath it.
    await expect(areaNode(page, "/src/utils")).toHaveText("utils/src/utils");

    await expect(diagram.locator(".react-flow__edge")).toHaveCount(2);

    // Zoom In/Out and Fit View are ADR-0016's allowed interactivity.
    // "Toggle Interactivity" is deliberately hidden (`showInteractive={false}`)
    // since its only purpose is to re-enable the capabilities disabled below.
    await expect(
      diagram.getByRole("button", { name: "Zoom In" })
    ).toBeVisible();
    await expect(
      diagram.getByRole("button", { name: "Zoom Out" })
    ).toBeVisible();
    await expect(
      diagram.getByRole("button", { name: "Fit View" })
    ).toBeVisible();
    await expect(
      diagram.getByRole("button", { name: "Toggle Interactivity" })
    ).toHaveCount(0);
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`the zoom controls follow the page's ${colorScheme} color scheme`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(architectureUrl);
      const zoomIn = page
        .locator("#area-dependency-diagram .react-flow")
        .getByRole("button", { name: "Zoom In" });
      await expect(zoomIn).toBeVisible();

      const { background, color } = await zoomIn.evaluate((el) => {
        const style = getComputedStyle(el);
        return { background: style.backgroundColor, color: style.color };
      });
      const surface = await page.evaluate(() => {
        const probe = document.createElement("span");
        probe.style.backgroundColor = "var(--surface)";
        document.body.append(probe);
        const value = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return value;
      });
      // react-flow's own defaults were a fixed near-white in every scheme.
      expect(background).toBe(surface);
      expect(color).toBe(await resolvedColor(page, "var(--foreground)"));
    });
  }

  test("the zoom controls change the diagram's viewport", async ({ page }) => {
    await page.goto(architectureUrl);
    const diagram = page.locator("#area-dependency-diagram .react-flow");
    const viewport = diagram.locator(".react-flow__viewport");

    const before = await viewport.evaluate((el) => el.style.transform);
    await diagram.getByRole("button", { name: "Zoom In" }).click();
    await expect(async () => {
      const after = await viewport.evaluate((el) => el.style.transform);
      expect(after).not.toBe(before);
    }).toPass();
  });

  test("dragging a node does not reposition it (ADR-0016: nodesDraggable is disabled)", async ({
    page,
  }) => {
    await page.goto(architectureUrl);
    const diagram = page.locator("#area-dependency-diagram .react-flow");
    const viewport = diagram.locator(".react-flow__viewport");
    const node = areaNode(page, "/src");

    // `fitView` (ADR-0016) applies asynchronously shortly after mount — the
    // viewport briefly renders at its unfitted `translate(0,0) scale(1)`
    // default before react-flow measures the real node dimensions and
    // settles on the fitted transform. Reading `before` during that window
    // then reading `after` post-drag (the multi-step mouse move takes real
    // wall-clock time, plenty for the settle to land in between) would
    // compare a pre-fitView position against a post-fitView one and see a
    // spurious diff that has nothing to do with dragging. Waiting for the
    // transform to stop changing first ensures both reads are of the same,
    // settled diagram.
    let lastTransform: string | undefined;
    await expect(async () => {
      const transform = await viewport.evaluate((el) => el.style.transform);
      const settled = transform === lastTransform;
      lastTransform = transform;
      expect(settled).toBe(true);
    }).toPass();

    const before = await node.boundingBox();
    expect(before).not.toBeNull();

    await page.mouse.move(
      before!.x + before!.width / 2,
      before!.y + before!.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      before!.x + before!.width / 2 + 120,
      before!.y + before!.height / 2 + 100,
      { steps: 10 }
    );
    await page.mouse.up();

    const after = await node.boundingBox();
    expect(after).not.toBeNull();
    expect(after!.x).toBeCloseTo(before!.x, 0);
    expect(after!.y).toBeCloseTo(before!.y, 0);
  });

  test("selecting an area opens its inspector, with the GitHub link that used to be on the node", async ({
    page,
  }) => {
    await page.goto(architectureUrl);
    const node = areaNode(page, "/src/utils");

    // The node no longer competes with a link: it's a selectable button.
    await expect(
      page.locator("#area-dependency-diagram .react-flow").getByRole("link")
    ).toHaveCount(0);
    await expect(node).toHaveAttribute("aria-pressed", "false");
    await expect(inspector(page)).toHaveCount(0);

    await node.click();

    await expect(node).toHaveAttribute("aria-pressed", "true");
    await expect(inspector(page)).toBeVisible();
    await expect(inspector(page)).toContainText("Area evidence");
    await expect(inspector(page).getByRole("heading", { level: 2 })).toHaveText(
      "/src/utils"
    );
    await expect(
      inspector(page).getByRole("link", { name: /View on GitHub/ })
    ).toHaveAttribute(
      "href",
      /github\.com\/nielse63\/repo-lore-ts-react-app-fixture\/tree\/.+\/src\/utils$/
    );
    // `/src/components` -> `/src/utils` is the fixture's only edge into it.
    await expect(
      inspector(page).getByRole("list", { name: "Imported by" })
    ).toHaveText("/src/components");
    await expect(inspector(page)).toContainText("Imports (0)");

    // Selecting another area moves the selection and the inspector.
    await areaNode(page, "/src").click();
    await expect(node).toHaveAttribute("aria-pressed", "false");
    await expect(inspector(page).getByRole("heading", { level: 2 })).toHaveText(
      "/src"
    );
  });

  test("Focus on selected area dims everything outside the selection's one-hop neighborhood", async ({
    page,
  }) => {
    await page.goto(architectureUrl);
    const focus = page.getByRole("checkbox", {
      name: "Focus on selected area",
    });
    const edgePaths = page.locator(
      "#area-dependency-diagram .react-flow__edge-path"
    );
    const backgroundOf = (path: string) =>
      areaNode(page, path).evaluate(
        (el) => getComputedStyle(el).backgroundColor
      );
    const surface = await page.evaluate(() => {
      const probe = document.createElement("span");
      probe.style.backgroundColor = "var(--surface)";
      document.body.append(probe);
      const color = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return color;
    });

    // Nothing to focus on until an area is selected.
    await expect(focus).toBeDisabled();
    await expect(page.getByText("Select an area to focus on it")).toBeVisible();

    await areaNode(page, "/src/utils").click();
    await expect(focus).toBeEnabled();
    // Selecting alone doesn't dim anything.
    await expect.poll(() => backgroundOf("/src")).not.toBe(surface);

    await focus.check();

    // `/src/utils`'s only neighbor is `/src/components`; `/src` is two hops
    // away, so it and its edge are dimmed.
    // (Polled: the background color transitions.)
    await expect.poll(() => backgroundOf("/src")).toBe(surface);
    await expect.poll(() => backgroundOf("/src/components")).not.toBe(surface);
    await expect.poll(() => backgroundOf("/src/utils")).not.toBe(surface);
    const opacities = await edgePaths.evaluateAll((paths) =>
      paths.map((el) => getComputedStyle(el).opacity).sort()
    );
    expect(opacities).toEqual(["0.15", "1"]);
    const primary = await resolvedColor(page, "var(--primary)");
    const strokes = await edgePaths.evaluateAll((paths) =>
      paths.map((el) => getComputedStyle(el).stroke)
    );
    expect(strokes).toContain(primary);

    // Escape clears the selection, which undoes the dimming.
    await page.keyboard.press("Escape");
    await expect(areaNode(page, "/src/utils")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    await expect(inspector(page)).toHaveCount(0);
    await expect(focus).toBeDisabled();
    await expect.poll(() => backgroundOf("/src")).not.toBe(surface);
    expect(
      await edgePaths.evaluateAll((paths) =>
        paths.map((el) => getComputedStyle(el).opacity)
      )
    ).toEqual(["1", "1"]);
  });

  test("clicking the empty canvas clears the selection", async ({ page }) => {
    await page.goto(architectureUrl);
    const node = areaNode(page, "/src/utils");
    await node.click();
    await expect(inspector(page)).toBeVisible();

    const flow = page.locator("#area-dependency-diagram .react-flow");
    const box = (await flow.boundingBox())!;
    await page.mouse.click(box.x + 8, box.y + 8);

    await expect(node).toHaveAttribute("aria-pressed", "false");
    await expect(inspector(page)).toHaveCount(0);
  });

  test("the keyboard reaches, selects and clears areas", async ({ page }) => {
    await page.goto(architectureUrl);

    // Tab moves from the map's controls straight onto a node.
    await page.getByRole("button", { name: "Expand map" }).focus();
    await page.keyboard.press("Tab");
    const focused = page.locator(
      "#area-dependency-diagram .react-flow__node button:focus"
    );
    await expect(focused).toHaveCount(1);

    await areaNode(page, "/src/components").focus();
    await page.keyboard.press("Enter");
    await expect(areaNode(page, "/src/components")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(inspector(page).getByRole("heading", { level: 2 })).toHaveText(
      "/src/components"
    );

    await areaNode(page, "/src").focus();
    await page.keyboard.press("Space");
    await expect(areaNode(page, "/src")).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await page.keyboard.press("Escape");
    await expect(areaNode(page, "/src")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    await expect(inspector(page)).toHaveCount(0);
  });

  test("Expand map gives the map more room and keeps the selection", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(architectureUrl);
    const figure = page.locator("#area-dependency-diagram figure");
    const expand = page.getByRole("button", { name: "Expand map" });
    const before = (await figure.boundingBox())!.height;

    await areaNode(page, "/src/utils").click();
    await expect(expand).toHaveAttribute("aria-expanded", "false");
    await expand.click();

    const collapse = page.getByRole("button", {
      name: "Return to normal view",
    });
    await expect(collapse).toHaveAttribute("aria-expanded", "true");
    expect((await figure.boundingBox())!.height).toBeGreaterThan(before + 100);
    await expect(areaNode(page, "/src/utils")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(inspector(page)).toBeVisible();

    await collapse.click();
    await expect(
      page.getByRole("button", { name: "Expand map" })
    ).toBeVisible();
    expect((await figure.boundingBox())!.height).toBeCloseTo(before, 0);
    await expect(areaNode(page, "/src/utils")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  test("shows the legend and the selection hint, and no Show all control for a small map", async ({
    page,
  }) => {
    await page.goto(architectureUrl);
    const diagram = page.locator("#area-dependency-diagram");
    await expect(
      diagram.getByText("Arrows point to imported dependencies")
    ).toBeVisible();
    await expect(
      diagram.getByText("Select an area for its evidence")
    ).toBeVisible();
    await expect(diagram.getByRole("button", { name: /^Show / })).toHaveCount(
      0
    );
  });
});

test("the diagram also renders on the Overview page's How Areas Connect section", async ({
  page,
}) => {
  await page.goto(repoUrl);

  await expect(
    page.getByRole("heading", { name: "How Areas Connect" })
  ).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
});

test("the diagram also renders on the Systems list, scoped to the full area graph", async ({
  page,
}) => {
  await page.goto(`${repoUrl}/systems`);

  await expect(page.locator(".react-flow__node")).toHaveCount(3);
});

test("the diagram also renders on a Systems subview, scoped to just that area's neighborhood", async ({
  page,
}) => {
  await page.goto(`${repoUrl}/systems/src-utils`);

  const nodes = page.locator(".react-flow__node");
  await expect(nodes).toHaveCount(2);
  await expect(nodes.filter({ hasText: "/src/components" })).toHaveCount(1);
  await expect(nodes.filter({ hasText: "/src/utils" })).toHaveCount(1);
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
});

/**
 * GitHub issue #51 regressions, against the seeded `nielse63/RepoLore` run
 * (this repository's own tree, see `scripts/seed-e2e.ts`): its production
 * area graph is wide (20+ areas, dozens of edges) and has at least one area
 * with no production edges, so it exercises both `fitView` actually fitting
 * a large graph and unconnected areas being listed rather than drawn.
 */
test.describe("on a wide area graph", () => {
  const wideRepoUrl = "/lore/nielse63/RepoLore";

  async function waitForSettledViewport(page: Page) {
    const viewport = page.locator(
      "#area-dependency-diagram .react-flow__viewport"
    );
    let lastTransform: string | undefined;
    await expect(async () => {
      const transform = await viewport.evaluate((el) => el.style.transform);
      const settled = transform === lastTransform;
      lastTransform = transform;
      expect(settled).toBe(true);
    }).toPass();
  }

  async function clippedNodeLabels(page: Page) {
    return page
      .locator("#area-dependency-diagram .react-flow")
      .evaluate((flow) => {
        const c = flow.getBoundingClientRect();
        return [...flow.querySelectorAll(".react-flow__node")]
          .filter((n) => {
            const r = n.getBoundingClientRect();
            return (
              r.left < c.left - 0.5 ||
              r.right > c.right + 0.5 ||
              r.top < c.top - 0.5 ||
              r.bottom > c.bottom + 0.5
            );
          })
          .map((n) => n.textContent);
      });
  }

  test("every node is fully inside the canvas on load at 1440x900", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${wideRepoUrl}/architecture`);
    await expect(
      page.locator("#area-dependency-diagram .react-flow__node").first()
    ).toBeVisible();
    await waitForSettledViewport(page);

    expect(await clippedNodeLabels(page)).toEqual([]);
  });

  test("the map re-fits when the inspector opens beside it, keeping every node inside", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${wideRepoUrl}/architecture`);
    const node = page
      .locator("#area-dependency-diagram .react-flow__node button")
      .first();
    await expect(node).toBeVisible();
    await waitForSettledViewport(page);

    // At 1440px the inspector takes its own column, narrowing the canvas.
    const flow = page.locator("#area-dependency-diagram .react-flow");
    const widthBefore = (await flow.boundingBox())!.width;
    await node.click();
    await expect(inspector(page)).toBeVisible();
    await expect
      .poll(async () => (await flow.boundingBox())!.width)
      .toBeLessThan(widthBefore);
    await waitForSettledViewport(page);

    expect(await clippedNodeLabels(page)).toEqual([]);
  });

  test("every node is fully inside the Systems rail's System map on load", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${wideRepoUrl}/systems`);
    await expect(
      page.locator("#area-dependency-diagram .react-flow__node").first()
    ).toBeVisible();
    await waitForSettledViewport(page);

    expect(await clippedNodeLabels(page)).toEqual([]);
    await expect(
      page.getByRole("link", { name: "View full diagram" })
    ).toHaveAttribute(
      "href",
      `${wideRepoUrl}/architecture#area-dependency-diagram`
    );
  });

  test("shows 8 areas by default, and every connected area after Show all areas", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${wideRepoUrl}/architecture`);
    const diagram = page.locator("#area-dependency-diagram");
    const nodes = diagram.locator(".react-flow__node");

    await expect(nodes).toHaveCount(8);
    await expect(
      diagram.getByText(
        /^Showing 8 of \d+ connected areas, in Major Areas order\./
      )
    ).toBeVisible();

    await diagram.getByRole("button", { name: "Show all areas" }).click();
    await expect.poll(() => nodes.count()).toBeGreaterThan(8);
    await expect(diagram.getByText(/^Showing \d+ of/)).toHaveCount(0);
    await waitForSettledViewport(page);
    // Labels keep their size; the canvas re-fits instead.
    expect(await clippedNodeLabels(page)).toEqual([]);

    await diagram.getByRole("button", { name: "Show fewer areas" }).click();
    await expect(nodes).toHaveCount(8);
  });

  test("areas with no edges are listed under the diagram, not drawn as nodes", async ({
    page,
  }) => {
    await page.goto(`${wideRepoUrl}/architecture`);
    await page.getByRole("button", { name: "Show all areas" }).click();
    const unconnected = page.getByRole("list", {
      name: "Not connected to other areas",
    });
    await expect(unconnected).toBeVisible();
    const names = await unconnected.getByRole("listitem").allTextContents();
    expect(names.length).toBeGreaterThan(0);

    const nodeNames = await page
      .locator("#area-dependency-diagram .react-flow__node button")
      .evaluateAll((buttons) =>
        buttons.map((button) => button.getAttribute("title"))
      );
    expect(nodeNames.length).toBeGreaterThan(8);
    for (const name of names) expect(nodeNames).not.toContain(name.trim());
  });

  test("edges are drawn in the muted foreground color, not the border color", async ({
    page,
  }) => {
    await page.goto(`${wideRepoUrl}/architecture`);
    const edgePath = page
      .locator("#area-dependency-diagram .react-flow__edge-path")
      .first();
    await expect(edgePath).toBeAttached();

    const { stroke, muted } = await edgePath.evaluate((el) => {
      const probe = document.createElement("span");
      probe.style.color = "var(--muted)";
      document.body.append(probe);
      const muted = getComputedStyle(probe).color;
      probe.remove();
      return { stroke: getComputedStyle(el).stroke, muted };
    });
    expect(stroke).toBe(muted);
  });
});

test("a fully connected diagram lists no unconnected areas", async ({
  page,
}) => {
  await page.goto(`${repoUrl}/architecture`);
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await expect(
    page.getByRole("list", { name: "Not connected to other areas" })
  ).toHaveCount(0);
});

/**
 * The default subset and the `MAX_DIAGRAM_AREAS` (30) ceiling, against the
 * seeded `nielse63/repo-lore-ts-many-areas-fixture` (`fixtures/ts-many-areas`):
 * `/src/hub` imports `/src/module-01` through `/src/module-33`, and
 * `/src/standalone` imports nothing. So 34 areas are connected; in Major
 * Areas order the hub has the most relationships and every module ties at
 * one, so the name tie-break shows modules 01–07 by default and 01–29 at
 * the ceiling.
 */
test.describe("above the default subset and the size ceiling", () => {
  const manyAreasUrl = "/lore/nielse63/repo-lore-ts-many-areas-fixture";

  test("Architecture shows 8 areas in Major Areas order, then up to 30, and says so", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${manyAreasUrl}/architecture`);
    const diagram = page.locator("#area-dependency-diagram");
    const nodes = diagram.locator(".react-flow__node");

    await expect(nodes).toHaveCount(8);
    await expect(areaNode(page, "/src/hub")).toHaveCount(1);
    await expect(areaNode(page, "/src/module-07")).toHaveCount(1);
    await expect(areaNode(page, "/src/module-08")).toHaveCount(0);
    await expect(diagram.locator(".react-flow__edge")).toHaveCount(7);
    await expect(
      diagram.getByText(
        "Showing 8 of 34 connected areas, in Major Areas order."
      )
    ).toBeVisible();

    // 34 connected areas is over the ceiling, so the control says how many.
    await diagram.getByRole("button", { name: "Show 30 areas" }).click();

    await expect(nodes).toHaveCount(30);
    await expect(areaNode(page, "/src/module-29")).toHaveCount(1);
    await expect(
      nodes.filter({ hasText: /\/src\/module-3[0-3]$/ })
    ).toHaveCount(0);
    await expect(diagram.locator(".react-flow__edge")).toHaveCount(29);
    await expect(
      diagram.getByText(
        "Showing 30 of 34 connected areas, in Major Areas order."
      )
    ).toBeVisible();
    await expect(
      diagram.getByRole("link", { name: "Component Connections" })
    ).toHaveAttribute(
      "href",
      `${manyAreasUrl}/architecture#component-connections`
    );
    await expect(
      diagram.getByText("1 area has no detected production relationships.")
    ).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Not connected to other areas" })
    ).toHaveCount(0);
  });

  test("the inspector lists every import, marking those not on the map", async ({
    page,
  }) => {
    await page.goto(`${manyAreasUrl}/architecture`);
    await areaNode(page, "/src/hub").click();

    const imports = inspector(page).getByRole("list", { name: "Imports" });
    await expect(imports.getByRole("listitem")).toHaveCount(33);
    // Modules 01–07 are drawn; the other 26 are listed and marked.
    await expect(
      imports.getByRole("listitem").filter({ hasText: "not on the map" })
    ).toHaveCount(26);
    await expect(
      imports.getByRole("listitem").filter({ hasText: "/src/module-07" })
    ).not.toContainText("not on the map");
    await expect(
      imports.getByRole("listitem").filter({ hasText: "/src/module-33" })
    ).toContainText("not on the map");
  });

  test("the Overview and the Systems rail render the default subset instead of a fallback", async ({
    page,
  }) => {
    await page.goto(manyAreasUrl);
    await expect(
      page.getByRole("heading", { name: "How Areas Connect" })
    ).toBeVisible();
    await expect(page.locator(".react-flow__node")).toHaveCount(8);

    await page.goto(`${manyAreasUrl}/systems`);
    await expect(page.locator(".react-flow__node")).toHaveCount(8);
    await expect(
      page.getByText("Not enough connected systems were detected to diagram.")
    ).toHaveCount(0);
  });

  test("a System subview always shows its own area and counts neighbors", async ({
    page,
  }) => {
    await page.goto(`${manyAreasUrl}/systems/src-module-33`);
    const diagram = page.locator("#area-dependency-diagram");
    const nodes = diagram.locator(".react-flow__node");

    // module-33's only neighbor is the hub, so it's fully drawn.
    await expect(nodes).toHaveCount(2);
    await expect(areaNode(page, "/src/module-33")).toHaveCount(1);

    await page.goto(`${manyAreasUrl}/systems/src-hub`);
    await expect(nodes).toHaveCount(8);
    await expect(areaNode(page, "/src/hub")).toHaveCount(1);
    await expect(
      diagram.getByText(
        "Showing this system and 7 of its 33 connected neighbors, in Major Areas order."
      )
    ).toBeVisible();
  });

  test("a System subview's inspector lists a neighbor's relationships beyond the subview", async ({
    page,
  }) => {
    await page.goto(`${manyAreasUrl}/systems/src-module-01`);
    await areaNode(page, "/src/hub").click();
    await expect(
      inspector(page)
        .getByRole("list", { name: "Imports" })
        .getByRole("listitem")
    ).toHaveCount(33);
  });
});
