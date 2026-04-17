"use client";

import { Search } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

import { AssetPreloader } from "@/components/AssetPreloader";
import { HackathonCard } from "@/components/HackathonCard";
import { SearchBar, type HackathonSearchHit } from "@/components/SearchBar";
import { cn } from "@/lib/utils";
import type { Hackathon, Platform } from "@/types/hackathon";

const Scene3D = dynamic(
  () => import("@/components/three/Scene3D").then((m) => m.Scene3D),
  { ssr: false }
);

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP);
}

type Filter =
  | { kind: "all" }
  | { kind: "online"; value: boolean }
  | { kind: "platform"; value: Platform };

const FILTERS: Array<{ id: string; label: string; filter: Filter }> = [
  { id: "all", label: "Todos", filter: { kind: "all" } },
  { id: "online", label: "Online", filter: { kind: "online", value: true } },
  { id: "presencial", label: "Presencial", filter: { kind: "online", value: false } },
  { id: "devpost", label: "Devpost", filter: { kind: "platform", value: "devpost" } },
  { id: "mlh", label: "MLH", filter: { kind: "platform", value: "mlh" } },
  { id: "gdg", label: "GDG", filter: { kind: "platform", value: "gdg" } },
];

const TITLE_WORDS = ["Descubre", "tu", "próximo", "hackathon"];
const HERO_SUBTITLE_LINES = [
  "El motor de búsqueda definitivo para descubrir hackatones globales en un solo lugar.",
  "Pregunta en lenguaje natural y deja que la IA encuentre el match perfecto.",
];

export interface HomeExperienceProps {
  recent: Hackathon[];
}

