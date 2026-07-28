import type { SourceLocation } from "@/lore/model";
import { formatPath } from "@/lib/format-path";

export function SourceLink({
  location,
  sourceUrl,
  children,
}: {
  location: SourceLocation;
  sourceUrl?: (location: SourceLocation) => string;
  children?: React.ReactNode;
}) {
  const label = children ?? formatPath(location.filePath);
  const lines =
    location.startLine !== undefined
      ? `:${location.startLine}${location.endLine ? `-${location.endLine}` : ""}`
      : "";
  if (!sourceUrl) {
    return (
      <code className="rounded bg-border/40 px-1.5 py-0.5 font-mono text-xs text-foreground">
        {label}
        {lines}
      </code>
    );
  }
  return (
    <a
      href={sourceUrl(location)}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded bg-border/40 px-1.5 py-0.5 font-mono text-xs text-primary hover:underline"
    >
      {label}
      {lines}
    </a>
  );
}
