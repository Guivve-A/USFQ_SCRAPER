import axios from "axios";
import { isValid, parseISO } from "date-fns";

import type { Hackathon } from "@/types/hackathon";

const GDG_BASE_URL = "https://gdg.community.dev";
const GDG_CHAPTER_SLUGS = [
  "gdg-quito",
  "gdg-guayaquil",
  "gdg-mexico-city",
  "gdg-bogota",
  "gdg-buenos-aires",
  "gdg-sao-paulo",
  "gdg-santiago",
  "gdg-madrid",
  "gdg-london",
  "gdg-berlin",
  "gdg-bangalore",
  "gdg-tokyo",
  "gdg-bay-area",
  "gdg-new-york",
] as const;
const REQUEST_TIMEOUT_MS = 10_000;
const USER_AGENT = "Mozilla/5.0 (compatible; HackFinder/1.0)";

export type GdgDropReason =
  | "missing-title"
  | "missing-url"
  | "not-hackathon-candidate";

export type GdgDropTrace = {
  chapterSlug: string;
  reason: GdgDropReason;
  title: string | null;
  url: string | null;
  eventType: string | null;
  details: string | null;
};

export type GdgScrapeDiagnostics = {
  fetched: number;
  mapped: number;
  dropped: number;
  dropReasons: Record<GdgDropReason, number>;
  drops: GdgDropTrace[];
  errors: string[];
};

export type GdgScrapeWithDiagnosticsResult = {
  items: Partial<Hackathon>[];
  diagnostics: GdgScrapeDiagnostics;
};

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
  /hack|program\s*a\s*th|code\s*jam|devfest|buildathon|ideathon|codeathon|code\s*sprint|build\s*with\s*ai/i;

function isHackathonCandidate(title: string | null, description: string | null, eventType: string | null): boolean {
  const haystack = `${title ?? ""} ${description ?? ""} ${eventType ?? ""}`;
  return HACKATHON_KEYWORDS.test(haystack);
}

type GdgMapResult =
  | { ok: true; item: Partial<Hackathon> }
  | {
      ok: false;
      reason: GdgDropReason;
      title: string | null;
      url: string | null;
      eventType: string | null;
      details: string | null;
    };

function mapGdgEvent(event: GdgEvent, chapter: GdgChapter): GdgMapResult {
  const title = cleanText(event.title);
  const url = toAbsoluteUrl(event.url) ?? toAbsoluteUrl(event.cohost_registration_url);
  const eventType = cleanText(event.event_type_title);

  if (!title) {
    return {
      ok: false,
      reason: "missing-title",
      title: null,
      url,
      eventType,
      details: "Event has no normalized title.",
    };
  }

  if (!url) {
    return {
      ok: false,
      reason: "missing-url",
      title,
      url: null,
      eventType,
      details: "Event has no canonical URL or cohost URL.",
    };
  }

  const description = stripHtml(event.description) ?? stripHtml(event.description_short);

  if (!isHackathonCandidate(title, description, eventType)) {
    return {
      ok: false,
      reason: "not-hackathon-candidate",
      title,
      url,
      eventType,
      details: "Title/description/event type did not match hackathon keywords.",
    };
  }

  const startDate = parseIsoDate(event.start_date);
  const typeTag = cleanText(event.event_type_title);

  const chapterCity = cleanText(chapter.city);
  const isOnline = /online|virtual|remote/i.test(`${title} ${description ?? ""}`);

  const mapped: Partial<Hackathon> = {
    title,
    url,
    platform: "gdg",
    start_date: startDate,
    end_date: null,
    deadline: startDate,
    location: chapterCity,
    is_online: isOnline,
    tags: [typeTag ?? ""].filter((tag) => tag.length > 0),
    image_url: cleanText(event.cropped_picture_url) ?? cleanText(event.cropped_banner_url),
    organizer: cleanText(chapter.title),
  };

  if (description) {
    mapped.description = description;
  }

  return { ok: true, item: mapped };
}

export async function scrapeGDGWithDiagnostics(): Promise<GdgScrapeWithDiagnosticsResult> {
  const output: Partial<Hackathon>[] = [];
  const drops: GdgDropTrace[] = [];
  const chapterErrors: string[] = [];
  const dropReasons: Record<GdgDropReason, number> = {
    "missing-title": 0,
    "missing-url": 0,
    "not-hackathon-candidate": 0,
  };
  let fetched = 0;

  for (const slug of GDG_CHAPTER_SLUGS) {
    try {
      const chapter = await fetchChapter(slug);
      const events = await fetchLiveEvents(chapter.id);
      fetched += events.length;

      let mapped = 0;

      for (const event of events) {
        const result = mapGdgEvent(event, chapter);
        if (result.ok) {
          output.push(result.item);
          mapped += 1;
          continue;
        }

        dropReasons[result.reason] += 1;
        drops.push({
          chapterSlug: slug,
          reason: result.reason,
          title: result.title,
          url: result.url,
          eventType: result.eventType,
          details: result.details,
        });
      }

      console.info(
        `[scrapers][gdg] ${slug}: fetched ${events.length}, mapped ${mapped}, dropped ${events.length - mapped}.`
      );
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

  if (drops.length > 0) {
    console.info(
      `[scrapers][gdg] drop reasons: ${Object.entries(dropReasons)
        .map(([reason, count]) => `${reason}=${count}`)
        .join(", ")}`
    );

    for (const drop of drops.slice(0, 10)) {
      console.info(
        `[scrapers][gdg][drop] chapter=${drop.chapterSlug} reason=${drop.reason} title="${drop.title ?? "N/A"}" url="${drop.url ?? "N/A"}" eventType="${drop.eventType ?? "N/A"}"`
      );
    }
  }

  return {
    items: Array.from(byUrl.values()),
    diagnostics: {
      fetched,
      mapped: byUrl.size,
      dropped: drops.length,
      dropReasons,
      drops,
      errors: chapterErrors,
    },
  };
}

export async function scrapeGDG(): Promise<Partial<Hackathon>[]> {
  const result = await scrapeGDGWithDiagnostics();
  return result.items;
}
