declare global {
  interface Window {
    gtag?: (command: "event", eventName: string) => void;
  }
}

/**
 * Sends a parameterless GA4 custom event. A
 * no-op wherever `gtag` isn't loaded — it's only injected in production
 * (`src/app/layout.tsx`), or a blocker may have removed it — so analytics
 * can never break the flow it's measuring.
 */
export function trackEvent(eventName: string): void {
  if (typeof window === "undefined") return;
  window.gtag?.("event", eventName);
}
