import { trackEvent } from "../analytics";

describe("trackEvent", () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("sends a GA4 event when gtag is loaded", () => {
    const gtag = jest.fn();
    (globalThis as { window?: unknown }).window = { gtag };
    trackEvent("submit_repo");
    expect(gtag).toHaveBeenCalledWith("event", "submit_repo");
  });

  it("is a no-op when gtag isn't loaded", () => {
    (globalThis as { window?: unknown }).window = {};
    expect(() => trackEvent("submit_repo")).not.toThrow();
  });

  it("is a no-op outside the browser", () => {
    expect(() => trackEvent("submit_repo")).not.toThrow();
  });
});
