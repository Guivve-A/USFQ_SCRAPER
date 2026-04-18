"use client";

import { Loader2, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
  redirectToEvents?: boolean;
}

export function SearchBar({
  placeholder = "Ej: hackathons de IA online...",
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
  redirectToEvents = false,
}: SearchBarProps) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [loading, setLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [focused, setFocused] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const skipNextRef = useRef(false);

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  useEffect(() => {
    if (!autoSearch || redirectToEvents) return;

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
  }, [value, online, platform, limit, autoSearch, redirectToEvents]);

  useEffect(() => {
    if (!redirectToEvents) return;
    abortRef.current?.abort();
    setLoading(false);
  }, [redirectToEvents]);

  async function runSearch(query: string) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams({ q: query, limit: String(limit) });
      if (online !== undefined) params.set("online", String(online));
      if (platform) params.set("platform", platform);

      const res = await fetch("/api/search?" + params.toString(), {
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

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const query = value.trim();
    onSubmit?.(query);

    if (redirectToEvents && query.length >= MIN_CHARS) {
      setIsNavigating(true);
      router.push("/events?q=" + encodeURIComponent(query));
      return;
    }

    if (autoSearch && query.length >= MIN_CHARS) {
      void runSearch(query);
    }
  }

  const heightClass = size === "lg" ? "h-16" : "h-12";
  const iconSize = size === "lg" ? "size-5" : "size-4";
  const textSize = size === "lg" ? "text-[15px]" : "text-sm";

  return (
    <div
      className={cn(
        "group relative w-full transition-all duration-400",
        className
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -inset-[2px] rounded-[18px] opacity-0 blur-lg transition-opacity duration-500",
          "bg-[radial-gradient(60%_100%_at_50%_50%,rgba(34,211,238,0.32),rgba(139,92,246,0.22)_55%,transparent_80%)]",
          (focused || undefined) && "opacity-100",
          "group-hover:opacity-80"
        )}
      />
      <form
        onSubmit={handleSearch}
        className={cn(
          "relative flex items-center rounded-2xl border border-indigo-200/10 bg-[linear-gradient(135deg,rgba(30,27,75,0.45),rgba(15,23,42,0.32))] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl backdrop-saturate-150 transition-all duration-400",
          heightClass,
          "group-hover:border-cyan-200/20 group-hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(34,211,238,0.10),0_22px_48px_-30px_rgba(34,211,238,0.35)]",
          focused &&
            "border-cyan-200/30 bg-[linear-gradient(135deg,rgba(49,46,129,0.55),rgba(15,23,42,0.38))] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(34,211,238,0.18),0_0_28px_-4px_rgba(34,211,238,0.40),0_22px_52px_-28px_rgba(139,92,246,0.45)]"
        )}
      >
        <button
          type="submit"
          aria-label="Ejecutar búsqueda"
          className={cn(
            "ml-3 flex size-9 items-center justify-center rounded-xl text-slate-300/60 transition-colors",
            "hover:text-cyan-100/90",
            focused && "text-cyan-100/90",
            (value.trim().length < MIN_CHARS || isNavigating) && "cursor-not-allowed opacity-60"
          )}
          disabled={value.trim().length < MIN_CHARS || isNavigating}
        >
          {isNavigating ? (
            <Loader2 className={cn("animate-spin", iconSize)} />
          ) : (
            <Search className={iconSize} />
          )}
        </button>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={500}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          aria-label="Buscar hackathons"
          disabled={isNavigating}
          className={cn(
            "tracking-luxury h-full flex-1 bg-transparent px-3 font-medium text-slate-100 placeholder:font-normal placeholder:text-slate-300/45 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70",
            textSize
          )}
        />
        <div className="mr-4 flex items-center gap-1">
          {loading && (
            <Loader2
              className={cn("animate-spin text-slate-200/85", iconSize)}
            />
          )}
          {!loading && !isNavigating && value && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Limpiar búsqueda"
              className="rounded-full p-1.5 text-slate-300/55 transition-colors hover:bg-white/[0.04] hover:text-slate-100"
            >
              <X className={iconSize} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
