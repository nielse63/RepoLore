import type { BadgeVariant } from "@/components/ui/Badge";
import type { CertaintyCategory } from "@/lore/model";

export const VARIANT_BY_CERTAINTY: Record<CertaintyCategory, BadgeVariant> = {
  detected: "core",
  inferred: "supporting",
  unknown: "neutral",
  unsupported: "alert",
};
