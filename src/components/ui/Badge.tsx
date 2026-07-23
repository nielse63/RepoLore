import { cn } from '@/lib/cn';

const VARIANTS = {
  neutral: 'border-border text-muted bg-transparent',
  primary: 'border-primary/30 text-primary bg-primary/5',
  core: 'border-transparent bg-tile-core-bg text-tile-core-fg',
  supporting:
    'border-transparent bg-tile-supporting-bg text-tile-supporting-fg',
  data: 'border-transparent bg-tile-data-bg text-tile-data-fg',
  alert: 'border-transparent bg-tile-alert-bg text-tile-alert-fg',
} as const;

export type BadgeVariant = keyof typeof VARIANTS;

export function Badge({
  variant = 'neutral',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        VARIANTS[variant],
        className
      )}
      {...props}
    />
  );
}
