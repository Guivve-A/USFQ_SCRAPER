import Link from "next/link";
import { Compass } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-zinc-900">
          <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
            <Compass className="size-4" />
          </span>
          <span className="text-base font-semibold tracking-tight">
            HackFinder
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm font-medium text-zinc-600">
          <Link
            href="/events"
            className="rounded-md px-3 py-1.5 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            Eventos
          </Link>
          <Link
            href="/chat"
            className="rounded-md px-3 py-1.5 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            HackBot
          </Link>
        </nav>
      </div>
    </header>
  );
}
