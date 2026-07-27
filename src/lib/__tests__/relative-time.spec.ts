import { relativeTime } from "../relative-time";

describe("relativeTime", () => {
  const now = new Date("2026-07-27T12:00:00.000Z");

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function isoSecondsAgo(seconds: number): string {
    return new Date(now.getTime() - seconds * 1000).toISOString();
  }

  it('returns "just now" for timestamps less than a minute ago', () => {
    expect(relativeTime(isoSecondsAgo(30))).toBe("just now");
  });

  it("formats minutes ago", () => {
    expect(relativeTime(isoSecondsAgo(60 * 5))).toBe("5 minutes ago");
  });

  it("formats hours ago", () => {
    expect(relativeTime(isoSecondsAgo(60 * 60 * 3))).toBe("3 hours ago");
  });

  it("formats days ago", () => {
    expect(relativeTime(isoSecondsAgo(60 * 60 * 24 * 2))).toBe("2 days ago");
  });

  it("formats months ago", () => {
    expect(relativeTime(isoSecondsAgo(60 * 60 * 24 * 30 * 2))).toBe(
      "2 months ago"
    );
  });

  it("formats years ago", () => {
    expect(relativeTime(isoSecondsAgo(60 * 60 * 24 * 365 * 2))).toBe(
      "2 years ago"
    );
  });
});
