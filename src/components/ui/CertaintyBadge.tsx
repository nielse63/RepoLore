import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import type { CertaintyCategory } from "@/lore/model";

export const VARIANT_BY_CERTAINTY: Record<CertaintyCategory, BadgeVariant> = {
  detected: "core",
  inferred: "supporting",
  unknown: "neutral",
  unsupported: "alert",
};

export function CertaintyBadge({
  certainty,
}: {
  certainty: CertaintyCategory;
}) {
  return (
    <Badge variant={VARIANT_BY_CERTAINTY[certainty]}>
      {certainty.charAt(0).toUpperCase() + certainty.slice(1)}
    </Badge>
  );
}
