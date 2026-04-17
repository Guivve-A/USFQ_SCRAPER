"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, Clock, MapPin, Trophy, Wifi } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Hackathon, Platform } from "@/types/hackathon";

// 1×1 transparent pixel — used as blurDataURL so the slot has color while loading
const BLUR_PLACEHOLDER =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const PLATFORM_LABEL: Record<Platform, string> = {
  devpost: "Devpost",
  mlh: "MLH",
  eventbrite: "Eventbrite",
  luma: "Luma",
  gdg: "GDG",
  lablab: "Lablab.ai",
};

const PLATFORM_ACCENT: Record<Platform, string> = {
  devpost: "from-sky-500/60 to-indigo-600/60",
  mlh: "from-rose-500/60 to-orange-600/60",
  eventbrite: "from-orange-500/60 to-amber-600/60",
  luma: "from-purple-500/60 to-fuchsia-600/60",
  gdg: "from-emerald-500/60 to-teal-600/60",
  lablab: "from-blue-600/60 to-cyan-500/60",
};

function formatDate(value: string | null): string | null {
  if (!value) return null;
  try {
    return format(parseISO(value), "d MMM yyyy", { locale: es });
  } catch {
    return null;
  }
}

type UrgencyLevel = "critical" | "warning" | null;

function getUrgency(deadline: string | null): {
  level: UrgencyLevel;
  label: string | null;
  daysLeft: number | null;
} {
  if (!deadline) return { level: null, label: null, daysLeft: null };
  try {
    const ms = parseISO(deadline).getTime() - Date.now();
    const days = Math.ceil(ms / 86_400_000);
    if (days < 0) return { level: null, label: null, daysLeft: null };
    if (days === 0) return { level: "critical", label: "¡Cierra hoy!", daysLeft: 0 };
    if (days === 1) return { level: "critical", label: "¡Cierra mañana!", daysLeft: 1 };
    if (days <= 3) return { level: "critical", label: `${days} días`, daysLeft: days };
    if (days <= 14) return { level: "warning", label: `${days} días`, daysLeft: days };
    return { level: null, label: null, daysLeft: days };
  } catch {
    return { level: null, label: null, daysLeft: null };
  }
}

export interface HackathonCardProps {
  hackathon: Hackathon;
  className?: string;
}

export function HackathonCard({ hackathon, className }: HackathonCardProps) {
  const platformLabel = PLATFORM_LABEL[hackathon.platform] ?? "Hackathon";
  const platformAccent = PLATFORM_ACCENT[hackathon.platform] ?? PLATFORM_ACCENT.devpost;
  const start = formatDate(hackathon.start_date);
  const deadline = formatDate(hackathon.deadline);
  const visibleTags = hackathon.tags.slice(0, 3);
  const extraTags = Math.max(0, hackathon.tags.length - visibleTags.length);
  const [imgError, setImgError] = useState(false);
  const urgency = getUrgency(hackathon.deadline);

  return (
    <Link
      href={`/events/${hackathon.id}`}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm transition-all duration-300",
        "hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.04] hover:shadow-xl hover:shadow-cyan-500/10",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.05] via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      />

      <div className="relative aspect-[16/9] w-full overflow-hidden bg-black/40">
        {hackathon.image_url && !imgError ? (
          <Image
            src={hackathon.image_url}
            alt={hackathon.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.08]"
            placeholder="blur"
            blurDataURL={BLUR_PLACEHOLDER}
            onError={() => setImgError(true)}
          />
        ) : (
          <div
            className={cn(
              "flex h-full w-full items-center justify-center bg-gradient-to-br text-white/80",
              platformAccent
            )}
          >
            <span className="tracking-luxury text-xl font-light">
              {platformLabel}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span className="rounded-full border border-white/15 bg-black/50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white/90 backdrop-blur-md">
            {platformLabel}
          </span>
          {hackathon.is_online ? (
            <span className="flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-emerald-200 backdrop-blur-md">
              <Wifi className="size-3" />
              Online
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full border border-white/15 bg-black/50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white/80 backdrop-blur-md">
              <MapPin className="size-3" />
              Presencial
            </span>
          )}
        </div>

        {urgency.level && (
          <div className="absolute right-3 top-3">
            <span
              className={cn(
                "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-md",
                urgency.level === "critical"
                  ? "animate-pulse border-rose-400/40 bg-rose-500/25 text-rose-200"
                  : "border-amber-400/35 bg-amber-500/20 text-amber-200"
              )}
            >
              <Clock className="size-3" />
              {urgency.label}
            </span>
          </div>
        )}
      </div>

      <div className="relative flex flex-1 flex-col gap-3 p-5">
        <h3 className="tracking-luxury line-clamp-2 text-[15px] font-medium leading-snug text-white/95">
          {hackathon.title}
        </h3>

        <div className="space-y-1.5 text-[12px] text-white/55">
          {start && (
            <div className="flex items-center gap-1.5">
              <Calendar className="size-3.5 text-white/30" />
              <span>Inicia {start}</span>
            </div>
          )}
          {deadline && (
            <div className="flex items-center gap-1.5">
              <Calendar className="size-3.5 text-white/30" />
              <span>Cierre {deadline}</span>
            </div>
          )}
          {hackathon.prize_pool && (
            <div className="flex items-center gap-1.5">
              <Trophy className="size-3.5 text-amber-300/80" />
              <span className="line-clamp-1 font-medium text-white/80">
                {hackathon.prize_pool}
              </span>
            </div>
          )}
        </div>

        {visibleTags.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-white/70"
              >
                {tag}
              </span>
            ))}
            {extraTags > 0 && (
              <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-white/45">
                +{extraTags}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
