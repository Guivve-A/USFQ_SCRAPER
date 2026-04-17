"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Loader2, SlidersHorizontal } from "lucide-react";

import { SearchBar } from "@/components/SearchBar";
import { cn } from "@/lib/utils";

const PLATFORMS = [
  { id: "", label: "Todas" },
  { id: "devpost", label: "Devpost" },
  { id: "lablab", label: "Lablab" },
  { id: "mlh", label: "MLH" },
  { id: "eventbrite", label: "Eventbrite" },
  { id: "gdg", label: "GDG" },
];

const MODE_OPTIONS = [
  { id: "", label: "Todos" },
  { id: "true", label: "Online" },
  { id: "false", label: "Presencial" },
];

const PRIZE_OPTIONS = [
  { id: "", label: "Todos" },
  { id: "1", label: "Con premio" },
];

const SCOPE_OPTIONS = [
  { id: "ecuador-friendly", label: "Para Ecuador" },
  { id: "ecuador-only", label: "Solo Ecuador" },
  { id: "latam-online", label: "LATAM online" },
  { id: "global-online", label: "Global online" },
  { id: "all", label: "Todo" },
];

export interface EventsFiltersProps {
  initialQuery: string;
  initialOnline?: string;
  initialPlatform?: string;
  initialPrize?: string;
  initialScope?: string;
}

export function EventsFilters({
  initialQuery,
  initialOnline = "",
  initialPlatform = "",
  initialPrize = "",
  initialScope = "ecuador-friendly",
}: EventsFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);

    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  const activeCount =
    [initialOnline, initialPlatform, initialPrize].filter(Boolean).length +
    (initialScope && initialScope !== "ecuador-friendly" ? 1 : 0);

  function updateScope(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value && value !== "ecuador-friendly") next.set("scope", value);
    else next.delete("scope");

    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  function clearAll() {
    const next = new URLSearchParams();
    const currentQ = searchParams.get("q");
    if (currentQ) next.set("q", currentQ);
    const qs = next.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  return (
    <div className="space-y-4">
      <SearchBar
        defaultValue={initialQuery}
        autoSearch={false}
        size="lg"
        placeholder="Busca por descripción semántica…"
        onSubmit={(query) => updateParam("q", query)}
      />

      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl backdrop-saturate-150 transition-opacity duration-300 sm:p-6",
          isPending && "opacity-60"
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl"
        />
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-white/50">
            <SlidersHorizontal className="size-3.5" />
            <span>Filtros</span>
            {activeCount > 0 && (
              <span className="rounded-full border border-violet-400/30 bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-200">
                {activeCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isPending && (
              <Loader2 className="size-3.5 animate-spin text-violet-300" />
            )}
            {activeCount > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-[11px] font-medium uppercase tracking-[0.15em] text-white/45 transition-colors hover:text-white/80"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        <div className="mb-5 border-b border-white/5 pb-5">
          <FilterGroup
            label="Alcance"
            value={initialScope}
            options={SCOPE_OPTIONS}
            onChange={updateScope}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-3 sm:gap-6">
          <FilterGroup
            label="Modalidad"
            value={initialOnline}
            options={MODE_OPTIONS}
            onChange={(value) => updateParam("online", value)}
          />
          <FilterGroup
            label="Plataforma"
            value={initialPlatform}
            options={PLATFORMS}
            onChange={(value) => updateParam("platform", value)}
          />
          <FilterGroup
            label="Premios"
            value={initialPrize}
            options={PRIZE_OPTIONS}
            onChange={(value) => updateParam("prize", value)}
          />
        </div>
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id || "all"}
              type="button"
              onClick={() => onChange(opt.id)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all duration-300",
                active
                  ? "border-violet-400/40 bg-gradient-to-r from-violet-500/25 to-fuchsia-500/20 text-white shadow-[0_0_0_1px_rgba(167,139,250,0.25),0_8px_24px_-8px_rgba(139,92,246,0.5)]"
                  : "border-white/8 bg-white/[0.02] text-white/55 hover:border-white/15 hover:bg-white/[0.05] hover:text-white/85"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
