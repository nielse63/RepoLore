import { notFound } from "next/navigation";

/**
 * Repository settings is not implemented yet (sidebar link is commented out
 * in Sidebar.tsx); the real page lives under `_repository-settings/` for
 * future reference but is excluded from routing by the `_` prefix. This stub
 * catches `/repository-settings` and everything under it and renders the
 * app's not-found page.
 */
export default function RepositorySettingsNotImplementedPage() {
  notFound();
}
