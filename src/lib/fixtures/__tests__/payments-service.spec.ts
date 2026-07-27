import { SYSTEMS, getSystemDetail } from "../payments-service";

describe("getSystemDetail", () => {
  it("returns undefined for an unknown slug", () => {
    expect(getSystemDetail("does-not-exist")).toBeUndefined();
  });

  it("returns the hand-authored detail for payment-service", () => {
    const detail = getSystemDetail("payment-service");
    expect(detail).toBeDefined();
    expect(detail?.entryPoints.length).toBeGreaterThan(0);
    expect(detail?.responsibilities.length).toBeGreaterThan(0);
  });

  it("derives a generic detail for every other known system", () => {
    const others = SYSTEMS.filter((s) => s.slug !== "payment-service");
    expect(others.length).toBeGreaterThan(0);

    for (const system of others) {
      const detail = getSystemDetail(system.slug);
      expect(detail).toBeDefined();
      expect(detail?.responsibilities).toEqual([system.description]);
      expect(detail?.owns).toEqual([
        {
          path: system.ownedPaths,
          description: `Files owned by ${system.name}.`,
        },
      ]);
      expect(detail?.entryPoints).toEqual([]);
      expect(detail?.flows).toEqual([]);
    }
  });

  it("generic detail relationships exclude the system itself and cap at 3", () => {
    const detail = getSystemDetail("auth-service");
    expect(detail?.relationships.length).toBeLessThanOrEqual(3);
    expect(detail?.relationships.some((r) => r.name === "Auth Service")).toBe(
      false
    );
  });
});
