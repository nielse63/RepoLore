import { cn } from '@/lib/cn';

export function Card({
  className,
  highlighted,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { highlighted?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-surface p-6',
        highlighted ? 'border-primary' : 'border-border',
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mb-4 flex items-start gap-3', className)} {...props} />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-base font-semibold text-foreground', className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted', className)} {...props} />;
}
