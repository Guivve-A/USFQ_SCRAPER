import type { Hackathon, Platform } from "@/types/hackathon";
import {
  getScrapeSourceHealth,
  getHackathonByUrl,
  pruneExpiredByDeadline,
  pruneStaleByPlatform,
  recordScrapeSourceMetric,
  upsertHackathon,
} from "@/lib/db/queries";
import { normalizeRegion } from "@/lib/region";

import { scrapeDevpost } from "./devpost";
import { scrapeMLH } from "./mlh";
import { scrapeEventbrite } from "./eventbrite";
import { scrapeGDG, scrapeGDGWithDiagnostics } from "./gdg";
import { scrapeLablab } from "./lablab";

type ScraperTask = {
  name: string;
  platform: Platform;
  run: () => Promise<Partial<Hackathon>[]>;
};

type ScraperTaskDiagnosticOutput = {
  items: Partial<Hackathon>[];
  fetched: number;
  mapped: number;
  sourceDrops: Array<{
    reason: string;
    title: string | null;
    url: string | null;
    details: string | null;
  }>;
};

type ScraperDiagnosticTask = {
  name: string;
  platform: Platform;
  run: () => Promise<ScraperTaskDiagnosticOutput>;
};

type CollectedHackathon = {
  source: string;
  platform: Platform;
  item: Partial<Hackathon>;
};

export type RunAllScrapersResult = {
  total: number;
  inserted: number;
  updated: number;
  deleted: { stale: number; expired: number };
  errors: string[];
  alerts: string[];
  sources: Record<string, { status: "success" | "failed"; fetched: number }>;
};

export type ScrapeDiagnosticStage =
  | "source-filter"
  | "normalize"
  | "dedupe-url"
  | "dedupe-semantic"
  | "lookup";

export type ScrapeDiagnosticDrop = {
  source: string;
  platform: Platform;
  stage: ScrapeDiagnosticStage;
  reason: string;
  title: string | null;
  url: string | null;
  details: string | null;
};

export type ScrapeSourceDiagnostics = {
  source: string;
  platform: Platform;
  fetched: number;
  mapped: number;
  inserted: number;
  updated: number;
  dropped: number;
  droppedByReason: Record<string, number>;
  drops: ScrapeDiagnosticDrop[];
};

export type RunScrapersDiagnosticsOptions = {
  includeDrops?: boolean;
  maxDropsPerSource?: number;
};

export type RunScrapersDiagnosticsResult = {
  runStartedAt: string;
  totals: {
    fetched: number;
    mapped: number;
    inserted: number;
    updated: number;
    dropped: number;
  };
  errors: string[];
  sources: ScrapeSourceDiagnostics[];
};

const EXPIRED_DEADLINE_DAYS = 30;
const HISTORICAL_PLATFORMS = new Set<Platform>(["gdg"]);
const TRACKING_QUERY_PARAMS = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_src",
  "source",
  "si",
]);
const TITLE_STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "hackathon",
  "online",
  "global",
]);
const SEMANTIC_TITLE_SIMILARITY = 0.82;
const SEMANTIC_ORGANIZER_SIMILARITY = 0.75;
const SEMANTIC_DATE_WINDOW_DAYS = 3;

