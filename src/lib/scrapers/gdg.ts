import axios from "axios";
import { isValid, parseISO } from "date-fns";

import type { Hackathon } from "@/types/hackathon";

const GDG_BASE_URL = "https://gdg.community.dev";
const GDG_CHAPTER_SLUGS = ["gdg-quito", "gdg-guayaquil"] as const;
const REQUEST_TIMEOUT_MS = 10_000;
const USER_AGENT = "Mozilla/5.0 (compatible; HackFinder/1.0)";

type GdgChapter = {
  id: number;
  title?: string;
  city?: string;
};

type GdgEvent = {
  title?: string;
  start_date?: string;
  event_type_title?: string;
  url?: string;
  cohost_registration_url?: string;
  description?: string;
  description_short?: string;
  cropped_picture_url?: string;
  cropped_banner_url?: string;
};

type GdgEventResponse = {
  next?: string | null;
  results?: GdgEvent[];
};

const http = axios.create({
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    "User-Agent": USER_AGENT,
  },
});

function cleanText(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function stripHtml(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }

  return cleanText(value.replace(/<[^>]*>/g, " "));
}

function toAbsoluteUrl(url: string | undefined | null): string | null {
  const cleaned = cleanText(url);
  if (!cleaned) {
    return null;
  }

  if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
    return cleaned;
  }

  if (cleaned.startsWith("/")) {
    return `${GDG_BASE_URL}${cleaned}`;
  }

  return `${GDG_BASE_URL}/${cleaned}`;
}

function parseIsoDate(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }

  const parsed = parseISO(value);
  if (!isValid(parsed)) {
    return null;
  }

  return parsed.toISOString();
}

async function fetchChapter(slug: string): Promise<GdgChapter> {
  const { data } = await http.get<GdgChapter>(`${GDG_BASE_URL}/api/chapter_slim/${slug}/`);
  if (!data?.id) {
    throw new Error(`GDG chapter ${slug} returned no chapter id.`);
  }
  return data;
}

async function fetchLiveEvents(chapterId: number): Promise<GdgEvent[]> {
  const all: GdgEvent[] = [];
  const maxPages = 5;

  for (let page = 1; page <= maxPages; page += 1) {
    const { data } = await http.get<GdgEventResponse>(
      `${GDG_BASE_URL}/api/event_slim/for_chapter/${chapterId}/`,
      {
        params: {
          page_size: 20,
          status: "Live",
          include_cohosted_events: true,
          visible_on_parent_chapter_only: true,
          order: "start_date",
          fields:
            "title,start_date,event_type_title,cropped_picture_url,cropped_banner_url,url,cohost_registration_url,description,description_short",
          page,
        },
      }
    );

    const items = data?.results ?? [];
    if (items.length === 0) {
      break;
    }

    all.push(...items);

    if (!data?.next) {
      break;
    }
  }

  return all;
}

const HACKATHON_KEYWORDS =
  /hack|program\s*a\s*th|code\s*jam|devfest|buildathon|ideathon|codeathon|code\s*sprint/i;

function isHackathonCandidate(title: string | null, description: string | null, eventType: string | null): boolean {
  const haystack = `${title ?? ""} ${description ?? ""} ${eventType ?? ""}`;
  return HACKATHON_KEYWORDS.test(haystack);
}

function mapGdgEvent(event: GdgEvent, chapter: GdgChapter): Partial<Hackathon> | null {
  const title = cleanText(event.title);
  const url = toAbsoluteUrl(event.url) ?? toAbsoluteUrl(event.cohost_registration_url);

  if (!title || !url) {
    return null;
  }

  const description = stripHtml(event.description) ?? stripHtml(event.description_short);
  const eventType = cleanText(event.event_type_title);

  if (!isHackathonCandidate(title, description, eventType)) {
    return null;
  }
  const startDate = parseIsoDate(event.start_date);
  const typeTag = cleanText(event.event_type_title);

  const mapped: Partial<Hackathon> = {
    title,
    url,
    platform: "gdg",
    start_date: startDate,
    end_date: null,
    deadline: startDate,
    location: "Ecuador",
    is_online: /online|virtual|remote/i.test(`${title} ${description ?? ""}`),
    tags: [typeTag ?? ""].filter((tag) => tag.length > 0),
    image_url: cleanText(event.cropped_picture_url) ?? cleanText(event.cropped_banner_url),
    organizer: cleanText(chapter.title),
  };

  if (description) {
    mapped.description = description;
  }

  return mapped;
}

export async function scrapeGDG(): Promise<Partial<Hackathon>[]> {
  const output: Partial<Hackathon>[] = [];
  const chapterErrors: string[] = [];

  for (const slug of GDG_CHAPTER_SLUGS) {
    try {
      const chapter = await fetchChapter(slug);
      const events = await fetchLiveEvents(chapter.id);

      const mapped = events
        .map((event) => mapGdgEvent(event, chapter))
        .filter((item): item is Partial<Hackathon> => item !== null);

      console.info(
        `[scrapers][gdg] ${slug}: fetched ${events.length}, mapped ${mapped.length}.`
      );
      output.push(...mapped);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown GDG scraper failure";
      chapterErrors.push(`${slug}: ${message}`);
    }
  }

  if (output.length === 0 && chapterErrors.length > 0) {
    throw new Error(chapterErrors.join(" | "));
  }

  const byUrl = new Map<string, Partial<Hackathon>>();
  for (const item of output) {
    if (!item.url || byUrl.has(item.url)) {
      continue;
    }
    byUrl.set(item.url, item);
  }

  return Array.from(byUrl.values());
}
