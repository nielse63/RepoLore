import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/** Re-analyze action for preview/fixture pages — visually present but inert, since there's no real analysis behind these views yet. */
export function PreviewActions() {
  return (
    <Button
      type="button"
      variant="secondary"
      disabled
      title="Not available in preview"
    >
      <RotateCw className="h-4 w-4" aria-hidden="true" />
      Re-analyze
    </Button>
  );
}
