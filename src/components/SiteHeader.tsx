import Link from "next/link";
import { Compass } from "lucide-react";

interface SiteHeaderProps {
  overlay?: boolean;
}

export function SiteHeader({ overlay = false }: SiteHeaderProps) {
  const containerClass = overlay
    ? "fixed inset-x-0 top-3 z-50 px-3 sm:px-5"
    : "sticky top-3 z-50 px-3 sm:px-5";

  return (
    <header className={containerClass}>
      <div className="mx-auto w-full max-w-6xl">
        <div className="relative flex h-[3rem] items-center justify-between overflow-hidden rounded-2xl border border-white/[0.14] bg-[linear-gradient(105deg,rgba(8,12,22,0.86)_0%,rgba(31,41,55,0.64)_48%,rgba(10,14,24,0.82)_100%)] px-3 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_16px_44px_-22px_rgba(2,6,23,0.95)] backdrop-blur-xl backdrop-saturate-150 sm:h-[3.2rem] sm:px-4">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_0%,rgba(148,163,184,0.16),transparent_45%),radial-gradient(circle_at_72%_100%,rgba(14,165,233,0.08),transparent_50%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-100/35 to-transparent"
          />

          <Link
            href="/"
            className="group relative z-10 flex items-center gap-2.5 text-slate-100 transition-opacity hover:opacity-95"
          >
            <span className="relative flex size-6 items-center justify-center rounded-full border border-white/20 bg-white/[0.04] text-slate-100/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-colors group-hover:border-slate-200/45 group-hover:bg-white/[0.08] sm:size-7">
              <Compass className="size-3.5" />
            </span>
            <span className="font-heading text-[13px] font-[450] tracking-[-0.03em] text-slate-100/95 sm:text-[14px]">
              HackFinder
            </span>
          </Link>

          <nav
            aria-label="Principal"
            className="relative z-10 flex items-center gap-0.5 text-[11px] font-medium tracking-[0.01em] text-slate-200/70 sm:gap-1 sm:text-[12px]"
          >
            <Link
              href="/events"
              className="rounded-lg px-2.5 py-1.5 transition-colors hover:bg-white/[0.08] hover:text-slate-100 sm:px-3"
            >
              Eventos
            </Link>
            <Link
              href="/suggest"
              className="rounded-lg px-2.5 py-1.5 transition-colors hover:bg-white/[0.08] hover:text-slate-100 sm:px-3"
            >
              Sugerir
            </Link>
            <Link
              href="/chat"
              className="rounded-lg px-2.5 py-1.5 transition-colors hover:bg-white/[0.08] hover:text-slate-100 sm:px-3"
            >
              HackBot
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
