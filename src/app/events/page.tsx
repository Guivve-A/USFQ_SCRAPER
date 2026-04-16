import { ChatWidget } from "@/components/ChatWidget";
import { EventsFilters } from "@/components/EventsFilters";
import { HackathonCard } from "@/components/HackathonCard";
import { SiteHeader } from "@/components/SiteHeader";
import { searchHackathons } from "@/lib/ai/search";
import { listHackathons } from "@/lib/db/queries";
import type { Hackathon, Platform } from "@/types/hackathon";

export const dynamic = "force-dynamic";

const VALID_PLATFORMS: ReadonlyArray<Platform> = [
  "devpost",
  "mlh",
  "eventbrite",
  "luma",
  "gdg",
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

  const online = asOnline(onlineRaw);
  const platform = asPlatform(platformRaw);
  const hasPrize = prizeRaw === "1";

  let items: Hackathon[] = [];
  let errorMessage: string | null = null;

  try {
    if (q.length >= 2) {
      const hits = await searchHackathons({
        query: q,
        online,
        platform,
        limit: 24,
      });
      items = hasPrize ? hits.filter((h) => Boolean(h.prize_pool)) : hits;
    } else {
      items = await listHackathons({
        online,
        platform,
        hasPrize,
        limit: 60,
      });
    }
  } catch (error) {
    console.error("[events] Failed to load:", error);
    errorMessage = "No pudimos cargar los hackathons. Intenta nuevamente en unos segundos.";
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Todos los hackathons
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Filtra, busca y encuentra el evento que mejor encaja contigo.
          </p>
        </header>

        <EventsFilters
          initialQuery={q}
          initialOnline={onlineRaw}
          initialPlatform={platformRaw}
          initialPrize={prizeRaw}
        />

        <div className="mt-8 mb-4 flex items-center justify-between text-sm text-zinc-600">
          <span>
            {q ? (
              <>
                <strong className="text-zinc-900">{items.length}</strong>{" "}
                resultados para &quot;{q}&quot;
              </>
            ) : (
              <>
                <strong className="text-zinc-900">{items.length}</strong>{" "}
                eventos disponibles
              </>
            )}
          </span>
        </div>

        {errorMessage ? (
          <ErrorState message={errorMessage} />
        ) : items.length === 0 ? (
          <EmptyState query={q} />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((hackathon) => (
              <HackathonCard key={hackathon.id} hackathon={hackathon} />
            ))}
          </div>
        )}
      </main>
      <ChatWidget />
    </>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
      <h3 className="text-base font-semibold text-zinc-900">Sin resultados</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">
        {query
          ? `No encontramos hackathons que coincidan con "${query}". Prueba ajustar la descripción o limpiar los filtros.`
          : "No hay eventos con esos filtros. Prueba combinarlos de otra forma."}
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-12 text-center text-sm text-rose-700">
      {message}
    </div>
  );
}
