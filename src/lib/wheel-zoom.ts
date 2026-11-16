export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/** Below this change in zoom, a wheel step counts as already at a limit. */
const ZOOM_EPSILON = 1e-3;

/**
 * The viewport after one mouse-wheel step over a pan/zoom canvas (GitHub
 * issue #79), zooming about `pointer` (canvas-relative pixels) the way
 * d3-zoom does: scrolling up zooms in, scrolling down zooms out, by
 * d3-zoom's default wheel delta. Returns `null` when the zoom is already at
 * `minZoom` or `maxZoom` in that direction, or the step has no vertical
 * component: the caller then leaves the event alone, so the page scrolls
 * instead of the cursor getting "caught" on the canvas.
 */
export function wheelZoom({
  viewport,
  pointer,
  deltaY,
  deltaMode,
  minZoom,
  maxZoom,
}: {
  viewport: Viewport;
  pointer: { x: number; y: number };
  deltaY: number;
  /** `WheelEvent.deltaMode`: 0 pixels, 1 lines, 2 pages. */
  deltaMode: number;
  minZoom: number;
  maxZoom: number;
}): Viewport | null {
  const scale = deltaMode === 1 ? 0.05 : deltaMode ? 1 : 0.002;
  const zoom = Math.min(
    maxZoom,
    Math.max(minZoom, viewport.zoom * 2 ** (-deltaY * scale))
  );
  if (Math.abs(zoom - viewport.zoom) < ZOOM_EPSILON) return null;
  const ratio = zoom / viewport.zoom;
  return {
    x: pointer.x - (pointer.x - viewport.x) * ratio,
    y: pointer.y - (pointer.y - viewport.y) * ratio,
    zoom,
  };
}
