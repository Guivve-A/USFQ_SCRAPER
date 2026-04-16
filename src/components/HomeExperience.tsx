"use client";

import { Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { HackathonCard } from "@/components/HackathonCard";
import { SearchBar, type HackathonSearchHit } from "@/components/SearchBar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Hackathon, Platform } from "@/types/hackathon";

type Filter =
  | { kind: "all" }
  | { kind: "online"; value: boolean }
  | { kind: "platform"; value: Platform };

const FILTERS: Array<{ id: string; label: string; filter: Filter }> = [
  { id: "all", label: "Todos", filter: { kind: "all" } },
  { id: "online", label: "Online", filter: { kind: "online", value: true } },
  {
    id: "presencial",
    label: "Presencial",
    filter: { kind: "online", value: false },
  },
  { id: "devpost", label: "Devpost", filter: { kind: "platform", value: "devpost" } },
  { id: "mlh", label: "MLH", filter: { kind: "platform", value: "mlh" } },
  { id: "gdg", label: "GDG", filter: { kind: "platform", value: "gdg" } },
];

export interface HomeExperienceProps {
  recent: Hackathon[];
}

export function HomeExperience({ recent }: HomeExperienceProps) {
  const [activeFilterId, setActiveFilterId] = useState("all");
  const [searchResults, setSearchResults] = useState<HackathonSearchHit[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const filtered = useMemo(() => {
    const filter = FILTERS.find((f) => f.id === activeFilterId)?.filter;
    if (!filter || filter.kind === "all") return recent;
    if (filter.kind === "online") {
      return recent.filter((h) => h.is_online === filter.value);
    }
    return recent.filter((h) => h.platform === filter.value);
  }, [activeFilterId, recent]);

  const showingSearch = searchQuery.length > 0;
  const items = showingSearch ? (searchResults ?? []) : filtered;

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50 via-white to-zinc-50 pb-12 pt-16 sm:pt-24">
        <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.18),_transparent_60%)]" />
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white/70 px-3 py-1 text-xs font-medium text-indigo-700 shadow-sm">
            <Sparkles className="size-3.5" />
            Búsqueda semántica con IA
          </span>
          <h1 className="text-balance text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
            Descubre tu próximo hackathon
          </h1>
          <p className="max-w-xl text-pretty text-base text-zinc-600 sm:text-lg">
            Eventos de Devpost, MLH, Eventbrite y la comunidad GDG en un solo
            lugar. Pregunta en lenguaje natural y deja que la IA encuentre el
            match perfecto.
          </p>
          <SearchBar
            size="lg"
            className="mt-2 max-w-2xl"
            onResults={(results, query) => {
              setSearchResults(results);
              setSearchQuery(query);
            }}
            onLoadingChange={setSearching}
          />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-24 pt-10 sm:px-6">
        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">
              {showingSearch
                ? `Resultados para "${searchQuery}"`
                : "Hackathons recientes"}
            </h2>
            <p className="text-sm text-zinc-500">
              {showingSearch
                ? `${items.length} coincidencias semánticas`
                : `${items.length} eventos en cartelera`}
            </p>
          </div>
          {!showingSearch && (
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setActiveFilterId(option.id)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-xs font-medium transition",
                    activeFilterId === option.id
                      ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {showingSearch && searching ? (
          <CardGridSkeleton count={6} />
        ) : items.length === 0 ? (
          <EmptyState searching={showingSearch} query={searchQuery} />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((hackathon) => (
              <HackathonCard key={hackathon.id} hackathon={hackathon} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function CardGridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white"
        >
          <Skeleton className="aspect-[16/9] w-full" />
          <div className="space-y-3 p-5">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ searching, query }: { searching: boolean; query: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
        <Search className="size-5" />
      </div>
      <h3 className="text-base font-semibold text-zinc-900">
        {searching ? "Sin resultados" : "Aún no hay hackathons"}
      </h3>
      <p className="max-w-md text-sm text-zinc-600">
        {searching
          ? `No encontramos hackathons que coincidan con "${query}". Prueba con otra descripción o ajusta los filtros.`
          : "Vuelve pronto, los scrapers se ejecutan diariamente."}
      </p>
    </div>
  );
}

export { CardGridSkeleton };
