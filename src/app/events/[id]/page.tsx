import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { notFound } from "next/navigation";

import { EventDetailOverlay } from "@/components/EventDetailOverlay";
import { getHackathonById } from "@/lib/db/queries";
import type { Platform } from "@/types/hackathon";

export const dynamic = "force-dynamic";

const PLATFORM_LABEL: Record<Platform, string> = {
  devpost: "Devpost",
  mlh: "MLH",
  eventbrite: "Eventbrite",
  luma: "Luma",
  gdg: "GDG",
  lablab: "Lablab.ai",
};

const PLATFORM_GRADIENT: Record<Platform, string> = {
  devpost: "from-blue-500 to-indigo-600",
  mlh: "from-rose-500 to-orange-600",
  eventbrite: "from-orange-500 to-amber-600",
  luma: "from-purple-500 to-fuchsia-600",
  gdg: "from-emerald-500 to-teal-600",
  lablab: "from-blue-600 to-cyan-500",
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
    <EventDetailOverlay
      hackathon={hackathon}
      platformLabel={PLATFORM_LABEL[platform]}
      platformGradient={PLATFORM_GRADIENT[platform]}
      description={description}
      start={start}
      end={end}
      deadline={deadline}
    />
  );
}
