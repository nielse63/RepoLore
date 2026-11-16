"use client";

import {
  useInspector,
  type Inspector,
} from "@/components/lore-shell/LoreInspector";
import { LorePageFrame } from "@/components/lore-shell/LorePageFrame";
import type { EntityId } from "@/lore/model";
import { createContext, useContext, useState } from "react";

interface AreaMapContextValue {
  inspector: Inspector<EntityId>;
  /** Where the selected area's inspector renders, while it's open. */
  slot: HTMLElement | null;
}

const AreaMapContext = createContext<AreaMapContextValue | null>(null);

/**
 * `LorePageFrame` for a page that embeds `AreaDependencyDiagram` (GitHub
 * issue #79): owns the page's area selection and gives the frame's
 * inspector column a slot the diagram renders its `LoreInspector` into, so
 * the diagram keeps the data it already has instead of every page passing
 * areas and relationships to the frame a second time. `display: contents`
 * keeps the inspector a direct grid item of the frame.
 */
export function AreaMapFrame({ children }: { children: React.ReactNode }) {
  const inspector = useInspector<EntityId>();
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  return (
    <AreaMapContext.Provider value={{ inspector, slot }}>
      <LorePageFrame
        inspector={
          inspector.open ? <div ref={setSlot} className="contents" /> : null
        }
      >
        {children}
      </LorePageFrame>
    </AreaMapContext.Provider>
  );
}

/**
 * The enclosing `AreaMapFrame`'s selection, or a local one (with no
 * inspector slot) when the diagram renders outside of it.
 */
export function useAreaMapInspector(): AreaMapContextValue {
  const shared = useContext(AreaMapContext);
  const local = useInspector<EntityId>();
  return shared ?? { inspector: local, slot: null };
}
