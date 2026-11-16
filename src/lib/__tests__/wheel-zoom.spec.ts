import { wheelZoom } from "../wheel-zoom";

const base = {
  viewport: { x: 0, y: 0, zoom: 1 },
  pointer: { x: 0, y: 0 },
  deltaMode: 0,
  minZoom: 0.5,
  maxZoom: 2,
};

describe("wheelZoom", () => {
  it("zooms in when scrolling up, by d3-zoom's default pixel delta", () => {
    const next = wheelZoom({ ...base, deltaY: -100 });
    expect(next!.zoom).toBeCloseTo(2 ** 0.2);
  });

  it("zooms out when scrolling down", () => {
    const next = wheelZoom({ ...base, deltaY: 100 });
    expect(next!.zoom).toBeCloseTo(2 ** -0.2);
  });

  it("scales line and page deltas like d3-zoom", () => {
    expect(wheelZoom({ ...base, deltaY: -4, deltaMode: 1 })!.zoom).toBeCloseTo(
      2 ** 0.2
    );
    expect(
      wheelZoom({ ...base, deltaY: -0.5, deltaMode: 2 })!.zoom
    ).toBeCloseTo(2 ** 0.5);
  });

  it("keeps the point under the pointer fixed", () => {
    const viewport = { x: 30, y: -10, zoom: 0.8 };
    const pointer = { x: 200, y: 120 };
    const next = wheelZoom({ ...base, viewport, pointer, deltaY: -150 })!;
    // The canvas point under the pointer, before and after.
    const before = {
      x: (pointer.x - viewport.x) / viewport.zoom,
      y: (pointer.y - viewport.y) / viewport.zoom,
    };
    expect((pointer.x - next.x) / next.zoom).toBeCloseTo(before.x);
    expect((pointer.y - next.y) / next.zoom).toBeCloseTo(before.y);
  });

  it("clamps to the limits", () => {
    expect(wheelZoom({ ...base, deltaY: -10_000 })!.zoom).toBe(2);
    expect(wheelZoom({ ...base, deltaY: 10_000 })!.zoom).toBe(0.5);
  });

  it("returns null at the zoom-out limit when scrolling down, so the page scrolls", () => {
    expect(
      wheelZoom({ ...base, viewport: { x: 0, y: 0, zoom: 0.5 }, deltaY: 100 })
    ).toBeNull();
    // Within rounding of the limit counts as at it.
    expect(
      wheelZoom({
        ...base,
        viewport: { x: 0, y: 0, zoom: 0.5004 },
        deltaY: 100,
      })
    ).toBeNull();
  });

  it("still zooms in from the zoom-out limit", () => {
    const next = wheelZoom({
      ...base,
      viewport: { x: 0, y: 0, zoom: 0.5 },
      deltaY: -100,
    });
    expect(next!.zoom).toBeGreaterThan(0.5);
  });

  it("returns null at the zoom-in limit when scrolling up", () => {
    expect(
      wheelZoom({ ...base, viewport: { x: 0, y: 0, zoom: 2 }, deltaY: -100 })
    ).toBeNull();
  });

  it("returns null when the limits leave no room to zoom", () => {
    const pinned = { ...base, minZoom: 2, viewport: { x: 0, y: 0, zoom: 2 } };
    expect(wheelZoom({ ...pinned, deltaY: -100 })).toBeNull();
    expect(wheelZoom({ ...pinned, deltaY: 100 })).toBeNull();
  });

  it("returns null for a horizontal-only scroll", () => {
    expect(wheelZoom({ ...base, deltaY: 0 })).toBeNull();
  });
});