function createScraperTasks(): ScraperTask[] {
  return [
    { name: "devpost", platform: "devpost", run: scrapeDevpost },
    { name: "lablab", platform: "lablab", run: scrapeLablab },
    { name: "mlh", platform: "mlh", run: scrapeMLH },
    {
      name: "eventbrite-online",
      platform: "eventbrite",
      run: () => scrapeEventbrite("online"),
    },
    {
      name: "eventbrite-us",
      platform: "eventbrite",
      run: () => scrapeEventbrite("united-states"),
    },
    {
      name: "eventbrite-ca",
      platform: "eventbrite",
      run: () => scrapeEventbrite("canada"),
    },
    {
      name: "eventbrite-uk",
      platform: "eventbrite",
      run: () => scrapeEventbrite("united-kingdom"),
    },
    {
      name: "eventbrite-es",
      platform: "eventbrite",
      run: () => scrapeEventbrite("spain"),
    },
    {
      name: "eventbrite-fr",
      platform: "eventbrite",
      run: () => scrapeEventbrite("france"),
    },
    {
      name: "eventbrite-it",
      platform: "eventbrite",
      run: () => scrapeEventbrite("italy"),
    },
    {
      name: "eventbrite-nl",
      platform: "eventbrite",
      run: () => scrapeEventbrite("netherlands"),
    },
    {
      name: "eventbrite-de",
      platform: "eventbrite",
      run: () => scrapeEventbrite("germany"),
    },
    {
      name: "eventbrite-in",
      platform: "eventbrite",
      run: () => scrapeEventbrite("india"),
    },
    {
      name: "eventbrite-mx",
      platform: "eventbrite",
      run: () => scrapeEventbrite("mexico"),
    },
    {
      name: "eventbrite-br",
      platform: "eventbrite",
      run: () => scrapeEventbrite("brazil"),
    },
    {
      name: "eventbrite-ar",
      platform: "eventbrite",
      run: () => scrapeEventbrite("argentina"),
    },
    {
      name: "eventbrite-co",
      platform: "eventbrite",
      run: () => scrapeEventbrite("colombia"),
    },
    {
      name: "eventbrite-cl",
      platform: "eventbrite",
      run: () => scrapeEventbrite("chile"),
    },
    { name: "gdg", platform: "gdg", run: scrapeGDG },
  ];
}

function cleanText(value: string | undefined | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function canonicalizeUrl(value: string): string | null {
  const cleaned = cleanText(value);
  if (!cleaned) {
    return null;
  }

  try {
    const parsed = new URL(cleaned);

    parsed.hash = "";
    if (parsed.protocol === "http:") {
      parsed.protocol = "https:";
    }

    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");

    const entries = Array.from(parsed.searchParams.entries())
      .filter(([key]) => {
        const lowerKey = key.toLowerCase();
        return !lowerKey.startsWith("utm_") && !TRACKING_QUERY_PARAMS.has(lowerKey);
      })
      .sort(([a], [b]) => a.localeCompare(b));

    parsed.search = "";
    for (const [key, val] of entries) {
      parsed.searchParams.append(key, val);
    }

    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    if (!parsed.pathname) {
      parsed.pathname = "/";
    }

    return parsed.toString();
  } catch {
    return cleaned;
  }
}

function normalizeLabel(value: string | undefined | null): string | null {
  const cleaned = cleanText(value)?.toLowerCase();
  if (!cleaned) {
    return null;
  }

  const normalized = cleaned.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeTitle(value: string | undefined | null): string | null {
  const cleaned = normalizeLabel(value);
  if (!cleaned) {
    return null;
  }

  return cleaned
    .split(" ")
    .filter((token) => token.length > 1 && !TITLE_STOPWORDS.has(token))
    .join(" ")
    .trim();
}

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length > 0)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }

  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function referenceTimestamp(item: Partial<Hackathon>): number | null {
  const candidate = item.start_date ?? item.deadline ?? item.end_date;
  if (!candidate) {
    return null;
  }

  const value = Date.parse(candidate);
  if (Number.isNaN(value)) {
    return null;
  }

  return value;
}

function organizersAreSimilar(a: string | null, b: string | null): boolean {
  if (!a || !b) {
    return false;
  }

  if (a === b || a.includes(b) || b.includes(a)) {
    return true;
  }

  return jaccard(tokenize(a), tokenize(b)) >= SEMANTIC_ORGANIZER_SIMILARITY;
}

function titlesAreSimilar(a: string | null, b: string | null): boolean {
  if (!a || !b) {
    return false;
  }

  if (a === b || a.includes(b) || b.includes(a)) {
    return true;
  }

  return jaccard(tokenize(a), tokenize(b)) >= SEMANTIC_TITLE_SIMILARITY;
}

function qualityScore(item: Partial<Hackathon>): number {
  let score = 0;
  if (item.description) score += 3;
  if (item.start_date) score += 2;
  if (item.deadline) score += 2;
  if (item.organizer) score += 2;
  if (item.image_url) score += 1;
  if ((item.tags?.length ?? 0) > 0) score += 1;
  if (item.is_online) score += 1;
  return score;
}

