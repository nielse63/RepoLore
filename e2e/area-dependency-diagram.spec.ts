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
    const node = diagram.locator(".react-flow__node", {
      hasText: /^\/src$/,
    });

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
