import { getLatestAnalysisRunForRepo } from "@/db/analysis-runs";
import {
  indexabilityFactsFromRun,
  isIndexableLore,
} from "@/lib/lore-indexability";
import { ImageResponse } from "next/og";

export const alt = "Repo Lore orientation summary for this repository";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
/** Counts change only on re-analysis, so an hour-old card is fine and spares regenerating one per crawler fetch. */
export const revalidate = 3600;

/** Fixed light-theme values from `globals.css` — an image has no color scheme to follow. */
const COLORS = {
  background: "#fdfcfa",
  border: "#e6e4de",
  foreground: "#20272a",
  muted: "#5b6466",
  primary: "#08594f",
};

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * Social preview card for a repository's Overview (docs/MARKETING.md item
 * 3): the repository name plus its entry point and structural area counts.
 * Counts are shown only when `isIndexableLore` holds — the same bar the
 * page needs to be listed in search — so a failed, partial, or empty run
 * never advertises numbers it can't back. Otherwise, or if the database
 * can't be read, the card falls back to the generic tagline rather than
 * erroring for the crawler requesting it.
 */
export default async function Image({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;

  let summary = "Evidence-backed orientation for this codebase";
  try {
    const run = await getLatestAnalysisRunForRepo(owner, repo);
    if (run?.result && isIndexableLore(indexabilityFactsFromRun(run))) {
      summary = `${plural(run.result.entryPoints.length, "entry point")} · ${plural(run.result.structuralAreas.length, "area")}`;
    }
  } catch (error) {
    console.error(`opengraph-image(${owner}/${repo}) failed:`, error);
  }

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        background: COLORS.background,
        borderTop: `16px solid ${COLORS.primary}`,
        color: COLORS.foreground,
      }}
    >
      <div style={{ fontSize: 36, fontWeight: 600, color: COLORS.primary }}>
        Repo Lore
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1.1,
            wordBreak: "break-word",
          }}
        >
          {`${owner}/${repo}`}
        </div>
        <div style={{ fontSize: 40, color: COLORS.muted }}>{summary}</div>
      </div>
      <div
        style={{
          fontSize: 28,
          color: COLORS.muted,
          borderTop: `2px solid ${COLORS.border}`,
          paddingTop: 24,
        }}
      >
        Understand any codebase with confidence.
      </div>
    </div>,
    size
  );
}
