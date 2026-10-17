import {
  DEFAULT_OG_IMAGE,
  buildLoreMetadata,
  loreOverviewDescription,
  loreOverviewTitle,
  loreRouteTitle,
  siteMetadataBase,
} from "../route-metadata";
import type { Lore } from "@/lore/model";

describe("loreRouteTitle", () => {
  it("builds the Overview title with no view", () => {
    expect(loreRouteTitle("acme", "widgets")).toBe("acme/widgets — Repo Lore");
  });

  it("builds a per-view title", () => {
    expect(loreRouteTitle("acme", "widgets", "Architecture")).toBe(
      "acme/widgets Architecture — Repo Lore"
    );
  });
});

function stubLore({
  entryPoints = 2,
  areaNames = ["src", "lib", "."],
  startHere = 1,
  description,
  status = "completed",
}: {
  entryPoints?: number;
  areaNames?: string[];
  startHere?: number;
  description?: string;
  status?: Lore["snapshot"]["status"];
} = {}): Lore {
  return {
    snapshot: { status, repository: { description } },
    entryPoints: Array.from({ length: entryPoints }, () => ({})),
    structuralAreas: areaNames.map((name) => ({ name })),
    startHere: Array.from({ length: startHere }, () => ({})),
  } as unknown as Lore;
}

describe("loreOverviewTitle", () => {
  it("uses search-shaped wording once there's an analysis", () => {
    expect(loreOverviewTitle("acme", "widgets", stubLore())).toBe(
      "acme/widgets: codebase architecture & entry points — Repo Lore"
    );
  });

  it("falls back to the plain route title without one", () => {
    expect(loreOverviewTitle("acme", "widgets", null)).toBe(
      "acme/widgets — Repo Lore"
    );
  });

  it("falls back when there are no entry points or Major Areas to show", () => {
    expect(
      loreOverviewTitle("acme", "widgets", stubLore({ entryPoints: 0 }))
    ).toBe("acme/widgets — Repo Lore");
    expect(
      loreOverviewTitle("acme", "widgets", stubLore({ areaNames: ["."] }))
    ).toBe("acme/widgets — Repo Lore");
  });
});

describe("loreOverviewDescription", () => {
  it("leads with the GitHub description, then the page's own counts", () => {
    expect(
      loreOverviewDescription(
        "acme",
        "widgets",
        stubLore({ description: "Widgets for everyone." })
      )
    ).toBe(
      "Widgets for everyone. How acme/widgets is structured: 2 probable entry points, 2 major areas, and a Start Here reading path, with source links and certainty labels."
    );
  });

  it("excludes the root area, singularizes, and omits an empty Start Here", () => {
    expect(
      loreOverviewDescription(
        "acme",
        "widgets",
        stubLore({ entryPoints: 1, areaNames: ["src", "."], startHere: 0 })
      )
    ).toBe(
      "How acme/widgets is structured: 1 probable entry point and 1 major area, with source links and certainty labels."
    );
  });

  it("says so for a partial run, and 'no' rather than 0", () => {
    expect(
      loreOverviewDescription(
        "acme",
        "widgets",
        stubLore({ status: "partial", entryPoints: 0, startHere: 0 })
      )
    ).toBe(
      "Partial analysis of how acme/widgets is structured: no probable entry points and 2 major areas, with source links and certainty labels."
    );
  });

  it("truncates a long GitHub description", () => {
    const description = loreOverviewDescription(
      "acme",
      "widgets",
      stubLore({ description: "word ".repeat(40) })
    );
    expect(description).toMatch(/^(word ){17}word… How acme\/widgets/);
  });

  it("is generic without an analysis", () => {
    expect(loreOverviewDescription("acme", "widgets", null)).toBe(
      "Orientation for acme/widgets: a Start Here reading path, major structural areas, and entry points, each backed by evidence from the analyzed source."
    );
  });
});

describe("buildLoreMetadata", () => {
  const metadata = buildLoreMetadata({
    title: "acme/widgets Architecture — Repo Lore",
    description: "How the major parts of acme/widgets work together.",
    path: "/lore/acme/widgets/architecture",
  });

  it("marks repository routes noindex, follow by default", () => {
    expect(metadata.robots).toEqual({ index: false, follow: true });
  });

  it("uses the generic Open Graph/Twitter image by default", () => {
    expect(metadata.openGraph?.images).toEqual([DEFAULT_OG_IMAGE]);
    expect(metadata.twitter?.images).toEqual([DEFAULT_OG_IMAGE]);
  });

  describe("when indexable", () => {
    const indexable = buildLoreMetadata({
      title: "acme/widgets — Repo Lore",
      description: "Orientation for acme/widgets.",
      path: "/lore/acme/widgets",
      indexable: true,
    });

    it("marks the route index, follow", () => {
      expect(indexable.robots).toEqual({ index: true, follow: true });
    });

    it("leaves images unset so the route's opengraph-image file is used", () => {
      expect(indexable.openGraph).not.toHaveProperty("images");
      expect(indexable.twitter).not.toHaveProperty("images");
    });
  });

  it("sets a self-referencing canonical", () => {
    expect(metadata.alternates).toEqual({
      canonical: "/lore/acme/widgets/architecture",
    });
  });

  it("sets the Open Graph url to the same path", () => {
    expect(metadata.openGraph?.url).toBe("/lore/acme/widgets/architecture");
  });

  it("passes the title and description through to Open Graph and Twitter", () => {
    expect(metadata.openGraph?.title).toBe(
      "acme/widgets Architecture — Repo Lore"
    );
    expect(metadata.openGraph?.description).toBe(
      "How the major parts of acme/widgets work together."
    );
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: "acme/widgets Architecture — Repo Lore",
      description: "How the major parts of acme/widgets work together.",
    });
  });
});

describe("siteMetadataBase", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.RENDER_EXTERNAL_URL;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("falls back to localhost when no origin is configured", () => {
    expect(siteMetadataBase().origin).toBe("http://localhost:3000");
  });

  it("prefers NEXT_PUBLIC_SITE_URL over RENDER_EXTERNAL_URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://configured.example";
    process.env.RENDER_EXTERNAL_URL = "https://render.example";
    expect(siteMetadataBase().origin).toBe("https://configured.example");
  });

  it("falls back to RENDER_EXTERNAL_URL when set", () => {
    process.env.RENDER_EXTERNAL_URL = "https://render.example";
    expect(siteMetadataBase().origin).toBe("https://render.example");
  });

  it("adds a scheme to a scheme-less configured origin instead of throwing", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "repolore.example";
    expect(siteMetadataBase().origin).toBe("https://repolore.example");
  });

  it("falls back to localhost for an unparseable configured origin", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "not a url";
    expect(siteMetadataBase().origin).toBe("http://localhost:3000");
  });

  it("warns in production when no origin is configured, instead of silently falling back to localhost", () => {
    (process.env as { NODE_ENV: string }).NODE_ENV = "production";
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    expect(siteMetadataBase().origin).toBe("http://localhost:3000");
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/NEXT_PUBLIC_SITE_URL/)
    );
    warn.mockRestore();
  });
});
