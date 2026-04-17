"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
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
}

export function EventDetailOverlay({
  hackathon,
  platformLabel,
  platformGradient,
  description,
  start,
  end,
  deadline,
}: EventDetailOverlayProps) {
  const router = useRouter();

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

        <div className="relative aspect-[16/7] w-full overflow-hidden bg-black/30">
          {hackathon.image_url ? (
            <Image
              src={hackathon.image_url}
              alt={hackathon.title}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
              unoptimized
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
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          {label}
        </p>
        <p className="text-sm text-gray-200">{value}</p>
      </div>
    </div>
  );
}
