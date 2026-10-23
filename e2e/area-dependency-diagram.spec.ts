import type { Page } from "@playwright/test";
import { expect, test } from "./coverage";

/**
 * `AreaDependencyDiagram` functional coverage (ADR-0009, amended by
 * ADR-0016 to render client-side with `@xyflow/react` instead of static
 * SVG): that the diagram actually renders real area nodes/edges as a
 * react-flow canvas on every page that embeds it, that its allowed
 * interactivity (pan/zoom/`fitView`) works, and — as a regression guard for
 * ADR-0016's guardrails — that its disabled interactivity (drag,
 * "Toggle Interactivity") stays disabled. Like `systems.spec.ts`, this
 * needs `DATABASE_URL` (reading the already-persisted `completed` analysis
 * run for the pinned private fixture `nielse63/repo-lore-ts-react-app-fixture`,
 * see README "Fixtures") but not `GITHUB_TOKEN`. That fixture resolves to
 * three Major Areas in a single dependency chain — `/src` -> `/src/components`
 * -> `/src/utils` — confirmed against the real rendered HTML below; if the
 * fixture's source or re-analysis changes those areas or edges, the counts
 * below need updating to match.
 */

const repoUrl = "/lore/nielse63/repo-lore-ts-react-app-fixture";

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
    await expect(nodes.filter({ hasText: "/src/components" })).toHaveCount(1);
    await expect(nodes.filter({ hasText: "/src/utils" })).toHaveCount(1);
    // `.filter({ hasText: "/src" })` alone would also match "/src/components"
    // and "/src/utils", so this one is asserted by exact node text instead.
    await expect(
      diagram.locator(".react-flow__node", { hasText: /^\/src$/ })
    ).toHaveCount(1);

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
    const node = diagram.locator(".react-flow__node", {
      hasText: /^\/src$/,
    });

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

  test("a node's label still links to the real GitHub location", async ({
    page,
  }) => {
    await page.goto(architectureUrl);
    const diagram = page.locator("#area-dependency-diagram .react-flow");
    const link = diagram
      .locator(".react-flow__node", { hasText: /^\/src\/utils$/ })
      .getByRole("link");

    await expect(link).toHaveAttribute(
      "href",
      /github\.com\/nielse63\/repo-lore-ts-react-app-fixture\/tree\/.+\/src\/utils$/
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

  test("areas with no edges are listed under the diagram, not drawn as nodes", async ({
    page,
  }) => {
    await page.goto(`${wideRepoUrl}/architecture`);
    const unconnected = page.getByRole("list", {
      name: "Not connected to other areas",
    });
    await expect(unconnected).toBeVisible();
    const names = await unconnected.getByRole("listitem").allTextContents();
    expect(names.length).toBeGreaterThan(0);

    const nodeNames = await page
      .locator("#area-dependency-diagram .react-flow__node")
      .allTextContents();
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
 * Above `MAX_DIAGRAM_AREAS` (30) connected areas the diagram shows only the
 * 30 with the most detected relationships, instead of no diagram at all.
 * Against the seeded `nielse63/repo-lore-ts-many-areas-fixture`
 * (`fixtures/ts-many-areas`): `/src/hub` imports `/src/module-01` through
 * `/src/module-33`, and `/src/standalone` imports nothing. So 34 areas are
 * connected, the hub has the most relationships and every module ties at
 * one, and the name tie-break shows modules 01–29.
 */
test.describe("above the diagram size ceiling", () => {
  const manyAreasUrl = "/lore/nielse63/repo-lore-ts-many-areas-fixture";

  test("Architecture shows the 30 areas with the most detected relationships and says so", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${manyAreasUrl}/architecture`);
    const diagram = page.locator("#area-dependency-diagram");
    const nodes = diagram.locator(".react-flow__node");

    await expect(nodes).toHaveCount(30);
    await expect(nodes.filter({ hasText: /^\/src\/hub$/ })).toHaveCount(1);
    await expect(nodes.filter({ hasText: /^\/src\/module-29$/ })).toHaveCount(
      1
    );
    await expect(
      nodes.filter({ hasText: /^\/src\/module-3[0-3]$/ })
    ).toHaveCount(0);
    await expect(diagram.locator(".react-flow__edge")).toHaveCount(29);

    await expect(
      diagram.getByText(
        "Showing the 30 areas with the most detected relationships, of 34 connected areas."
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

  test("the Overview and the Systems rail render the truncated diagram instead of a fallback", async ({
    page,
  }) => {
    await page.goto(manyAreasUrl);
    await expect(
      page.getByRole("heading", { name: "How Areas Connect" })
    ).toBeVisible();
    await expect(page.locator(".react-flow__node")).toHaveCount(30);

    await page.goto(`${manyAreasUrl}/systems`);
    await expect(page.locator(".react-flow__node")).toHaveCount(30);
    await expect(
      page.getByText("Not enough connected systems were detected to diagram.")
    ).toHaveCount(0);
  });

  test("a System subview always shows its own area and counts neighbors", async ({
    page,
  }) => {
    await page.goto(`${manyAreasUrl}/systems/src-hub`);
    const diagram = page.locator("#area-dependency-diagram");
    const nodes = diagram.locator(".react-flow__node");

    await expect(nodes).toHaveCount(30);
    await expect(nodes.filter({ hasText: /^\/src\/hub$/ })).toHaveCount(1);
    await expect(
      diagram.getByText(
        "Showing this system and the 29 neighbors with the most detected relationships, of 33 connected neighbors."
      )
    ).toBeVisible();
  });
});
