"use client";

import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/Drawer";
import {
  initialInspectorState,
  inspectorReducer,
  nextInspectorOpener,
} from "@/lib/inspector-state";
import { useMediaQuery } from "@/lib/use-media-query";
import { X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useReducer,
  useRef,
  type RefObject,
} from "react";

/** At or below this width the inspector is a modal bottom sheet. */
const SHEET_QUERY = "(max-width: 660px)";

export interface Inspector<Id> {
  selectedId: Id | undefined;
  open: boolean;
  /** Selects `id` and opens the inspector; focus returns to `trigger` on close. */
  select: (id: Id, trigger?: HTMLElement | null) => void;
  close: () => void;
  openerRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLElement | null>;
}

/**
 * A page's selection plus its contextual inspector (issue #84). The
 * inspector starts closed, even with an initial selection, and only an
 * explicit selection opens it (see `inspector-state.ts`).
 */
export function useInspector<Id>(initialSelectedId?: Id): Inspector<Id> {
  const [state, dispatch] = useReducer(
    inspectorReducer<Id>,
    initialSelectedId,
    initialInspectorState<Id>
  );
  const openerRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  const select = useCallback((id: Id, trigger?: HTMLElement | null) => {
    const focused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    openerRef.current = nextInspectorOpener(
      openerRef.current,
      trigger ?? focused,
      panelRef.current
    );
    dispatch({ type: "select", id });
  }, []);
  const close = useCallback(() => dispatch({ type: "close" }), []);

  // Stable while nothing changes, so it can be passed through context.
  return useMemo(
    () => ({ ...state, select, close, openerRef, panelRef }),
    [state, select, close]
  );
}

function restoreFocus(openerRef: RefObject<HTMLElement | null>) {
  const opener = openerRef.current;
  openerRef.current = null;
  if (opener?.isConnected) opener.focus();
}

/**
 * The contextual inspector for a selected area, package, function, or
 * change. Render it only while `inspector.open`, as `LorePageFrame`'s
 * `inspector`: on wide screens the frame gives it its own column, at
 * intermediate widths it follows the main content, and at 660px and below
 * it's a bottom sheet (`role="dialog"`). Close and Escape return focus to
 * the control that opened it.
 */
export function LoreInspector<Id>({
  inspector,
  kind,
  title,
  children,
}: {
  inspector: Inspector<Id>;
  /** What's selected, e.g. "Dependency evidence". */
  kind: string;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  const sheet = useMediaQuery(SHEET_QUERY);
  const { close, openerRef, panelRef } = inspector;
  const headingId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const closeAndRestore = useCallback(() => {
    close();
    restoreFocus(openerRef);
  }, [close, openerRef]);
  const onEscape = useEffectEvent(closeAndRestore);

  // The side/inline panel isn't modal, so it handles Escape itself; the
  // sheet's Radix dialog does that, and keeps focus while it's open.
  useEffect(() => {
    if (sheet) return;
    closeButtonRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[role="dialog"]')) return;
      onEscape();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sheet]);

  const header = (Title: React.ElementType) => (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-2xs font-medium uppercase tracking-widest text-muted">
          {kind}
        </p>
        <Title
          id={headingId}
          className="mt-1.5 font-serif text-2xl text-foreground [overflow-wrap:anywhere]"
        >
          {title}
        </Title>
      </div>
      <button
        ref={closeButtonRef}
        type="button"
        // The sheet restores focus in `onCloseAutoFocus`, once its focus
        // trap has unmounted.
        onClick={sheet ? close : closeAndRestore}
        aria-label="Close inspector"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border text-muted hover:bg-wash hover:text-foreground"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );

  if (sheet) {
    return (
      <Drawer open onOpenChange={(open) => !open && close()}>
        <DrawerContent
          side="bottom"
          id="lore-inspector"
          ref={panelRef as RefObject<HTMLDivElement | null>}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            closeButtonRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreFocus(openerRef);
          }}
          className="px-5 pb-6 pt-3"
        >
          <div
            aria-hidden="true"
            className="mx-auto mb-4 h-1 w-9 shrink-0 rounded-full bg-border"
          />
          {header(DrawerTitle)}
          {/* `relative` keeps absolutely-positioned descendants (e.g.
              `SourceLink`'s `sr-only` text) clipped by this scroller. */}
          <div className="relative mt-4 min-h-0 flex-1 overflow-y-auto">
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <aside
      id="lore-inspector"
      ref={panelRef}
      aria-labelledby={headingId}
      className="mx-4 mb-8 rounded-lg border border-border bg-surface sm:mx-6 lg:mx-8 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:m-0 xl:rounded-none xl:border-y-0 xl:border-r-0"
    >
      {/* Sticky and height-capped on wide screens, so a long inspector
          scrolls within itself instead of stretching the page. */}
      <div className="relative px-6 py-5 xl:sticky xl:top-0 xl:max-h-dvh xl:overflow-y-auto">
        {header("h2")}
        <div className="mt-4">{children}</div>
      </div>
    </aside>
  );
}
