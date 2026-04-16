import axios from "axios";
import { endOfDay, isValid, parse, startOfDay } from "date-fns";

import type { Hackathon } from "@/types/hackathon";

const DEVPOST_API_URL = "https://devpost.com/api/hackathons";
const LEGACY_JSON_URL =
  "https://WebDevHarsha.github.io/open-hackathons-api/data-online.json";
const REQUEST_TIMEOUT_MS = 10_000;
const USER_AGENT = "Mozilla/5.0 (compatible; HackFinder/1.0)";
const MAX_PAGES = 25;

type DevpostTheme = { id?: number; name?: string };

type DevpostDisplayedLocation =
  | string
  | { icon?: string; location?: string };

type DevpostApiHackathon = {
  id?: number;
  url?: string;
  title?: string;
  thumbnail_url?: string;
  organization_name?: string;
  submission_period_dates?: string;
  displayed_location?: DevpostDisplayedLocation;
  prize_amount?: string;
  prizeText?: string;
  themes?: DevpostTheme[];
  time_left_to_submission?: string;
  open_state?: string;
  winners_announced?: boolean;
  invite_only?: boolean;
};

type DevpostApiResponse = {
  hackathons?: DevpostApiHackathon[];
  meta?: {
    total_count?: number;
    per_page?: number;
  };
  data?: DevpostApiHackathon[];
};

type ParsedDateRange = {
  start_date: string | null;
  end_date: string | null;
  deadline: string | null;
};

const http = axios.create({
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    "User-Agent": USER_AGENT,
    Accept: "application/json",
  },
});

function toAbsoluteUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `https://devpost.com${url}`;
  return url;
}

