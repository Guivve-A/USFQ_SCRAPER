import axios from "axios";
import * as cheerio from "cheerio";
import { endOfDay, isValid, parse, parseISO, startOfDay } from "date-fns";

import type { Hackathon } from "@/types/hackathon";

const MLH_EVENTS_URL = "https://www.mlh.com/seasons/2026/events";
const REQUEST_TIMEOUT_MS = 10_000;
const USER_AGENT = "Mozilla/5.0 (compatible; HackFinder/1.0)";

type MlhCustomFields = {
  underserved_types?: string[];
};

type MlhEvent = {
  id?: string;
  name?: string;
  startsAt?: string;
  endsAt?: string;
  dateRange?: string;
  url?: string;
  location?: string;
  formatType?: string;
  backgroundUrl?: string | null;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  customFields?: MlhCustomFields;
};

type MlhDataPage = {
  props?: {
    upcomingEvents?: MlhEvent[];
  };
};

type ParsedRange = {
  start: string | null;
  end: string | null;
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

function toAbsoluteMlhUrl(path: string | undefined | null): string | null {
  if (!path) {
    return null;
  }

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  if (path.startsWith("/")) {
    return `https://www.mlh.com${path}`;
  }

  return `https://www.mlh.com/${path}`;
}

function decodeDataPageAttribute(encoded: string): string {
  return encoded
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2F;/g, "/");
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

function parseMonthDay(month: string, day: string, year: number): Date | null {
  const candidates = [
    parse(`${month} ${day} ${year}`, "MMM d yyyy", new Date()),
    parse(`${month} ${day} ${year}`, "MMMM d yyyy", new Date()),
  ];

  const found = candidates.find((date) => isValid(date));
  return found ?? null;
}

function parseMlhDateRange(
  dateRange: string | undefined | null,
  fallbackYear: number
): ParsedRange {
  const empty = { start: null, end: null };
  const value = cleanText(dateRange);

  if (!value) {
    return empty;
  }

  const compact = value.replace(/\u2013/g, "-").replace(/\s+/g, " ").trim();

  const sameMonth = compact.match(
    /^([A-Za-z]{3,9})\s+(\d{1,2})\s*-\s*(\d{1,2})$/
  );
  if (sameMonth) {
    const [, month, startDay, endDay] = sameMonth;
    const start = parseMonthDay(month, startDay, fallbackYear);
    const end = parseMonthDay(month, endDay, fallbackYear);

    if (start && end) {
      return {
        start: startOfDay(start).toISOString(),
        end: endOfDay(end).toISOString(),
      };
    }
  }

  const crossMonth = compact.match(
    /^([A-Za-z]{3,9})\s+(\d{1,2})\s*-\s*([A-Za-z]{3,9})\s+(\d{1,2})$/
  );
  if (crossMonth) {
    const [, startMonth, startDay, endMonth, endDay] = crossMonth;
    const start = parseMonthDay(startMonth, startDay, fallbackYear);
    const end = parseMonthDay(endMonth, endDay, fallbackYear);

    if (start && end) {
      return {
        start: startOfDay(start).toISOString(),
        end: endOfDay(end).toISOString(),
      };
    }
  }

  const singleDay = compact.match(/^([A-Za-z]{3,9})\s+(\d{1,2})$/);
  if (singleDay) {
    const [, month, day] = singleDay;
    const date = parseMonthDay(month, day, fallbackYear);

    if (date) {
      return {
        start: startOfDay(date).toISOString(),
        end: endOfDay(date).toISOString(),
      };
    }
  }

  return empty;
}

function mapMlhEvent(event: MlhEvent): Partial<Hackathon> | null {
  const title = cleanText(event.name);
  const url = toAbsoluteMlhUrl(event.url) ?? toAbsoluteMlhUrl(event.websiteUrl);

  if (!title || !url) {
    return null;
  }

  const formatType = cleanText(event.formatType)?.toLowerCase() ?? "";
  if (formatType !== "digital") {
    return null;
  }

  const yearFromStart = event.startsAt ? new Date(event.startsAt).getUTCFullYear() : null;
  const fallbackYear = Number.isFinite(yearFromStart) && yearFromStart
    ? yearFromStart
    : new Date().getUTCFullYear();

  const parsedRange = parseMlhDateRange(event.dateRange, fallbackYear);
  const startDate = parseIsoDate(event.startsAt) ?? parsedRange.start;
  const endDate = parseIsoDate(event.endsAt) ?? parsedRange.end;
  const description = cleanText(
    [cleanText(event.location), cleanText(event.dateRange)].filter(Boolean).join(" - ")
  );

  const tags = [
    "Digital",
    ...((event.customFields?.underserved_types ?? []).map((item) => cleanText(item) ?? "")),
  ].filter((item) => item.length > 0);

  const mapped: Partial<Hackathon> = {
    title,
    url,
    platform: "mlh",
    start_date: startDate,
    end_date: endDate,
    deadline: endDate,
    location: cleanText(event.location) ?? "Online",
    is_online: true,
    tags,
    image_url: cleanText(event.logoUrl) ?? cleanText(event.backgroundUrl),
    organizer: "MLH",
  };

  if (description) {
    mapped.description = description;
  }

  return mapped;
}

export async function scrapeMLH(): Promise<Partial<Hackathon>[]> {
  const { data: html } = await http.get<string>(MLH_EVENTS_URL, {
    responseType: "text",
  });

  const $ = cheerio.load(html);
  const dataPage = $("[data-page]").first().attr("data-page");

  if (!dataPage) {
    throw new Error("MLH page is missing embedded data-page payload.");
  }

  const decoded = decodeDataPageAttribute(dataPage);
  const parsed = JSON.parse(decoded) as MlhDataPage;
  const upcomingEvents = parsed?.props?.upcomingEvents ?? [];

  const mapped = upcomingEvents
    .map(mapMlhEvent)
    .filter((item): item is Partial<Hackathon> => item !== null);

  const byUrl = new Map<string, Partial<Hackathon>>();
  for (const item of mapped) {
    if (!item.url || byUrl.has(item.url)) {
      continue;
    }
    byUrl.set(item.url, item);
  }

  console.info(
    `[scrapers][mlh] Parsed ${upcomingEvents.length} events, kept ${byUrl.size} digital events.`
  );

  return Array.from(byUrl.values());
}
