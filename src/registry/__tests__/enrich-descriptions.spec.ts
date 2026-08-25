import type { ExternalDependency } from "@/lore/model";
import { enrichExternalDependencyDescriptions } from "../enrich-descriptions";

function dependency(
  overrides: Partial<ExternalDependency> = {}
): ExternalDependency {
  return {
    id: "js-ts-external-dep-1",
    projectId: "js-ts",
    name: "axios",
    scope: "direct",
    registry: "npm",
    evidence: [
      {
        kind: "package-json-dependency-field",
        certainty: "detected",
        location: { filePath: "package.json", configKey: "dependencies.axios" },
        description: "",
      },
    ],
    gaps: [],
    ...overrides,
  };
}

describe("enrichExternalDependencyDescriptions", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("sets description and descriptionSource on a successful npm lookup", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ description: "Promise based HTTP client" }),
    }) as unknown as typeof fetch;

    const dep = dependency();
    await enrichExternalDependencyDescriptions([dep]);

    expect(dep.description).toBe("Promise based HTTP client");
    expect(dep.descriptionSource).toBe("npm");
    expect(dep.gaps).toEqual([]);
  });

  it("uses the PyPI registry for a pypi-scoped dependency", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ info: { summary: "HTTP for humans" } }),
    }) as unknown as typeof fetch;

    const dep = dependency({ registry: "pypi", name: "requests" });
    await enrichExternalDependencyDescriptions([dep]);

    expect(dep.description).toBe("HTTP for humans");
    expect(dep.descriptionSource).toBe("pypi");
  });

  it("sets keywords from a successful npm lookup", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        description: "Fast, unopinionated charting library",
        keywords: ["chart", "graph", "visualization"],
      }),
    }) as unknown as typeof fetch;

    const dep = dependency({ name: "chart.js" });
    await enrichExternalDependencyDescriptions([dep]);

    expect(dep.keywords).toEqual(["chart", "graph", "visualization"]);
  });

  it("splits PyPI's free-form keywords string into a list", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        info: { summary: "Plotting library", keywords: "plot, chart graphing" },
      }),
    }) as unknown as typeof fetch;

    const dep = dependency({ registry: "pypi", name: "matplotlib" });
    await enrichExternalDependencyDescriptions([dep]);

    expect(dep.keywords).toEqual(["plot", "chart", "graphing"]);
  });

  it("adds an honest gap, not a thrown error, when the lookup fails", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({
        ok: false,
        json: async () => ({}),
      }) as unknown as typeof fetch;

    const dep = dependency();
    await enrichExternalDependencyDescriptions([dep]);

    expect(dep.description).toBeUndefined();
    expect(dep.gaps).toHaveLength(1);
    expect(dep.gaps[0].certainty).toBe("unknown");
  });

  it("adds an honest gap when the network call itself throws", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const dep = dependency();
    await enrichExternalDependencyDescriptions([dep]);

    expect(dep.description).toBeUndefined();
    expect(dep.gaps).toHaveLength(1);
  });

  it("caps the number of dependencies enriched, gapping the rest as skipped", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ description: "d" }),
    }) as unknown as typeof fetch;

    const deps = Array.from({ length: 101 }, (_, i) =>
      dependency({ id: `dep-${i}`, name: `pkg-${i}` })
    );
    await enrichExternalDependencyDescriptions(deps);

    const enriched = deps.filter((d) => d.description === "d");
    const skipped = deps.filter((d) => d.gaps.length > 0);
    expect(enriched).toHaveLength(100);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].gaps[0].description).toContain("skipped");
  });
});
