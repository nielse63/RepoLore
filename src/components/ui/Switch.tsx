'use client';

import * as RadixSwitch from '@radix-ui/react-switch';
import { cn } from '@/lib/cn';

export function Switch({
  className,
  ...props
}: React.ComponentProps<typeof RadixSwitch.Root>) {
  return (
    <RadixSwitch.Root
      className={cn(
        'relative h-6 w-10 shrink-0 rounded-full bg-border transition-colors',
        'data-[state=checked]:bg-primary',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      <RadixSwitch.Thumb className="block h-4.5 w-4.5 translate-x-1 rounded-full bg-surface shadow transition-transform data-[state=checked]:translate-x-5" />
    </RadixSwitch.Root>
  );
}
