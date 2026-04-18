"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Calendar,
  ExternalLink,
  MapPin,
  Trophy,
  Users,
  Wifi,
  X,
} from "lucide-react";

import { TranslateButton } from "@/components/TranslateButton";
import { cn } from "@/lib/utils";
import type { Hackathon } from "@/types/hackathon";

export interface EventDetailOverlayProps {
  hackathon: Hackathon;
  platformLabel: string;
  platformGradient: string;
  description: string;
  start: string | null;
  end: string | null;
  deadline: string | null;
  relatedEvents?: Hackathon[];
}

const BLUR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function daysUntil(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const ms = new Date(isoDate).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function DeadlineBadge({ days }: { days: number }) {
  if (days <= 0) return null;
  if (days <= 3)
    return (
      <span className="inline-flex animate-pulse items-center rounded-full bg-rose-500/20 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
        {days === 1 ? "¡Último día!" : `${days} días`}
      </span>
    );
  if (days <= 14)
    return (
      <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
        {days} días
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full bg-cyan-500/15 px-2 py-0.5 text-[11px] font-medium text-cyan-400">
      {days} días
    </span>
  );
}

export function EventDetailOverlay({
  hackathon,
  platformLabel,
  platformGradient,
  description,
  start,
  end,
  deadline,
  relatedEvents = [],
}: EventDetailOverlayProps) {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);

  const deadlineDays = daysUntil(hackathon.deadline);

  function handleClose() {
    router.back();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-detail-title"
        className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-[#121212] text-gray-300 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Cerrar detalle"
          onClick={handleClose}
          className="absolute right-4 top-4 z-20 inline-flex size-9 items-center justify-center rounded-full border border-white/15 bg-black/35 text-gray-300 transition-all hover:border-white/35 hover:text-white"
        >
          <X className="size-4" />
        </button>

        {/* Hero image */}
        <div className="relative aspect-[16/7] w-full overflow-hidden bg-black/30">
          {hackathon.image_url && !imgError ? (
            <Image
              src={hackathon.image_url}
              alt={hackathon.title}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
              placeholder="blur"
              blurDataURL={BLUR_DATA_URL}
              onError={() => setImgError(true)}
            />
          ) : (
            <div
              className={cn(
                "flex h-full w-full items-center justify-center bg-gradient-to-br text-white",
                platformGradient
              )}
            >
              <span className="text-2xl font-semibold tracking-wide">
                {platformLabel}
              </span>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
        </div>

        <div className="space-y-6 p-6 sm:p-8">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white">
              {platformLabel}
            </span>
            {hackathon.is_online ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
                <Wifi className="size-3.5" />
                Online
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-gray-200">
                <MapPin className="size-3.5" />
                Presencial
              </span>
            )}
            {hackathon.location && (
              <span className="text-xs text-gray-400">{hackathon.location}</span>
            )}
          </div>

          <h1
            id="event-detail-title"
            className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl"
          >
            {hackathon.title}
          </h1>

          {/* Stats grid */}
          <div className="grid grid-cols-1 gap-4 rounded-xl border border-white/5 bg-white/5 p-4 sm:grid-cols-2">
            {start && (
              <Stat
                icon={<Calendar className="size-4 text-cyan-300" />}
                label="Inicia"
                value={start}
              />
            )}
            {end && (
              <Stat
                icon={<Calendar className="size-4 text-cyan-300" />}
                label="Finaliza"
                value={end}
              />
            )}
            {deadline && (
              <Stat
                icon={<Calendar className="size-4 text-rose-300" />}
                label="Cierre de inscripción"
                value={deadline}
                badge={
                  deadlineDays !== null && deadlineDays > 0 ? (
                    <DeadlineBadge days={deadlineDays} />
                  ) : undefined
                }
              />
            )}
            {hackathon.prize_pool && (
              <Stat
                icon={<Trophy className="size-4 text-amber-300" />}
                label="Premios"
                value={hackathon.prize_pool}
              />
            )}
            {hackathon.organizer && (
              <Stat
                icon={<Users className="size-4 text-gray-400" />}
                label="Organiza"
                value={hackathon.organizer}
              />
            )}
          </div>

          {/* Tags */}
          {hackathon.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {hackathon.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-cyan-500/20 bg-cyan-900/30 px-3 py-1 text-sm text-cyan-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          {description && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-white">Descripción</h2>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-300">
                {description}
              </p>
            </section>
          )}

          {description && (
            <TranslateButton
              hackathonId={Number(hackathon.id)}
              description={description}
              initialTranslation={hackathon.desc_translated}
            />
          )}

          {/* CTA */}
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
            <a
              href={hackathon.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2 font-medium text-white shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all hover:bg-blue-500 hover:shadow-[0_0_25px_rgba(37,99,235,0.6)]"
            >
              Ver hackathon
              <ExternalLink className="size-4" />
            </a>
            <button
              type="button"
              onClick={handleClose}
              className="text-sm font-medium text-gray-400 transition-colors hover:text-white"
            >
              Cerrar
            </button>
          </div>

          {/* Related events */}
          {relatedEvents.length > 0 && (
            <section className="space-y-3 border-t border-white/8 pt-6">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-white/50">
                Más de {platformLabel}
              </h2>
              <ul className="space-y-2">
                {relatedEvents.map((ev) => (
                  <li key={ev.id}>
                    <Link
                      href={`/events/${ev.id}`}
                      className="group flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.03] px-4 py-3 transition-colors hover:border-white/10 hover:bg-white/[0.06]"
                    >
                      <span className="flex-1 text-sm font-medium leading-snug text-gray-200 group-hover:text-white line-clamp-2">
                        {ev.title}
                      </span>
                      <span className="shrink-0 text-xs text-gray-500">
                        {ev.deadline
                          ? new Date(ev.deadline).toLocaleDateString("es-EC", {
                              day: "numeric",
                              month: "short",
                            })
                          : ev.start_date
                            ? new Date(ev.start_date).toLocaleDateString(
                                "es-EC",
                                { day: "numeric", month: "short" }
                              )
                            : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  badge,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  badge?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5">{icon}</div>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          {label}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm text-gray-200">{value}</p>
          {badge}
        </div>
      </div>
    </div>
  );
}