export function HomeExperience({ recent }: HomeExperienceProps) {
  const [activeFilterId, setActiveFilterId] = useState("all");
  const [searchResults, setSearchResults] = useState<HackathonSearchHit[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

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

  const handleTitlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLHeadingElement>) => {
      const chars = event.currentTarget.querySelectorAll<HTMLElement>(
        "[data-hero-char]"
      );
      const mx = event.clientX;
      const my = event.clientY;
      chars.forEach((char) => {
        const rect = char.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = mx - cx;
        const dy = my - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const influence = Math.max(0, 1 - dist / 140);
        const push = -influence * 18;
        const tilt = influence * (dx / 16);
        gsap.to(char, {
          y: push,
          rotate: tilt,
          duration: 0.55,
          ease: "expo.out",
          overwrite: "auto",
        });
      });
    },
    []
  );

  const handleTitlePointerLeave = useCallback(
    (event: React.PointerEvent<HTMLHeadingElement>) => {
      const chars = event.currentTarget.querySelectorAll<HTMLElement>(
        "[data-hero-char]"
      );
      gsap.to(chars, {
        y: 0,
        rotate: 0,
        duration: 1.2,
        ease: "elastic.out(1, 0.55)",
        overwrite: "auto",
      });
    },
    []
  );

  useGSAP(
    () => {
      const hero = heroRef.current;
      if (!hero) return;

      const chars = hero.querySelectorAll<HTMLElement>("[data-hero-char]");
      const fadeUp = hero.querySelectorAll<HTMLElement>("[data-hero-fade]");
      const subtitleWords = hero.querySelectorAll<HTMLElement>(
        "[data-hero-subtitle-word]"
      );

      gsap.set(chars, { yPercent: 110, opacity: 0 });
      gsap.set(fadeUp, { y: 24, opacity: 0 });
      gsap.set(subtitleWords, { y: 14, opacity: 0, filter: "blur(4px)" });

      const tl = gsap.timeline({
        defaults: { ease: "expo.out" },
        delay: 0.1,
      });

      tl.to(chars, {
        yPercent: 0,
        opacity: 1,
        duration: 1.1,
        stagger: 0.028,
      }).to(
        fadeUp,
        {
          y: 0,
          opacity: 1,
          duration: 1.1,
          stagger: 0.12,
        },
        "-=0.9"
      ).to(
        subtitleWords,
        {
          y: 0,
          opacity: 1,
          filter: "blur(0px)",
          duration: 0.8,
          stagger: 0.02,
        },
        "-=0.82"
      );

      return () => {
        gsap.to(subtitleWords, {
          y: -8,
          opacity: 0,
          filter: "blur(4px)",
          duration: 0.22,
          stagger: { each: 0.008, from: "end" },
          ease: "power2.in",
          overwrite: true,
        });
      };
    },
    { scope: rootRef }
  );

  useGSAP(
    () => {
      const grid = gridRef.current;
      if (!grid) return;

      const cards = grid.querySelectorAll<HTMLElement>("[data-card]");
      if (cards.length === 0) return;

      gsap.set(cards, { y: 40, opacity: 0 });

      const batch = ScrollTrigger.batch(cards, {
        start: "top 85%",
        onEnter: (batch) =>
          gsap.to(batch, {
            y: 0,
            opacity: 1,
            duration: 0.9,
            stagger: 0.08,
            ease: "expo.out",
            overwrite: true,
          }),
        once: true,
      });

      return () => {
        batch.forEach((trigger) => trigger.kill());
      };
    },
    { scope: rootRef, dependencies: [items.length, showingSearch, activeFilterId] }
  );

  return (
    <div ref={rootRef}>
      <AssetPreloader />
      <section
        ref={heroRef}
        className="relative h-[100vh] min-h-[720px] overflow-hidden bg-slate-950"
      >
        {/* BACK LAYER — WebGL */}
        <div className="absolute inset-0 z-0">
          <Scene3D />
        </div>

        {/* FRONT LAYER — UI */}
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-4 sm:px-6">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-7 text-center">
            <h1
              onPointerMove={handleTitlePointerMove}
              onPointerLeave={handleTitlePointerLeave}
              className="pointer-events-auto font-heading text-balance text-5xl font-[420] leading-[1.02] tracking-[-0.048em] text-white drop-shadow-[0_8px_40px_rgba(2,6,23,0.8)] sm:text-6xl md:text-7xl"
            >
              {TITLE_WORDS.map((word, wi) => (
                <span
                  key={wi}
                  className="relative inline-block overflow-hidden pb-[0.15em] align-bottom"
                >
                  {Array.from(word).map((ch, ci) => (
                    <span
                      key={ci}
                      data-hero-char
                      className="inline-block will-change-transform"
                    >
                      {ch}
                    </span>
                  ))}
                  {wi < TITLE_WORDS.length - 1 && (
                    <span data-hero-char className="inline-block">
                      &nbsp;
                    </span>
                  )}
                </span>
              ))}
            </h1>

            <p className="w-full max-w-2xl px-2 text-pretty text-[15px] leading-[1.7] tracking-[0.012em] text-cyan-100 drop-shadow-[0_0_8px_rgba(0,255,255,0.7)] animate-neon-pulse sm:px-0 sm:text-base">
              {HERO_SUBTITLE_LINES.map((line, lineIndex) => {
                const words = line.split(" ");
                return (
                  <span key={lineIndex} className="block text-balance [&:not(:last-child)]:mb-0.5">
                    {words.map((word, wordIndex) => (
                      <span
                        key={`${lineIndex}-${wordIndex}`}
                        data-hero-subtitle-word
                        className={cn(
                          "inline-block opacity-0 will-change-transform",
                          wordIndex < words.length - 1 && "mr-[0.42em]"
                        )}
                      >
                        {word}
                      </span>
                    ))}
                  </span>
                );
              })}
            </p>

            <div data-hero-fade className="pointer-events-auto w-full max-w-2xl">
              <div className="rounded-2xl border border-indigo-200/10 bg-[linear-gradient(135deg,rgba(30,27,75,0.38),rgba(15,23,42,0.22))] p-1 shadow-[0_10px_50px_-16px_rgba(2,6,23,0.95)] backdrop-blur-2xl backdrop-saturate-150">
                <SearchBar
                  size="lg"
                  placeholder="Ej: hackathons de IA online..."
                  onResults={(results, query) => {
                    setSearchResults(results);
                    setSearchQuery(query);
                  }}
                  onLoadingChange={setSearching}
                />
              </div>
            </div>

            <div
              data-hero-fade
              className="flex items-center gap-4 text-[11px] uppercase tracking-[0.25em] text-slate-200/50"
            >
              <span>Devpost</span>
              <span className="size-1 rounded-full bg-white/25" />
              <span>MLH</span>
              <span className="size-1 rounded-full bg-white/25" />
              <span>Eventbrite</span>
              <span className="size-1 rounded-full bg-white/25" />
              <span>GDG</span>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-0 left-0 z-[1] h-32 w-full bg-gradient-to-b from-transparent to-background" />
      </section>

      <section className="relative z-10 -mt-12 mx-auto w-full max-w-6xl px-4 pb-32 sm:px-6">
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div className="space-y-1.5">
            <h2 className="font-heading tracking-luxury text-2xl font-light text-white/95 sm:text-3xl">
              {showingSearch
                ? `Resultados para "${searchQuery}"`
                : "Hackathons recientes"}
            </h2>
            <p className="text-[13px] text-white/45">
              {showingSearch
                ? `${items.length} coincidencias semánticas`
                : `${items.length} eventos curados en este momento`}
            </p>
          </div>
          {!showingSearch && (
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setActiveFilterId(option.id)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all duration-300",
                    activeFilterId === option.id
                      ? "border-white/25 bg-white/10 text-white shadow-[0_4px_16px_-4px_rgba(139,92,246,0.3)]"
                      : "border-white/8 bg-white/[0.02] text-white/55 hover:border-white/15 hover:bg-white/[0.05] hover:text-white/85"
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
          <div
            ref={gridRef}
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {items.map((hackathon) => (
              <div key={hackathon.id} data-card>
                <HackathonCard hackathon={hackathon} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CardGridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl"
        >
          <div className="relative aspect-[16/9] w-full bg-white/[0.04]">
            <div className="absolute inset-0 shimmer" />
          </div>
          <div className="space-y-3 p-5">
            <div className="relative h-5 w-3/4 overflow-hidden rounded bg-white/[0.04]">
              <div className="absolute inset-0 shimmer" />
            </div>
            <div className="relative h-4 w-1/2 overflow-hidden rounded bg-white/[0.04]">
              <div className="absolute inset-0 shimmer" />
            </div>
            <div className="relative h-4 w-2/3 overflow-hidden rounded bg-white/[0.04]">
              <div className="absolute inset-0 shimmer" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ searching, query }: { searching: boolean; query: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-20 text-center backdrop-blur-xl">
      <div className="flex size-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-violet-300">
        <Search className="size-5" />
      </div>
      <h3 className="font-heading tracking-luxury text-lg font-light text-white/95">
        {searching ? "Sin resultados" : "Aún no hay hackathons"}
      </h3>
      <p className="max-w-md text-[13px] leading-relaxed text-white/50">
        {searching
          ? `No encontramos hackathons que coincidan con "${query}". Prueba con otra descripción o ajusta los filtros.`
          : "Vuelve pronto, los scrapers se ejecutan diariamente."}
      </p>
    </div>
  );
}

export { CardGridSkeleton };
