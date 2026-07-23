'use client';

import { Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export function SearchInput({
  className,
  onClear,
  value,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { onClear?: () => void }) {
  return (
    <div className={cn('relative flex items-center', className)}>
      <Search
        className="pointer-events-none absolute left-3 h-4 w-4 text-muted"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-9 text-sm text-foreground placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        {...props}
      />
      {onClear && typeof value === 'string' && value.length > 0 && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute right-3 text-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
