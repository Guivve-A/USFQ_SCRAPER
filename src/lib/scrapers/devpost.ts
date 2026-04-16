import axios from "axios";
import * as cheerio from "cheerio";
import { endOfDay, isValid, parse, startOfDay } from "date-fns";

import type { Hackathon } from "@/types/hackathon";

const DEVPOST_JSON_URL =
  "https://WebDevHarsha.github.io/open-hackathons-api/data-online.json";
const DEVPOST_LISTING_URL =
  "https://devpost.com/hackathons?challenge_type=online&order_by=deadline";
const REQUEST_TIMEOUT_MS = 10_000;
const USER_AGENT = "Mozilla/5.0 (compatible; HackFinder/1.0)";

type DevpostTheme = {
  name?: string;
};

type DevpostApiHackathon = {
  url?: string;
  title?: string;
  thumbnail_url?: string;
  organization_name?: string;
  submission_period_dates?: string;
  displayed_location?: string;
  prizeText?: string;
  themes?: DevpostTheme[];
  time_left_to_submission?: string;
};

type DevpostApiResponse = {
  hackathons?: DevpostApiHackathon[];
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
  },
});

function toAbsoluteUrl(url: string | undefined | null): string | null {
  if (!url) {
    return null;
  }

  if (url.startsWith("//")) {
    return `https:${url}`;
  }

  if (url.startsWith("/")) {
    return `https://devpost.com${url}`;
  }

  return url;
}

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

  const withoutTags = value.replace(/<[^>]*>/g, " ");
  return cleanText(withoutTags);
}

function parseMonthDayYear(
  month: string,
  day: string,
  year: string
): Date | null {
  const candidates = [
    parse(`${month} ${day} ${year}`, "MMM d yyyy", new Date()),
    parse(`${month} ${day} ${year}`, "MMMM d yyyy", new Date()),
  ];

  const found = candidates.find((date) => isValid(date));
  return found ?? null;
}

function dateToStartIso(date: Date): string {
  return startOfDay(date).toISOString();
}

function dateToEndIso(date: Date): string {
  return endOfDay(date).toISOString();
}

function parseSubmissionDateRange(input: string | undefined | null): ParsedDateRange {
  const empty = {
    start_date: null,
    end_date: null,
    deadline: null,
  };

  const raw = cleanText(input);
  if (!raw) {
    return empty;
  }

  const compact = raw.replace(/\u2013/g, "-").replace(/\s+/g, " ").trim();

  const sameMonthRange = compact.match(
    /^([A-Za-z]{3,9})\s+(\d{1,2})\s*-\s*(\d{1,2}),\s*(\d{4})$/
  );
  if (sameMonthRange) {
    const [, month, startDay, endDay, year] = sameMonthRange;
    const start = parseMonthDayYear(month, startDay, year);
    const end = parseMonthDayYear(month, endDay, year);

    if (start && end) {
      return {
        start_date: dateToStartIso(start),
        end_date: dateToEndIso(end),
        deadline: dateToEndIso(end),
      };
    }
  }

  const crossMonthRange = compact.match(
    /^([A-Za-z]{3,9})\s+(\d{1,2})\s*-\s*([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})$/
  );
  if (crossMonthRange) {
    const [, startMonth, startDay, endMonth, endDay, year] = crossMonthRange;
    const start = parseMonthDayYear(startMonth, startDay, year);
    const end = parseMonthDayYear(endMonth, endDay, year);

    if (start && end) {
      return {
        start_date: dateToStartIso(start),
        end_date: dateToEndIso(end),
        deadline: dateToEndIso(end),
      };
    }
  }

  const fullDateRange = compact.match(
    /^([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})\s*-\s*([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})$/
  );
  if (fullDateRange) {
    const [, startMonth, startDay, startYear, endMonth, endDay, endYear] =
      fullDateRange;
    const start = parseMonthDayYear(startMonth, startDay, startYear);
    const end = parseMonthDayYear(endMonth, endDay, endYear);

    if (start && end) {
      return {
        start_date: dateToStartIso(start),
        end_date: dateToEndIso(end),
        deadline: dateToEndIso(end),
      };
    }
  }

  return empty;
}

function dedupeByUrl(items: Partial<Hackathon>[]): Partial<Hackathon>[] {
  const byUrl = new Map<string, Partial<Hackathon>>();

  for (const item of items) {
    if (!item.url) {
      continue;
    }

    if (!byUrl.has(item.url)) {
      byUrl.set(item.url, item);
      continue;
    }

    const current = byUrl.get(item.url)!;
    byUrl.set(item.url, {
      ...current,
      ...item,
      tags: Array.from(new Set([...(current.tags ?? []), ...(item.tags ?? [])])),
    });
  }

  return Array.from(byUrl.values());
}

