import { notFound } from "next/navigation";

/**
 * Systems is not implemented yet (sidebar link is commented out in
 * Sidebar.tsx); the real pages live under `_systems/` for future reference
 * but are excluded from routing by the `_` prefix. This stub catches
 * `/systems` and everything under it and renders the app's not-found page.
 */
export default function SystemsNotImplementedPage() {
  notFound();
}
