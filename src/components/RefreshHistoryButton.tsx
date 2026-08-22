"use client";

import { useActionState } from "react";
import { RotateCw } from "lucide-react";
import { refreshHistory, type RefreshHistoryState } from "@/app/actions";
import { Button } from "@/components/ui/Button";

const initialState: RefreshHistoryState = { status: "idle" };

/** "Refresh history" button for `/lore/{owner}/{repo}/history` — mirrors `ReanalyzeButton`. */
export function RefreshHistoryButton({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}) {
  const refreshWithParams = refreshHistory.bind(null, owner, repo);
  const [state, formAction, isPending] = useActionState(
    refreshWithParams,
    initialState
  );

  return (
    <form action={formAction} className="flex flex-col items-end gap-2">
      <Button type="submit" variant="secondary" disabled={isPending}>
        <RotateCw className="h-4 w-4" aria-hidden="true" />
        {isPending ? "Refreshing…" : "Refresh history"}
      </Button>
      {state.status === "done" && (
        <p className="text-xs text-muted">
          {state.entryCount > 0
            ? `Refreshed — ${state.entryCount} ${
                state.entryCount === 1 ? "entry" : "entries"
              } found.`
            : "Refreshed — no meaningful changes detected in this window."}
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className="text-xs text-tile-alert-fg">
          <strong>Error:</strong> {state.message}
        </p>
      )}
    </form>
  );
}
