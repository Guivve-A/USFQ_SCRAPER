import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Calendar, ExternalLink, MapPin, Trophy, Users, Wifi } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ChatWidget } from "@/components/ChatWidget";
import { SiteHeader } from "@/components/SiteHeader";
import { TranslateButton } from "@/components/TranslateButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getHackathonById } from "@/lib/db/queries";
import { cn } from "@/lib/utils";
import type { Platform } from "@/types/hackathon";

export const dynamic = "force-dynamic";

const PLATFORM_LABEL: Record<Platform, string> = {
  devpost: "Devpost",
  mlh: "MLH",
  eventbrite: "Eventbrite",
  luma: "Luma",
  gdg: "GDG",
};

const PLATFORM_GRADIENT: Record<Platform, string> = {
  devpost: "from-blue-500 to-indigo-600",
  mlh: "from-rose-500 to-orange-600",
  eventbrite: "from-orange-500 to-amber-600",
  luma: "from-purple-500 to-fuchsia-600",
  gdg: "from-emerald-500 to-teal-600",
};

function fmt(value: string | null): string | null {
  if (!value) return null;
  try {
    return format(parseISO(value), "d 'de' MMMM, yyyy", { locale: es });
  } catch {
    return null;
  }
}

function stripHtml(text: string | null): string {
  if (!text) return "";
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) notFound();

  const hackathon = await getHackathonById(numericId);
  if (!hackathon) notFound();

  const platform = hackathon.platform;
  const description = stripHtml(hackathon.description);
  const start = fmt(hackathon.start_date);
  const end = fmt(hackathon.end_date);
  const deadline = fmt(hackathon.deadline);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <Link
          href="/events"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 transition hover:text-indigo-600"
        >
          <ArrowLeft className="size-4" />
          Volver al listado
        </Link>

        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="relative aspect-[16/7] w-full overflow-hidden bg-zinc-100">
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
                  PLATFORM_GRADIENT[platform]
                )}
              >
                <span className="text-2xl font-semibold tracking-wide">
                  {PLATFORM_LABEL[platform]}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-indigo-100 text-indigo-800">
                {PLATFORM_LABEL[platform]}
              </Badge>
              {hackathon.is_online ? (
                <Badge className="bg-emerald-100 text-emerald-800">
                  <Wifi className="mr-1 size-3" />
                  Online
                </Badge>
              ) : (
                <Badge className="bg-zinc-100 text-zinc-700">
                  <MapPin className="mr-1 size-3" />
                  Presencial
                </Badge>
              )}
              {hackathon.location && (
                <span className="text-sm text-zinc-600">
                  · {hackathon.location}
                </span>
              )}
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
              {hackathon.title}
            </h1>

            <div className="grid grid-cols-1 gap-4 rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 sm:grid-cols-2">
              {start && (
                <Stat icon={<Calendar className="size-4 text-indigo-600" />} label="Inicia" value={start} />
              )}
              {end && (
                <Stat icon={<Calendar className="size-4 text-indigo-600" />} label="Finaliza" value={end} />
              )}
              {deadline && (
                <Stat icon={<Calendar className="size-4 text-rose-600" />} label="Cierre de inscripción" value={deadline} />
              )}
              {hackathon.prize_pool && (
                <Stat
                  icon={<Trophy className="size-4 text-amber-500" />}
                  label="Premios"
                  value={hackathon.prize_pool}
                />
              )}
              {hackathon.organizer && (
                <Stat
                  icon={<Users className="size-4 text-zinc-500" />}
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
                    className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {description && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-zinc-900">
                  Descripción
                </h2>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
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
              <Button
                asChild
                className="bg-indigo-600 text-white hover:bg-indigo-500"
              >
                <a
                  href={hackathon.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ver hackathon
                  <ExternalLink className="size-4" />
                </a>
              </Button>
              <Link
                href="/events"
                className="text-sm font-medium text-zinc-600 hover:text-indigo-600"
              >
                ← Explorar más eventos
              </Link>
            </div>
          </div>
        </div>
      </main>
      <ChatWidget />
    </>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {label}
        </p>
        <p className="text-sm text-zinc-800">{value}</p>
      </div>
    </div>
  );
}