function cleanText(value: string | undefined | null): string | null {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function stripHtml(value: string | undefined | null): string | null {
  if (!value) return null;
  return cleanText(value.replace(/<[^>]*>/g, " "));
}

function extractLocation(location: DevpostDisplayedLocation | undefined): string | null {
  if (!location) return null;
  if (typeof location === "string") return cleanText(location);
  return cleanText(location.location);
}

function parseMonthDayYear(month: string, day: string, year: string): Date | null {
  const candidates = [
    parse(`${month} ${day} ${year}`, "MMM d yyyy", new Date()),
    parse(`${month} ${day} ${year}`, "MMMM d yyyy", new Date()),
  ];
  return candidates.find((d) => isValid(d)) ?? null;
}

function parseSubmissionDateRange(input: string | undefined | null): ParsedDateRange {
  const empty = { start_date: null, end_date: null, deadline: null };
  const raw = cleanText(input);
  if (!raw) return empty;

  const compact = raw.replace(/\u2013/g, "-").replace(/\s+/g, " ").trim();

  const patterns = [
    { re: /^([A-Za-z]{3,9})\s+(\d{1,2})\s*-\s*(\d{1,2}),\s*(\d{4})$/, kind: "same-month" as const },
    { re: /^([A-Za-z]{3,9})\s+(\d{1,2})\s*-\s*([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})$/, kind: "cross-month" as const },
    { re: /^([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})\s*-\s*([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})$/, kind: "full" as const },
  ];

  for (const { re, kind } of patterns) {
    const match = compact.match(re);
    if (!match) continue;

    let start: Date | null = null;
    let end: Date | null = null;

    if (kind === "same-month") {
      const [, month, sd, ed, y] = match;
      start = parseMonthDayYear(month, sd, y);
      end = parseMonthDayYear(month, ed, y);
    } else if (kind === "cross-month") {
      const [, sm, sd, em, ed, y] = match;
      start = parseMonthDayYear(sm, sd, y);
      end = parseMonthDayYear(em, ed, y);
    } else {
      const [, sm, sd, sy, em, ed, ey] = match;
      start = parseMonthDayYear(sm, sd, sy);
      end = parseMonthDayYear(em, ed, ey);
    }

    if (start && end) {
      return {
        start_date: startOfDay(start).toISOString(),
        end_date: endOfDay(end).toISOString(),
        deadline: endOfDay(end).toISOString(),
      };
    }
  }

  return empty;
}

function dedupeByUrl(items: Partial<Hackathon>[]): Partial<Hackathon>[] {
  const byUrl = new Map<string, Partial<Hackathon>>();
  for (const item of items) {
    if (!item.url) continue;
    const existing = byUrl.get(item.url);
    if (!existing) {
      byUrl.set(item.url, item);
      continue;
    }
    byUrl.set(item.url, {
      ...existing,
      ...item,
      tags: Array.from(new Set([...(existing.tags ?? []), ...(item.tags ?? [])])),
    });
  }
  return Array.from(byUrl.values());
}

function mapDevpostHackathon(item: DevpostApiHackathon): Partial<Hackathon> | null {
  if (item.winners_announced) return null;
  if (item.invite_only) return null;

  const url = toAbsoluteUrl(item.url);
  const title = cleanText(item.title);
  if (!url || !title) return null;

  const dates = parseSubmissionDateRange(item.submission_period_dates);
  const prize = stripHtml(item.prize_amount ?? item.prizeText);
  const tags = (item.themes ?? [])
    .map((t) => cleanText(t.name) ?? "")
    .filter((t) => t.length > 0);

  const location = extractLocation(item.displayed_location) ?? "Online";
  const isOnline = /online|worldwide|virtual|remote/i.test(location);
  const organizer = cleanText(item.organization_name);

  const descriptionParts = [organizer, cleanText(item.time_left_to_submission)].filter(
    (p): p is string => Boolean(p)
  );

  const mapped: Partial<Hackathon> = {
    title,
    url,
    platform: "devpost",
    start_date: dates.start_date,
    end_date: dates.end_date,
    deadline: dates.deadline,
    location,
    is_online: isOnline,
    prize_pool: prize,
    tags,
    image_url: toAbsoluteUrl(item.thumbnail_url),
    organizer,
  };

  if (descriptionParts.length > 0) {
    mapped.description = descriptionParts.join(" - ");
  }

  return mapped;
}

async function fetchDevpostPage(page: number): Promise<DevpostApiHackathon[]> {
  const { data } = await http.get<DevpostApiResponse>(DEVPOST_API_URL, {
    params: {
      "status[]": ["open", "upcoming"],
      order_by: "deadline",
      page,
    },
  });
  return data.hackathons ?? data.data ?? [];
}

async function scrapeDevpostFromOfficialApi(): Promise<Partial<Hackathon>[]> {
  const collected: Partial<Hackathon>[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const items = await fetchDevpostPage(page);
    if (items.length === 0) {
      break;
    }

    for (const item of items) {
      const mapped = mapDevpostHackathon(item);
      if (mapped) collected.push(mapped);
    }

    if (items.length < 9) {
      break;
    }
  }

  return dedupeByUrl(collected);
}

async function scrapeDevpostFromLegacyJson(): Promise<Partial<Hackathon>[]> {
  const { data } = await http.get<DevpostApiResponse>(LEGACY_JSON_URL);
  const list = Array.isArray(data?.hackathons)
    ? data.hackathons
    : Array.isArray(data?.data)
      ? data.data
      : [];

  if (list.length === 0) {
    throw new Error("Legacy JSON endpoint returned an empty list.");
  }

  const mapped = list
    .map(mapDevpostHackathon)
    .filter((x): x is Partial<Hackathon> => x !== null);
  return dedupeByUrl(mapped);
}

export async function scrapeDevpost(): Promise<Partial<Hackathon>[]> {
  try {
    const fromOfficialApi = await scrapeDevpostFromOfficialApi();
    if (fromOfficialApi.length > 0) {
      console.info(
        `[scrapers][devpost] Official API returned ${fromOfficialApi.length} items.`
      );
      return fromOfficialApi;
    }
  } catch (error) {
    console.warn("[scrapers][devpost] Official API failed, trying legacy JSON.", error);
  }

  const legacy = await scrapeDevpostFromLegacyJson();
  console.info(
    `[scrapers][devpost] Legacy JSON strategy returned ${legacy.length} items.`
  );
  return legacy;
}
