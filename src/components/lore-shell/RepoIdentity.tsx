import { Badge } from "@/components/ui/Badge";
import { FolderGit2, GitBranch } from "lucide-react";

function Dot() {
  return <span aria-hidden="true">·</span>;
}

export function RepoIdentity({
  owner,
  repo,
  visibility = "Public",
  statusLabel,
  statusTone = "success",
  updatedLabel,
  branch,
  language,
}: {
  owner: string;
  repo: string;
  visibility?: string;
  statusLabel: string;
  statusTone?: "success" | "alert";
  updatedLabel: string;
  branch: string;
  language?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <FolderGit2 className="h-5 w-5 text-foreground" aria-hidden="true" />
        <span className="text-base font-semibold text-foreground">
          {owner}/{repo}
        </span>
        <Badge variant="primary">{visibility}</Badge>
      </div>
      <div
        className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted"
        id="status-row"
      >
        <span
          className={
            statusTone === "success"
              ? "h-1.5 w-1.5 rounded-full bg-success"
              : "h-1.5 w-1.5 rounded-full bg-tile-alert-fg"
          }
          aria-hidden="true"
        />
        {statusLabel}
        <Dot />
        {updatedLabel}
        <Dot />
        <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
        {branch}
        {language && (
          <>
            <Dot />
            <Badge className="truncate font-mono text-xs text-foreground">
              {language}
            </Badge>
          </>
        )}
      </div>
    </div>
  );
}