function mapDevpostApiHackathon(item: DevpostApiHackathon): Partial<Hackathon> | null {
  const url = toAbsoluteUrl(item.url);
  const title = cleanText(item.title);

  if (!url || !title) {
    return null;
  }

  const dates = parseSubmissionDateRange(item.submission_period_dates);
  const prize = stripHtml(item.prizeText);
  const tags = (item.themes ?? [])
    .map((theme) => cleanText(theme.name) ?? "")
    .filter((theme) => theme.length > 0);

  const location = cleanText(item.displayed_location) ?? "Online";
  const isOnline = /online/i.test(location);
  const description = cleanText(item.organization_name)
    ? `${cleanText(item.organization_name)}${
        cleanText(item.time_left_to_submission)
          ? ` - ${cleanText(item.time_left_to_submission)}`
          : ""
      }`
    : null;

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
    organizer: cleanText(item.organization_name),
  };

  if (description) {
    mapped.description = description;
  }

  return mapped;
}

async function scrapeDevpostFromApi(): Promise<Partial<Hackathon>[]> {
  const { data } = await http.get<DevpostApiResponse>(DEVPOST_JSON_URL);
  const list = Array.isArray(data?.hackathons)
    ? data.hackathons
    : Array.isArray(data?.data)
      ? data.data
      : [];

  if (list.length === 0) {
    throw new Error("Devpost JSON endpoint returned an empty list.");
  }

  const mapped = list
    .map(mapDevpostApiHackathon)
    .filter((item): item is Partial<Hackathon> => item !== null);

  return dedupeByUrl(mapped);
}

async function scrapeDevpostFallback(maxPages = 5): Promise<Partial<Hackathon>[]> {
  const results: Partial<Hackathon>[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const pageUrl = `${DEVPOST_LISTING_URL}&page=${page}`;
    const { data: html, status } = await http.get<string>(pageUrl, {
      responseType: "text",
      validateStatus: () => true,
    });

    if (status >= 400 || !html || html.trim().length === 0) {
      if (page === 1) {
        throw new Error(`Devpost fallback returned status ${status}.`);
      }
      break;
    }

    const $ = cheerio.load(html);
    const cards = $("article.challenge-listing");

    if (cards.length === 0) {
      if (page === 1) {
        throw new Error("Devpost fallback page has no challenge-listing cards.");
      }
      break;
    }

    cards.each((_, element) => {
      const card = $(element);
      const title = cleanText(card.find("h2 a, h3 a, h2, h3").first().text());
      const url = toAbsoluteUrl(
        card.find("h2 a[href], h3 a[href], a.challenge-link[href]").first().attr("href")
      );

      if (!title || !url) {
        return;
      }

      const dateText = cleanText(
        card.find("span.value.date-range, .submission-period, .challenge-listing-period").first().text()
      );
      const dates = parseSubmissionDateRange(dateText);
      const prize = cleanText(card.find(".prize-amount").first().text());
      const location =
        cleanText(
          card
            .find("span.value.location, .challenge-listing-location, .submission-location .value")
            .first()
            .text()
        ) ?? "Online";
      const tags = card
        .find(".themes li, .theme-label, .tag")
        .toArray()
        .map((tag) => cleanText($(tag).text()) ?? "")
        .filter((tag) => tag.length > 0);
      const description = cleanText(
        card.find(".challenge-description, p").first().text()
      );

      const mapped: Partial<Hackathon> = {
        title,
        url,
        platform: "devpost",
        start_date: dates.start_date,
        end_date: dates.end_date,
        deadline: dates.deadline,
        location,
        is_online: /online/i.test(location),
        prize_pool: prize,
        tags,
        image_url: toAbsoluteUrl(card.find("img[src]").first().attr("src")),
      };

      if (description) {
        mapped.description = description;
      }

      results.push(mapped);
    });
  }

  return dedupeByUrl(results);
}

export async function scrapeDevpost(): Promise<Partial<Hackathon>[]> {
  try {
    const fromApi = await scrapeDevpostFromApi();
    if (fromApi.length > 0) {
      console.info(`[scrapers][devpost] API strategy returned ${fromApi.length} items.`);
      return fromApi;
    }
  } catch (error) {
    console.warn("[scrapers][devpost] API strategy failed, using fallback.", error);
  }

  const fallback = await scrapeDevpostFallback();
  console.info(
    `[scrapers][devpost] Fallback strategy returned ${fallback.length} items.`
  );
  return fallback;
}
