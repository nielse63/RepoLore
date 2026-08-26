const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
];

const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "2 hours ago" style formatting for analysis/commit timestamps shown across the Lore shell. */
export function relativeTime(isoDate: string): string {
  const diffSeconds = (Date.now() - new Date(isoDate).getTime()) / 1000;
  if (diffSeconds < 60) return "just now";
  for (const [unit, secondsInUnit] of UNITS) {
    if (diffSeconds >= secondsInUnit) {
      return formatter.format(-Math.floor(diffSeconds / secondsInUnit), unit);
    }
  }
  return formatter.format(-Math.floor(diffSeconds / 60), "minute");
}
