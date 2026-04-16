import type { Hackathon } from "@/types/hackathon";
import { getHackathonByUrl, upsertHackathon } from "@/lib/db/queries";

import { scrapeDevpost } from "./devpost";
import { scrapeMLH } from "./mlh";
import { scrapeEventbrite } from "./eventbrite";
import { scrapeGDG } from "./gdg";

type ScraperTask = {
  name: string;
  run: () => Promise<Partial<Hackathon>[]>;
};

export type RunAllScrapersResult = {
  total: number;
  inserted: number;
  updated: number;
  errors: string[];
};

function cleanText(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeHackathon(item: Partial<Hackathon>): Partial<Hackathon> | null {
  const title = cleanText(item.title);
  const url = cleanText(item.url);

  if (!title || !url) {
    return null;
  }

  return {
    ...item,
    title,
    url,
    tags: Array.from(new Set(item.tags ?? [])),
    is_online: item.is_online ?? false,
  };
}

function mergeHackathons(
  current: Partial<Hackathon>,
  incoming: Partial<Hackathon>
): Partial<Hackathon> {
  return {
    ...current,
    ...incoming,
    tags: Array.from(new Set([...(current.tags ?? []), ...(incoming.tags ?? [])])),
    is_online: incoming.is_online ?? current.is_online ?? false,
  };
}

export async function runAllScrapers(): Promise<RunAllScrapersResult> {
  const tasks: ScraperTask[] = [
    { name: "devpost", run: scrapeDevpost },
    { name: "mlh", run: scrapeMLH },
    { name: "eventbrite-ecuador", run: () => scrapeEventbrite("ecuador") },
    { name: "eventbrite-online", run: () => scrapeEventbrite("online") },
    { name: "gdg", run: scrapeGDG },
  ];

  console.info(`[scrapers] Starting ${tasks.length} scrapers in parallel.`);
  const settled = await Promise.allSettled(tasks.map((task) => task.run()));

  const collected: Partial<Hackathon>[] = [];
  const errors: string[] = [];

  settled.forEach((result, index) => {
    const task = tasks[index];

    if (result.status === "fulfilled") {
      console.info(
        `[scrapers] ${task.name} succeeded with ${result.value.length} items.`
      );
      collected.push(...result.value);
      return;
    }

    const message =
      result.reason instanceof Error
        ? result.reason.message
        : "Unknown scraper failure";
    errors.push(`${task.name}: ${message}`);
    console.error(`[scrapers] ${task.name} failed: ${message}`);
  });

  const byUrl = new Map<string, Partial<Hackathon>>();

  for (const raw of collected) {
    const normalized = normalizeHackathon(raw);
    if (!normalized || !normalized.url) {
      errors.push("dropped-item: missing title or url");
      continue;
    }

    const existing = byUrl.get(normalized.url);
    if (!existing) {
      byUrl.set(normalized.url, normalized);
      continue;
    }

    byUrl.set(normalized.url, mergeHackathons(existing, normalized));
  }

  let inserted = 0;
  let updated = 0;

  for (const [url, item] of byUrl.entries()) {
    try {
      const existing = await getHackathonByUrl(url);
      await upsertHackathon(item);

      if (existing) {
        updated += 1;
      } else {
        inserted += 1;
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown upsert failure";
      errors.push(`upsert:${url}: ${message}`);
    }
  }

  const summary: RunAllScrapersResult = {
    total: byUrl.size,
    inserted,
    updated,
    errors,
  };

  console.info(
    `[scrapers] Done. total=${summary.total}, inserted=${summary.inserted}, updated=${summary.updated}, errors=${summary.errors.length}`
  );

  return summary;
}
