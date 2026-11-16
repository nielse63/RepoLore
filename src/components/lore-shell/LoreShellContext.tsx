"use client";

import {
  AnalysisDialog,
  type ShellAnalysis,
} from "@/components/lore-shell/AnalysisDialog";
import { ShareDialog } from "@/components/lore-shell/ShareDialog";
import type { ReadmeBadgeSnippet } from "@/lib/readme-badge";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

type ShellDialog = "analysis" | "share";

interface LoreShellContextValue {
  analysis: ShellAnalysis;
  /** Opens a dialog, returning focus to `trigger` when it closes. */
  openDialog: (dialog: ShellDialog, trigger?: HTMLElement | null) => void;
}

const LoreShellContext = createContext<LoreShellContextValue | null>(null);

/**
 * Shared state for every page under `/lore/{owner}/{repo}` (issue #84): the
 * latest run's snapshot for the status line, and the Analysis and Share
 * dialogs that the header and each page's status line open. The dialogs
 * render once here, so every opener shares one instance.
 */
export function LoreShellProvider({
  owner,
  repo,
  analysis,
  loreUrl,
  badgeImageUrl,
  badgeSnippets,
  children,
}: {
  owner: string;
  repo: string;
  analysis: ShellAnalysis;
  loreUrl: string;
  badgeImageUrl: string;
  badgeSnippets: ReadmeBadgeSnippet[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState<ShellDialog | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  const openDialog = useCallback(
    (dialog: ShellDialog, trigger?: HTMLElement | null) => {
      opener.current =
        trigger ??
        (document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null);
      setOpen(dialog);
    },
    []
  );
  const value = useMemo(
    () => ({ analysis, openDialog }),
    [analysis, openDialog]
  );

  const onOpenChange = (next: boolean) => {
    if (!next) setOpen(null);
  };
  // Radix restores focus to whatever was focused when the dialog opened,
  // which is `<body>` when a click didn't focus its button (Safari).
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    if (opener.current?.isConnected) opener.current.focus();
    opener.current = null;
  };

  return (
    <LoreShellContext.Provider value={value}>
      {children}
      <AnalysisDialog
        owner={owner}
        repo={repo}
        analysis={analysis}
        open={open === "analysis"}
        onOpenChange={onOpenChange}
        onCloseAutoFocus={restoreFocus}
      />
      <ShareDialog
        loreUrl={loreUrl}
        badgeImageUrl={badgeImageUrl}
        badgeSnippets={badgeSnippets}
        open={open === "share"}
        onOpenChange={onOpenChange}
        onCloseAutoFocus={restoreFocus}
      />
    </LoreShellContext.Provider>
  );
}

export function useLoreShell(): LoreShellContextValue {
  const context = useContext(LoreShellContext);
  if (!context) {
    throw new Error("useLoreShell must be used within a LoreShellProvider");
  }
  return context;
}
