'use client';

import { useState } from 'react';
import { PanelRightOpen, X } from 'lucide-react';

export function RightRailShell({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <div className="hidden shrink-0 border-l border-border px-2 py-6 lg:block">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-muted hover:bg-border/20 hover:text-foreground"
          aria-label={`Show ${title} panel`}
        >
          <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <aside className="hidden w-[360px] shrink-0 flex-col border-l border-border bg-surface lg:flex">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={`Close ${title} panel`}
          className="rounded p-1 text-muted hover:bg-border/20 hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
    </aside>
  );
}
