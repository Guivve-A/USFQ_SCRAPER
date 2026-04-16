"use client";

import { Loader2, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Hackathon } from "@/types/hackathon";

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;

export type HackathonSearchHit = Hackathon & { similarity: number };

export interface SearchBarProps {
  placeholder?: string;
  defaultValue?: string;
  onResults?: (results: HackathonSearchHit[], query: string) => void;
  onLoadingChange?: (loading: boolean) => void;
  onSubmit?: (query: string) => void;
  className?: string;
  size?: "default" | "lg";
  online?: boolean;
  platform?: string;
  limit?: number;
  autoSearch?: boolean;
}

export function SearchBar({
  placeholder = "Ej: hackathons de IA online con premios este mes...",
  defaultValue = "",
  onResults,
  onLoadingChange,
  onSubmit,
  className,
  size = "default",
  online,
  platform,
  limit = 12,
  autoSearch = true,
}: SearchBarProps) {
  const [value, setValue] = useState(defaultValue);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const skipNextRef = useRef(false);

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  useEffect(() => {
    if (!autoSearch) return;

    if (skipNextRef.current) {
      skipNextRef.current = false;
      return;
    }

    const trimmed = value.trim();

    if (trimmed.length < MIN_CHARS) {
      abortRef.current?.abort();
      setLoading(false);
      onResults?.([], "");
      return;
    }

    const handle = setTimeout(() => {
      void runSearch(trimmed);
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, online, platform, limit, autoSearch]);

  async function runSearch(query: string) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams({ q: query, limit: String(limit) });
      if (online !== undefined) params.set("online", String(online));
      if (platform) params.set("platform", platform);

      const res = await fetch(`/api/search?${params.toString()}`, {
        signal: controller.signal,
        cache: "no-store",
      });

      if (!res.ok) {
        onResults?.([], query);
        return;
      }

      const data = (await res.json()) as { results?: HackathonSearchHit[] };
      onResults?.(data.results ?? [], query);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("[SearchBar] search failed", error);
      onResults?.([], query);
    } finally {
      if (controller === abortRef.current) {
        setLoading(false);
      }
    }
  }

  function handleClear() {
    abortRef.current?.abort();
    skipNextRef.current = true;
    setValue("");
    setLoading(false);
    onResults?.([], "");
  }

  function handleKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      const trimmed = value.trim();
      onSubmit?.(trimmed);
      if (autoSearch && trimmed.length >= MIN_CHARS) void runSearch(trimmed);
    }
  }

  const heightClass = size === "lg" ? "h-14" : "h-11";
  const iconSize = size === "lg" ? "size-5" : "size-4";

  return (
    <div className={cn("relative w-full", className)}>
      <Search
        className={cn(
          "pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400",
          iconSize
        )}
      />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        aria-label="Buscar hackathons"
        className={cn(
          "rounded-2xl border-zinc-200 bg-white pl-12 pr-12 text-base shadow-sm transition focus-visible:border-indigo-400 focus-visible:ring-indigo-200/60",
          heightClass
        )}
      />
      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {loading && (
          <Loader2 className={cn("animate-spin text-indigo-500", iconSize)} />
        )}
        {!loading && value && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Limpiar búsqueda"
            className="rounded-full p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className={iconSize} />
          </button>
        )}
      </div>
    </div>
  );
}
