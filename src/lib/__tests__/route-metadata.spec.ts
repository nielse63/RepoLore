import {
  buildLoreMetadata,
  loreRouteTitle,
  siteMetadataBase,
} from "../route-metadata";

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

describe("buildLoreMetadata", () => {
  const metadata = buildLoreMetadata({
    title: "acme/widgets Architecture — Repo Lore",
    description: "How the major parts of acme/widgets work together.",
    path: "/lore/acme/widgets/architecture",
  });

  it("marks repository routes noindex, follow", () => {
    expect(metadata.robots).toEqual({ index: false, follow: true });
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
