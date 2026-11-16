"use client";

import { wheelZoom, type Viewport } from "@/lib/wheel-zoom";
import {
  areaDiagramBounds,
  type AreaDiagramLayout,
} from "@/lore/area-diagram-layout";
import { getViewportForBounds } from "@xyflow/react";
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

// react-flow's own defaults: how far `fitView` pads the nodes, and how far
// Zoom In goes.
const FIT_VIEW_PADDING = 0.1;
export const MAX_ZOOM = 2;

/** The parts of a react-flow instance the zoom handling uses. */
export interface ZoomableFlow {
  fitView: () => unknown;
  getViewport: () => Viewport;
  setViewport: (viewport: Viewport) => unknown;
}

/**
 * Zoom handling for `AreaDependencyDiagram`'s canvas (GitHub issue #79).
 * Returns the fitted zoom, the zoom at which every drawn node is in view,
 * which the caller makes react-flow's `minZoom`, so the wheel, Zoom Out and
 * pinch all stop there rather than shrinking the map to a speck. It also:
 *
 * - re-fits when the canvas changes size after mount ("Expand map", or the
 *   inspector opening beside it), since react-flow only fits on mount;
 * - zooms on the mouse wheel only while it can still zoom in that
 *   direction (`wheelZoom`). At a limit the event is left alone, so the
 *   page scrolls: scrolling down past the map isn't "caught" on it.
 *   react-flow's own wheel zoom always swallowed the event, so the caller
 *   turns it off (`preventScrolling={false}`), leaving it trackpad pinch.
 *
 * `undefined` until the canvas is measured.
 */
export function useAreaMapZoom(
  figureRef: RefObject<HTMLElement | null>,
  flowRef: RefObject<ZoomableFlow | null>,
  layout: Pick<AreaDiagramLayout, "nodes"> | null
): number | undefined {
  const [canvasSize, setCanvasSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Measured before paint, then kept current.
  useLayoutEffect(() => {
    const figure = figureRef.current;
    if (!figure) return;
    const measure = () =>
      setCanvasSize((previous) => {
        const { clientWidth: width, clientHeight: height } = figure;
        return previous?.width === width && previous.height === height
          ? previous
          : { width, height };
      });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(figure);
    return () => observer.disconnect();
  }, [figureRef]);

  // A frame after a resize, so react-flow has the new zoom-out limit.
  const initialSize = useRef(true);
  useEffect(() => {
    if (initialSize.current) {
      initialSize.current = false;
      return;
    }
    const frame = requestAnimationFrame(() => flowRef.current?.fitView());
    return () => cancelAnimationFrame(frame);
  }, [canvasSize, flowRef]);

  const fitZoom =
    layout && canvasSize
      ? getViewportForBounds(
          areaDiagramBounds(layout),
          canvasSize.width,
          canvasSize.height,
          0,
          MAX_ZOOM,
          FIT_VIEW_PADDING
        ).zoom
      : undefined;

  const onWheel = useEffectEvent((event: WheelEvent) => {
    const flow = flowRef.current;
    const pane = figureRef.current?.querySelector(".react-flow");
    // A pinch arrives as a Ctrl-modified wheel; react-flow handles that.
    if (!flow || fitZoom === undefined || !pane || event.ctrlKey) return;
    const rect = pane.getBoundingClientRect();
    const next = wheelZoom({
      viewport: flow.getViewport(),
      pointer: { x: event.clientX - rect.left, y: event.clientY - rect.top },
      deltaY: event.deltaY,
      deltaMode: event.deltaMode,
      minZoom: fitZoom,
      maxZoom: MAX_ZOOM,
    });
    if (!next) return;
    event.preventDefault();
    flow.setViewport(next);
  });
  useEffect(() => {
    const figure = figureRef.current;
    if (!figure) return;
    const listener = (event: WheelEvent) => onWheel(event);
    figure.addEventListener("wheel", listener, { passive: false });
    return () => figure.removeEventListener("wheel", listener);
  }, [figureRef]);

  return fitZoom;
}
