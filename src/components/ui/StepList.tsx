import { cn } from '@/lib/cn';

export interface Step {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  active?: boolean;
}

/** Numbered, vertically-connected step sequence (Start Here, Data flow journey, Architecture boundaries). */
export function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex flex-col">
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        return (
          <li key={step.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium',
                  step.active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-surface text-muted'
                )}
              >
                {i + 1}
              </span>
              {!isLast && (
                <span className="w-px flex-1 bg-border" aria-hidden="true" />
              )}
            </div>
            <div className={cn('flex-1', !isLast && 'pb-6')}>
              <div className="flex items-start justify-between gap-4">
                <h4 className="text-sm font-semibold text-foreground">
                  {step.title}
                </h4>
                {step.meta}
              </div>
              {step.description && (
                <div className="mt-1 text-sm text-muted">
                  {step.description}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
