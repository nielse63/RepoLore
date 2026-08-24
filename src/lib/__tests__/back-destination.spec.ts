import { resolveBackDestination } from "../back-destination";

const ORIGIN = "https://repolore.example";

describe("resolveBackDestination", () => {
  it("goes back for a same-origin referrer", () => {
    expect(resolveBackDestination(`${ORIGIN}/lore/acme/widgets`, ORIGIN)).toBe(
      "back"
    );
  });

  it('falls back to "home" for an empty referrer (direct link/bookmark)', () => {
    expect(resolveBackDestination("", ORIGIN)).toBe("home");
  });

  it('falls back to "home" for a cross-origin referrer', () => {
    expect(resolveBackDestination("https://example.com/", ORIGIN)).toBe("home");
  });

  it('falls back to "home" for an unparseable referrer', () => {
    expect(resolveBackDestination("not a url", ORIGIN)).toBe("home");
  });
});
