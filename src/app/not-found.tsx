"use client";

import { Button } from "@/components/ui/Button";
import { resolveBackDestination } from "@/lib/back-destination";
import { Compass } from "lucide-react";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-border px-8 py-5">
        <span className="font-serif text-xl font-semibold text-foreground">
          Repo Lore
        </span>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface">
          <Compass className="h-7 w-7 text-muted" aria-hidden="true" />
        </div>
        <h1 className="mt-6 font-serif text-4xl font-semibold text-foreground">
          Page not found
        </h1>
        <p className="mt-3 max-w-md text-base text-muted">
          This page doesn&apos;t exist, or the feature isn&apos;t available yet.
        </p>
        <Button
          variant="secondary"
          className="mt-8"
          onClick={() => {
            const destination = resolveBackDestination(
              document.referrer,
              window.location.origin
            );
            if (destination === "back") {
              router.back();
            } else {
              router.push("/");
            }
          }}
        >
          Back to Repo Lore
        </Button>
      </main>
    </div>
  );
}
