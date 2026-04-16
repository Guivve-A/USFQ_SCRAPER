"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { SearchBar } from "@/components/SearchBar";
import { cn } from "@/lib/utils";

const PLATFORMS = [
  { id: "", label: "Todas" },
  { id: "devpost", label: "Devpost" },
  { id: "mlh", label: "MLH" },
  { id: "eventbrite", label: "Eventbrite" },
  { id: "gdg", label: "GDG" },
];

const MODE_OPTIONS = [
  { id: "", label: "Todos" },
  { id: "true", label: "Online" },
  { id: "false", label: "Presencial" },
];

export interface EventsFiltersProps {
  initialQuery: string;
  initialOnline?: string;
  initialPlatform?: string;
  initialPrize?: string;
}

export function EventsFilters({
  initialQuery,
  initialOnline = "",
  initialPlatform = "",
  initialPrize = "",
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
          "grid gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-3",
          isPending && "opacity-70"
        )}
      >
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
          options={[
            { id: "", label: "Todos" },
            { id: "1", label: "Con premio" },
          ]}
          onChange={(value) => updateParam("prize", value)}
        />
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
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.id || "all"}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition",
              value === opt.id
                ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