function mergePreferRichest(
  current: Partial<Hackathon>,
  incoming: Partial<Hackathon>
): Partial<Hackathon> {
  const currentScore = qualityScore(current);
  const incomingScore = qualityScore(incoming);

  if (incomingScore > currentScore) {
    return mergeHackathons(incoming, current);
  }

  return mergeHackathons(current, incoming);
}

function isSemanticDuplicate(
  current: Partial<Hackathon>,
  incoming: Partial<Hackathon>
): boolean {
  const currentTitle = normalizeTitle(current.title);
  const incomingTitle = normalizeTitle(incoming.title);
  if (!titlesAreSimilar(currentTitle, incomingTitle)) {
    return false;
  }

  const currentTime = referenceTimestamp(current);
  const incomingTime = referenceTimestamp(incoming);
  if (currentTime === null || incomingTime === null) {
    return false;
  }

  const dayDiff = Math.abs(currentTime - incomingTime) / (24 * 60 * 60 * 1_000);
  if (dayDiff > SEMANTIC_DATE_WINDOW_DAYS) {
    return false;
  }

  // Cross-platform duplicates (e.g. Devpost + Lablab) have different organizer names
  // by design — trust title + date match alone when platforms differ.
  if (current.platform !== incoming.platform) {
    return true;
  }

  const currentOrganizer = normalizeLabel(current.organizer);
  const incomingOrganizer = normalizeLabel(incoming.organizer);
  return organizersAreSimilar(currentOrganizer, incomingOrganizer);
}

function dedupeSemantically(items: Partial<Hackathon>[]): {
  items: Partial<Hackathon>[];
  merged: number;
} {
  const unique: Partial<Hackathon>[] = [];
  let merged = 0;

  for (const item of items) {
    let mergedIndex = -1;

    for (let i = 0; i < unique.length; i += 1) {
      if (isSemanticDuplicate(unique[i], item)) {
        mergedIndex = i;
        break;
      }
    }

    if (mergedIndex >= 0) {
      unique[mergedIndex] = mergePreferRichest(unique[mergedIndex], item);
      merged += 1;
      continue;
    }

    unique.push(item);
  }

  return { items: unique, merged };
}

function hasMinimumViableContent(item: Partial<Hackathon>): boolean {
  const hasDate = Boolean(item.start_date ?? item.deadline ?? item.end_date);
  const hasDescription = Boolean(item.description && item.description.trim().length > 20);
  return hasDate || hasDescription;
}

