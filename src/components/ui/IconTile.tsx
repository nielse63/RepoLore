import { cn } from '@/lib/cn';
import type { LucideIcon } from 'lucide-react';

const VARIANTS = {
  neutral: 'bg-border/60 text-foreground',
  core: 'bg-tile-core-bg text-tile-core-fg',
  supporting: 'bg-tile-supporting-bg text-tile-supporting-fg',
  data: 'bg-tile-data-bg text-tile-data-fg',
  alert: 'bg-tile-alert-bg text-tile-alert-fg',
  primary: 'bg-primary text-primary-foreground',
} as const;

export type IconTileVariant = keyof typeof VARIANTS;

const SIZES = {
  sm: 'h-8 w-8 [&_svg]:h-4 [&_svg]:w-4',
  md: 'h-10 w-10 [&_svg]:h-5 [&_svg]:w-5',
  lg: 'h-12 w-12 [&_svg]:h-6 [&_svg]:w-6',
} as const;

export function IconTile({
  icon: Icon,
  variant = 'neutral',
  size = 'md',
  className,
}: {
  icon: LucideIcon;
  variant?: IconTileVariant;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
    >
      <Icon strokeWidth={1.75} />
    </span>
  );
}
