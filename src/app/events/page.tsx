import { Search } from "lucide-react";
import Link from "next/link";

import { ChatWidget } from "@/components/ChatWidget";
import { EventsFilters } from "@/components/EventsFilters";
import { HackathonCard } from "@/components/HackathonCard";
import { SiteHeader } from "@/components/SiteHeader";
import { searchHackathons } from "@/lib/ai/search";
import { listHackathons } from "@/lib/db/queries";
import { isScope, resolveScope, type Scope } from "@/lib/region";
import type { Hackathon, Platform } from "@/types/hackathon";

export const dynamic = "force-dynamic";

const VALID_PLATFORMS: ReadonlyArray<Platform> = [
  "devpost",
  "mlh",
  "eventbrite",
  "luma",
  "gdg",
  "lablab",
];

function asString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function asOnline(value: string): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function asPlatform(value: string): Platform | undefined {
  return (VALID_PLATFORMS as readonly string[]).includes(value)
    ? (value as Platform)
    : undefined;
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = asString(params.q).trim().slice(0, 200);
  const onlineRaw = asString(params.online);
  const platformRaw = asString(params.platform);
  const prizeRaw = asString(params.prize);
  const scopeRaw = asString(params.scope);

  const online = asOnline(onlineRaw);
  const platform = asPlatform(platformRaw);
  const hasPrize = prizeRaw === "1";
  const scope: Scope = isScope(scopeRaw) ? scopeRaw : "ecuador-friendly";
  const { regions, includeUnknownOnline, forceOnline } = resolveScope(scope);
  const effectiveOnline = online ?? forceOnline;

  let items: Hackathon[] = [];
  let errorMessage: string | null = null;

  try {
    if (q.length >= 2) {
      const hits = await searchHackathons({
        query: q,
        online,
        platform,
        limit: 24,
        scope,
      });
      items = hasPrize ? hits.filter((h) => Boolean(h.prize_pool)) : hits;
    } else {
      items = await listHackathons({
        online: effectiveOnline,
        platform,
        hasPrize,
        limit: 60,
        regions,
        includeUnknownOnline,
      });
    }
  } catch (error) {
    console.error("[events] Failed to load:", error);
    errorMessage =
      "No pudimos cargar los hackathons. Intenta nuevamente en unos segundos.";
  }

  return (
    <>
      <SiteHeader />
      <main className="relative mx-auto w-full max-w-6xl min-h-screen px-4 pb-32 pt-16 sm:px-6 sm:pt-20">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 -z-10 h-64 w-[700px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.16),transparent_65%)] blur-3xl"
        />

        <header className="mb-10 space-y-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-white/65 backdrop-blur-md">
            Catálogo global
          </span>
          <h1 className="font-heading tracking-luxury text-balance text-4xl font-medium leading-[1.05] text-white sm:text-5xl md:text-6xl">
            Todos los <span className="text-gradient-luxury">hackathons</span>
          </h1>
          <p className="max-w-xl text-[15px] text-white/55">
            Filtra, busca y encuentra el evento que mejor encaja contigo.
          </p>
        </header>

        <EventsFilters
          initialQuery={q}
          initialOnline={onlineRaw}
          initialPlatform={platformRaw}
          initialPrize={prizeRaw}
          initialScope={scope}
        />

        <div className="mt-10 mb-5 flex items-center justify-between">
          <span className="text-[13px] text-white/55">
            {q ? (
              <>
                <strong className="font-semibold text-white">
                  {items.length}
                </strong>{" "}
                resultados para &quot;{q}&quot;
              </>
            ) : (
              <>
                <strong className="font-semibold text-white">
                  {items.length}
                </strong>{" "}
                eventos disponibles
              </>
            )}
          </span>
        </div>

        <section aria-label="Listado de hackathons" className="pb-6">
          {errorMessage ? (
            <ErrorState message={errorMessage} />
          ) : items.length === 0 ? (
            <EmptyState query={q} />
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
              {items.map((hackathon) => (
                <HackathonCard key={hackathon.id} hackathon={hackathon} />
              ))}
            </div>
          )}
        </section>
      </main>
      <ChatWidget />
    </>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-20 text-center backdrop-blur-xl">
      <div className="flex size-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-violet-300">
        <Search className="size-5" />
      </div>
      <h3 className="font-heading tracking-luxury text-lg font-light text-white/95">
        Sin resultados
      </h3>
      <p className="mx-auto max-w-md text-[13px] leading-relaxed text-white/50">
        {query
          ? `No encontramos hackathons que coincidan con "${query}". Prueba ajustar la descripción o limpiar los filtros.`
          : "No hay eventos con esos filtros. Prueba combinarlos de otra forma."}
      </p>
      <Link
        href="/suggest"
        className="mt-2 rounded-full border border-violet-400/30 bg-violet-500/15 px-4 py-2 text-xs font-medium text-violet-100 transition hover:border-violet-300/50 hover:bg-violet-500/25"
      >
        Sugerir un evento online
      </Link>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-rose-400/20 bg-rose-500/5 px-6 py-12 text-center text-sm text-rose-200/90 backdrop-blur-xl">
      {message}
    </div>
  );
}