function normalizeHackathon(item: Partial<Hackathon>): Partial<Hackathon> | null {
  const title = cleanText(item.title);
  const url = item.url ? canonicalizeUrl(item.url) : null;

  if (!title || !url) {
    return null;
  }

  if (title.length < 8) {
    return null;
  }

  if (!hasMinimumViableContent(item)) {
    return null;
  }

  const isOnline = item.is_online ?? false;
  const region = item.region ?? normalizeRegion(item.location ?? null, isOnline);

  return {
    ...item,
    title,
    url,
    tags: Array.from(new Set(item.tags ?? [])),
    is_online: isOnline,
    region,
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

function createDiagnosticTasks(): ScraperDiagnosticTask[] {
  return createScraperTasks().map((task) => {
    if (task.name === "gdg") {
      return {
        ...task,
        run: async () => {
          const result = await scrapeGDGWithDiagnostics();
          return {
            items: result.items,
            fetched: result.diagnostics.fetched,
            mapped: result.diagnostics.mapped,
            sourceDrops: result.diagnostics.drops.map((drop) => ({
              reason: drop.reason,
              title: drop.title,
              url: drop.url,
              details: `chapter=${drop.chapterSlug}${
                drop.eventType ? `, eventType=${drop.eventType}` : ""
              }${drop.details ? `, details=${drop.details}` : ""}`,
            })),
          };
        },
      };
    }

    return {
      ...task,
      run: async () => {
        const items = await task.run();
        return {
          items,
          fetched: items.length,
          mapped: items.length,
          sourceDrops: [],
        };
      },
    };
  });
}

function createSourceDiagnostics(
  source: string,
  platform: Platform
): ScrapeSourceDiagnostics {
  return {
    source,
    platform,
    fetched: 0,
    mapped: 0,
    inserted: 0,
    updated: 0,
    dropped: 0,
    droppedByReason: {},
    drops: [],
  };
}

function addDropToSource(
  summary: ScrapeSourceDiagnostics,
  drop: ScrapeDiagnosticDrop,
  includeDrops: boolean,
  maxDropsPerSource: number
): void {
  summary.dropped += 1;
  const reasonKey = `${drop.stage}:${drop.reason}`;
  summary.droppedByReason[reasonKey] =
    (summary.droppedByReason[reasonKey] ?? 0) + 1;

  if (includeDrops && summary.drops.length < maxDropsPerSource) {
    summary.drops.push(drop);
  }
}

export async function runScrapersDiagnostics(
  options: RunScrapersDiagnosticsOptions = {}
): Promise<RunScrapersDiagnosticsResult> {
  const includeDrops = options.includeDrops ?? true;
  const maxDropsPerSource = Math.min(
    Math.max(options.maxDropsPerSource ?? 250, 1),
    2000
  );
  const runStartedAt = new Date().toISOString();

  const tasks = createDiagnosticTasks();
  console.info(
    `[scrapers][diagnostics] Starting ${tasks.length} scrapers in dry-run mode at ${runStartedAt}.`
  );

  const settled = await Promise.allSettled(tasks.map((task) => task.run()));
  const errors: string[] = [];
  const bySource = new Map<string, ScrapeSourceDiagnostics>();
  const collected: CollectedHackathon[] = [];

  for (const task of tasks) {
    bySource.set(task.name, createSourceDiagnostics(task.name, task.platform));
  }

  settled.forEach((result, index) => {
    const task = tasks[index];
    const summary = bySource.get(task.name);
    if (!summary) {
      return;
    }

    if (result.status === "fulfilled") {
      summary.fetched += result.value.fetched;
      summary.mapped += result.value.mapped;

      for (const sourceDrop of result.value.sourceDrops) {
        addDropToSource(
          summary,
          {
            source: task.name,
            platform: task.platform,
            stage: "source-filter",
            reason: sourceDrop.reason,
            title: sourceDrop.title,
            url: sourceDrop.url,
            details: sourceDrop.details,
          },
          includeDrops,
          maxDropsPerSource
        );
      }

      for (const item of result.value.items) {
        collected.push({ source: task.name, platform: task.platform, item });
      }
      return;
    }

    const message =
      result.reason instanceof Error
        ? result.reason.message
        : "Unknown scraper failure";
    errors.push(`${task.name}: ${message}`);
    addDropToSource(
      summary,
      {
        source: task.name,
        platform: task.platform,
        stage: "source-filter",
        reason: "scraper-failure",
        title: null,
        url: null,
        details: message,
      },
      includeDrops,
      maxDropsPerSource
    );
  });

  const byUrl = new Map<string, CollectedHackathon>();
  for (const row of collected) {
    const summary = bySource.get(row.source);
    if (!summary) {
      continue;
    }

    const normalized = normalizeHackathon(row.item);
    if (!normalized || !normalized.url) {
      addDropToSource(
        summary,
        {
          source: row.source,
          platform: row.platform,
          stage: "normalize",
          reason: "missing-title-or-url",
          title: cleanText(row.item.title),
          url: cleanText(row.item.url),
          details: "Failed normalization for title/url.",
        },
        includeDrops,
        maxDropsPerSource
      );
      continue;
    }

    const existing = byUrl.get(normalized.url);
    if (!existing) {
      byUrl.set(normalized.url, { ...row, item: normalized });
      continue;
    }

    addDropToSource(
      summary,
      {
        source: row.source,
        platform: row.platform,
        stage: "dedupe-url",
        reason: "duplicate-url-in-run",
        title: normalized.title ?? null,
        url: normalized.url,
        details: `Kept first occurrence from source=${existing.source}.`,
      },
      includeDrops,
      maxDropsPerSource
    );

    byUrl.set(normalized.url, {
      ...existing,
      item: mergeHackathons(existing.item, normalized),
    });
  }

  const semanticUnique: CollectedHackathon[] = [];
  for (const row of byUrl.values()) {
    let mergedIndex = -1;
    for (let i = 0; i < semanticUnique.length; i += 1) {
      if (isSemanticDuplicate(semanticUnique[i].item, row.item)) {
        mergedIndex = i;
        break;
      }
    }

    if (mergedIndex >= 0) {
      const summary = bySource.get(row.source);
      const keeper = semanticUnique[mergedIndex];

      if (summary) {
        addDropToSource(
          summary,
          {
            source: row.source,
            platform: row.platform,
            stage: "dedupe-semantic",
            reason: "semantic-duplicate-in-run",
            title: row.item.title ?? null,
            url: row.item.url ?? null,
            details: `Merged into source=${keeper.source}.`,
          },
          includeDrops,
          maxDropsPerSource
        );
      }

      semanticUnique[mergedIndex] = {
        ...keeper,
        item: mergePreferRichest(keeper.item, row.item),
      };
      continue;
    }

    semanticUnique.push(row);
  }

  for (const row of semanticUnique) {
    const summary = bySource.get(row.source);
    if (!summary) {
      continue;
    }

    const url = row.item.url;
    if (!url) {
      addDropToSource(
        summary,
        {
          source: row.source,
          platform: row.platform,
          stage: "lookup",
          reason: "missing-url-after-pipeline",
          title: row.item.title ?? null,
          url: null,
          details: "URL missing after normalization/deduping.",
        },
        includeDrops,
        maxDropsPerSource
      );
      continue;
    }

    try {
      const existing = await getHackathonByUrl(url);
      if (existing) {
        summary.updated += 1;
      } else {
        summary.inserted += 1;
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown lookup failure";
      errors.push(`lookup:${url}: ${message}`);
      addDropToSource(
        summary,
        {
          source: row.source,
          platform: row.platform,
          stage: "lookup",
          reason: "lookup-failure",
          title: row.item.title ?? null,
          url,
          details: message,
        },
        includeDrops,
        maxDropsPerSource
      );
    }
  }

  const sources = Array.from(bySource.values()).sort((a, b) =>
    a.source.localeCompare(b.source)
  );

  const totals = sources.reduce(
    (acc, source) => {
      acc.fetched += source.fetched;
      acc.mapped += source.mapped;
      acc.inserted += source.inserted;
      acc.updated += source.updated;
      acc.dropped += source.dropped;
      return acc;
    },
    { fetched: 0, mapped: 0, inserted: 0, updated: 0, dropped: 0 }
  );

  return {
    runStartedAt,
    totals,
    errors,
    sources,
  };
}

export async function runAllScrapers(): Promise<RunAllScrapersResult> {
  const runStartedAt = new Date().toISOString();

  const tasks = createScraperTasks();

  console.info(
    `[scrapers] Starting ${tasks.length} scrapers in parallel at ${runStartedAt}.`
  );
  const settled = await Promise.allSettled(tasks.map((task) => task.run()));

  const collected: Partial<Hackathon>[] = [];
  const errors: string[] = [];
  const sourceOutcomes: Record<
    string,
    { status: "success" | "failed"; fetched: number }
  > = {};
  const platformOutcomes: Record<string, { ok: number; fail: number }> = {};
  const metricWrites: Promise<void>[] = [];

  for (const task of tasks) {
    if (!platformOutcomes[task.platform]) {
      platformOutcomes[task.platform] = { ok: 0, fail: 0 };
    }
  }

  settled.forEach((result, index) => {
    const task = tasks[index];

    if (result.status === "fulfilled") {
      platformOutcomes[task.platform].ok += 1;
      sourceOutcomes[task.name] = {
        status: "success",
        fetched: result.value.length,
      };
      console.info(
        `[scrapers] ${task.name} succeeded with ${result.value.length} items.`
      );

      metricWrites.push(
        recordScrapeSourceMetric({
          runId: runStartedAt,
          source: task.name,
          platform: task.platform,
          status: "success",
          fetchedCount: result.value.length,
        }).catch((error) => {
          console.warn(
            `[scrapers] Failed to record metrics for ${task.name}:`,
            error
          );
        })
      );

      collected.push(...result.value);
      return;
    }

    platformOutcomes[task.platform].fail += 1;
    const message =
      result.reason instanceof Error
        ? result.reason.message
        : "Unknown scraper failure";
    sourceOutcomes[task.name] = { status: "failed", fetched: 0 };
    errors.push(`${task.name}: ${message}`);
    console.error(`[scrapers] ${task.name} failed: ${message}`);

    metricWrites.push(
      recordScrapeSourceMetric({
        runId: runStartedAt,
        source: task.name,
        platform: task.platform,
        status: "failed",
        fetchedCount: 0,
        errorMessage: message,
      }).catch((error) => {
        console.warn(
          `[scrapers] Failed to record metrics for ${task.name}:`,
          error
        );
      })
    );
  });

  await Promise.all(metricWrites);

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

  const semanticDeduped = dedupeSemantically(Array.from(byUrl.values()));
  if (semanticDeduped.merged > 0) {
    console.info(
      `[scrapers] Semantic dedupe merged ${semanticDeduped.merged} potential duplicates.`
    );
  }

  let inserted = 0;
  let updated = 0;

  for (const item of semanticDeduped.items) {
    const url = item.url;
    if (!url) {
      continue;
    }

    try {
      const existing = await getHackathonByUrl(url);
      await upsertHackathon({ ...item, scraped_at: runStartedAt });

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

  let staleDeleted = 0;
  for (const [platform, outcome] of Object.entries(platformOutcomes)) {
    if (outcome.fail > 0 || outcome.ok === 0) {
      console.warn(
        `[scrapers] Skip stale-prune for ${platform} (ok=${outcome.ok}, fail=${outcome.fail}).`
      );
      continue;
    }

    if (HISTORICAL_PLATFORMS.has(platform as Platform)) {
      console.info(
        `[scrapers] Skip stale-prune for ${platform} to preserve historical catalog.`
      );
      continue;
    }

    try {
      const removed = await pruneStaleByPlatform(platform, runStartedAt);
      staleDeleted += removed;
      if (removed > 0) {
        console.info(
          `[scrapers] Pruned ${removed} stale ${platform} hackathons not seen in this run.`
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown prune failure";
      errors.push(`prune-stale:${platform}: ${message}`);
      console.error(
        `[scrapers] Failed to prune stale ${platform} rows: ${message}`
      );
    }
  }

  const expiredCutoff = new Date(
    Date.now() - EXPIRED_DEADLINE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  let expiredDeleted = 0;
  try {
    expiredDeleted = await pruneExpiredByDeadline(expiredCutoff, {
      excludePlatforms: Array.from(HISTORICAL_PLATFORMS),
    });
    if (expiredDeleted > 0) {
      console.info(
        `[scrapers] Pruned ${expiredDeleted} hackathons with deadline before ${expiredCutoff} (excluding historical platforms).`
      );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown prune failure";
    errors.push(`prune-expired: ${message}`);
    console.error(`[scrapers] Failed to prune expired rows: ${message}`);
  }

  let alerts: string[] = [];
  try {
    alerts = (await getScrapeSourceHealth(14))
      .filter((metric) => metric.alert)
      .map((metric) => `${metric.source}: ${metric.alert}`);

    if (alerts.length > 0) {
      console.warn(`[scrapers] Source health alerts: ${alerts.join(" | ")}`);
    }
  } catch (error) {
    console.warn("[scrapers] Unable to compute source health alerts:", error);
  }

  const summary: RunAllScrapersResult = {
    total: semanticDeduped.items.length,
    inserted,
    updated,
    deleted: { stale: staleDeleted, expired: expiredDeleted },
    errors,
    alerts,
    sources: sourceOutcomes,
  };

  console.info(
    `[scrapers] Done. total=${summary.total}, inserted=${summary.inserted}, updated=${summary.updated}, deleted_stale=${summary.deleted.stale}, deleted_expired=${summary.deleted.expired}, errors=${summary.errors.length}`
  );

  return summary;
}
