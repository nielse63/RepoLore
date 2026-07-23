type ClassValue = string | number | null | undefined | false;

/** Joins truthy class name fragments; no de-duplication or Tailwind conflict resolution needed at this project's scale. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
