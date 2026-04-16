"use client";

import Image from "next/image";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, MapPin, Trophy, Wifi } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Hackathon, Platform } from "@/types/hackathon";

const PLATFORM_STYLES: Record<Platform, { label: string; bg: string; text: string; gradient: string }> = {
  devpost: {
    label: "Devpost",
    bg: "bg-blue-100",
    text: "text-blue-800",
    gradient: "from-blue-500 to-indigo-600",
  },
  mlh: {
    label: "MLH",
    bg: "bg-rose-100",
    text: "text-rose-800",
    gradient: "from-rose-500 to-orange-600",
  },
  eventbrite: {
    label: "Eventbrite",
    bg: "bg-orange-100",
    text: "text-orange-800",
    gradient: "from-orange-500 to-amber-600",
  },
  luma: {
    label: "Luma",
    bg: "bg-purple-100",
    text: "text-purple-800",
    gradient: "from-purple-500 to-fuchsia-600",
  },
  gdg: {
    label: "GDG",
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    gradient: "from-emerald-500 to-teal-600",
  },
};

function formatDate(value: string | null): string | null {
  if (!value) return null;
  try {
    return format(parseISO(value), "d MMM yyyy", { locale: es });
  } catch {
    return null;
  }
}

export interface HackathonCardProps {
  hackathon: Hackathon;
  className?: string;
}

export function HackathonCard({ hackathon, className }: HackathonCardProps) {
  const platform = PLATFORM_STYLES[hackathon.platform] ?? PLATFORM_STYLES.devpost;
  const start = formatDate(hackathon.start_date);
  const deadline = formatDate(hackathon.deadline);
  const visibleTags = hackathon.tags.slice(0, 3);
  const extraTags = Math.max(0, hackathon.tags.length - visibleTags.length);

  return (
    <Card
      className={cn(
        "group flex h-full flex-col overflow-hidden border-zinc-200/80 transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg",
        className
      )}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-zinc-100">
        {hackathon.image_url ? (
          <Image
            src={hackathon.image_url}
            alt={hackathon.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div
            className={cn(
              "flex h-full w-full items-center justify-center bg-gradient-to-br text-white",
              platform.gradient
            )}
          >
            <span className="text-lg font-semibold tracking-wide">
              {platform.label}
            </span>
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <Badge className={cn("border-0 shadow-sm", platform.bg, platform.text)}>
            {platform.label}
          </Badge>
          {hackathon.is_online ? (
            <Badge className="border-0 bg-emerald-100 text-emerald-800 shadow-sm">
              <Wifi className="mr-1 size-3" />
              Online
            </Badge>
          ) : (
            <Badge className="border-0 bg-zinc-100 text-zinc-700 shadow-sm">
              <MapPin className="mr-1 size-3" />
              Presencial
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-zinc-900">
          {hackathon.title}
        </h3>

        <div className="space-y-1.5 text-xs text-zinc-600">
          {start && (
            <div className="flex items-center gap-1.5">
              <Calendar className="size-3.5 text-zinc-400" />
              <span>Inicia {start}</span>
            </div>
          )}
          {deadline && (
            <div className="flex items-center gap-1.5">
              <Calendar className="size-3.5 text-zinc-400" />
              <span>Cierre {deadline}</span>
            </div>
          )}
          {hackathon.prize_pool && (
            <div className="flex items-center gap-1.5">
              <Trophy className="size-3.5 text-amber-500" />
              <span className="line-clamp-1 font-medium text-zinc-800">
                {hackathon.prize_pool}
              </span>
            </div>
          )}
        </div>

        {visibleTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700"
              >
                {tag}
              </span>
            ))}
            {extraTags > 0 && (
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-500">
                +{extraTags}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto pt-2">
          <Button asChild size="sm" className="w-full bg-indigo-600 text-white hover:bg-indigo-500">
            <Link href={`/events/${hackathon.id}`}>Ver más</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
