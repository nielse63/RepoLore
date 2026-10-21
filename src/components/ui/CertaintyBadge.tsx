import { Badge } from "@/components/ui/Badge";
import { VARIANT_BY_CERTAINTY } from "@/components/ui/certainty-variant";
import type { CertaintyCategory } from "@/lore/model";

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
