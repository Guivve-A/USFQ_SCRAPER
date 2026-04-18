import type { Hackathon, Platform } from "@/types/hackathon";

const TITLE_MAX = 500;
const DESCRIPTION_MAX = 20_000;
const LOCATION_MAX = 300;
const PRIZE_POOL_MAX = 200;
const ORGANIZER_MAX = 200;
const IMAGE_URL_MAX = 2_000;
const TAG_MAX = 80;
const TAGS_MAX = 20;

const MIN_YEAR = 2020;
const MAX_YEAR = 2030;

const PLATFORMS: readonly Platform[] = [
  "devpost",
  "mlh",
  "eventbrite",
  "luma",
  "gdg",
  "lablab",
];

export interface SanitizeReport {
  dateFieldsDropped: string[];
  clampedFields: string[];
  droppedTagCount: number;
}

export interface SanitizedResult {
  row: Omit<Hackathon, "id" | "created_at"> | null;
  rejectionReason: string | null;
  report: SanitizeReport;
}

function clampString(
  value: string | null | undefined,
  max: number,
  field: string,
  report: SanitizeReport
): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length <= max) return trimmed;
  report.clampedFields.push(field);
  return trimmed.slice(0, max);
}

function sanitizeIsoDate(
  value: string | null | undefined,
  field: string,
  report: SanitizeReport
): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (trimmed.length === 0) return null;

  const parsed = new Date(trimmed);
  const time = parsed.getTime();
  if (!Number.isFinite(time)) {
    report.dateFieldsDropped.push(field);
    return null;
  }

  const year = parsed.getUTCFullYear();
  if (year < MIN_YEAR || year > MAX_YEAR) {
    report.dateFieldsDropped.push(field);
    return null;
  }

  return parsed.toISOString();
}

function sanitizePrizeAmount(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  if (value < 0) return null;
  if (value > 1_000_000_000) return null;
  return value;
}

function sanitizeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function sanitizeTags(
  value: readonly string[] | null | undefined,
  report: SanitizeReport
): string[] {
  if (!value || !Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  let dropped = 0;
  for (const raw of value) {
    if (typeof raw !== "string") {
      dropped += 1;
      continue;
    }
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length > TAG_MAX) {
      dropped += 1;
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= TAGS_MAX) break;
  }
  report.droppedTagCount = dropped;
  return out;
}

function sanitizePlatform(value: string | null | undefined): Platform | null {
  if (!value) return null;
  const lower = value.toLowerCase().trim();
  return (PLATFORMS as readonly string[]).includes(lower)
    ? (lower as Platform)
    : null;
}

/**
 * Pure sanitizer. Never throws. Invalid fields become null rather than
 * crashing the whole row — returns rejectionReason only when the row
 * fails the minimum viable gate (missing title or url).
 */
export function sanitizeHackathon(
  input: Partial<Hackathon>
): SanitizedResult {
  const report: SanitizeReport = {
    dateFieldsDropped: [],
    clampedFields: [],
    droppedTagCount: 0,
  };

  const url = sanitizeUrl(input.url);
  if (!url) {
    return { row: null, rejectionReason: "invalid-url", report };
  }

  const title = clampString(input.title, TITLE_MAX, "title", report);
  if (!title) {
    return { row: null, rejectionReason: "missing-title", report };
  }

  const platform = sanitizePlatform(input.platform);
  if (!platform) {
    return { row: null, rejectionReason: "invalid-platform", report };
  }

  const row: Omit<Hackathon, "id" | "created_at"> = {
    title,
    description: clampString(input.description, DESCRIPTION_MAX, "description", report),
    desc_translated: clampString(
      input.desc_translated,
      DESCRIPTION_MAX,
      "desc_translated",
      report
    ),
    url,
    platform,
    start_date: sanitizeIsoDate(input.start_date, "start_date", report),
    end_date: sanitizeIsoDate(input.end_date, "end_date", report),
    deadline: sanitizeIsoDate(input.deadline, "deadline", report),
    location: clampString(input.location, LOCATION_MAX, "location", report),
    is_online: input.is_online ?? false,
    prize_pool: clampString(input.prize_pool, PRIZE_POOL_MAX, "prize_pool", report),
    prize_amount: sanitizePrizeAmount(input.prize_amount),
    tags: sanitizeTags(input.tags, report),
    image_url: (() => {
      const img = sanitizeUrl(input.image_url);
      if (!img) return null;
      return img.length <= IMAGE_URL_MAX ? img : null;
    })(),
    organizer: clampString(input.organizer, ORGANIZER_MAX, "organizer", report),
    region: input.region ?? null,
    scraped_at: input.scraped_at ?? new Date().toISOString(),
  };

  return { row, rejectionReason: null, report };
}
