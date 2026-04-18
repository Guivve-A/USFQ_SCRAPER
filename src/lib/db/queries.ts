import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { rankCatalogHackathons } from "@/lib/ranking";
import type { Region } from "@/lib/region";
import type { Hackathon, Platform } from "@/types/hackathon";

export type MatchOptions = {
  matchThreshold?: number;
  matchCount?: number;
  online?: boolean;
  platform?: Platform;
  regions?: Region[] | null;
  includeUnknownOnline?: boolean;
};

type HackathonRow = {
  id: number;
  title: string;
  description: string | null;
  url: string;
  platform: string | null;
  start_date: string | null;
  end_date: string | null;
  deadline: string | null;
  location: string | null;
  is_online: boolean;
  prize_pool: string | null;
  prize_amount: number | null;
  tags: string[] | null;
  image_url: string | null;
  organizer: string | null;
  region: Region | null;
  embedding?: number[] | null;
  scraped_at: string;
  created_at: string;
};

type MatchHackathonRow = Omit<HackathonRow, "embedding"> & {
  similarity: number;
};

type SearchRpcParams = {
  query_embedding: string;
  match_threshold: number;
  match_count: number;
  filter_online: boolean | null;
  filter_platform: string | null;
  filter_regions: Region[] | null;
  include_unknown_region_online: boolean;
};

// All columns except the embedding vector — used for listing/browsing queries where
// the 384-float payload would waste bandwidth unnecessarily.
// All columns except the embedding vector — keeps list/browse queries lean.
const HACKATHON_LIST_COLS =
  "id,title,description,url,platform,start_date,end_date,deadline,location,is_online,prize_pool,prize_amount,tags,image_url,organizer,region,scraped_at,created_at";

type ScrapeSourceMetricRow = {
  source: string;
  platform: string;
  status: "success" | "failed";
  fetched_count: number;
  error_message: string | null;
  created_at: string;
};

export type ScrapeMetricStatus = "success" | "failed";

export type ScrapeSourceMetricInput = {
  runId: string;
  source: string;
  platform: string;
  status: ScrapeMetricStatus;
  fetchedCount: number;
  errorMessage?: string | null;
};

export type SourceHealthMetric = {
  source: string;
  platform: string;
  latestCount: number;
  avgCount7d: number;
  failureRate7d: number;
  dropRatio: number | null;
  alert: string | null;
};

let _readClient: SupabaseClient | null = null;
let _writeClient: SupabaseClient | null = null;

function getReadClient(): SupabaseClient {
  if (_readClient) return _readClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  _readClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _readClient;
}

function getWriteClient(): SupabaseClient {
  if (_writeClient) return _writeClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  _writeClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _writeClient;
}

function toHackathon(row: HackathonRow): Hackathon {
  return {
    id: String(row.id),
    title: row.title,
    description: row.description ?? null,
    // Never surface stored translations — ephemeral per-session only.
    desc_translated: null,
    url: row.url,
    platform: (row.platform ?? "devpost") as Hackathon["platform"],
    start_date: row.start_date,
    end_date: row.end_date,
    deadline: row.deadline,
    location: row.location,
    is_online: row.is_online,
    prize_pool: row.prize_pool,
    prize_amount: row.prize_amount,
    tags: row.tags ?? [],
    image_url: row.image_url,
    organizer: row.organizer,
    region: row.region ?? null,
    scraped_at: row.scraped_at,
    created_at: row.created_at,
  };
}

function cleanPayload<T extends Record<string, unknown>>(payload: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

const EMBEDDING_DIMENSIONS = 384;

function toVectorLiteral(embedding: number[]): string {
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected embedding with ${EMBEDDING_DIMENSIONS} dimensions, got ${embedding.length}.`
    );
  }

  return `[${embedding.join(",")}]`;
}

export async function upsertHackathon(
  hackathon: Partial<Hackathon>
): Promise<Hackathon> {
  if (!hackathon.url) {
    throw new Error("upsertHackathon requires hackathon.url");
  }

  const payload = cleanPayload({
    title: hackathon.title,
    description: hackathon.description,
    url: hackathon.url,
    platform: hackathon.platform,
    start_date: hackathon.start_date,
    end_date: hackathon.end_date,
    deadline: hackathon.deadline,
    location: hackathon.location,
    is_online: hackathon.is_online,
    prize_pool: hackathon.prize_pool,
    prize_amount: hackathon.prize_amount,
    tags: hackathon.tags,
    image_url: hackathon.image_url,
    organizer: hackathon.organizer,
    region: hackathon.region,
    scraped_at: hackathon.scraped_at,
    created_at: hackathon.created_at,
  });

  const { data, error } = await getWriteClient()
    .from("hackathons")
    .upsert(payload, { onConflict: "url" })
    .select("*")
    .single<HackathonRow>();

  if (error || !data) {
    throw new Error(`Failed to upsert hackathon: ${error?.message ?? "unknown"}`);
  }

  return toHackathon(data);
}

export type BulkUpsertResult = {
  inserted: number;
  updated: number;
  failed: number;
  errors: string[];
};

const BULK_UPSERT_CHUNK_SIZE = 500;

export async function getExistingHackathonUrls(
  urls: string[]
): Promise<Set<string>> {
  if (urls.length === 0) return new Set();

  const existing = new Set<string>();
  for (let i = 0; i < urls.length; i += BULK_UPSERT_CHUNK_SIZE) {
    const chunk = urls.slice(i, i + BULK_UPSERT_CHUNK_SIZE);
    const { data, error } = await getReadClient()
      .from("hackathons")
      .select("url")
      .in("url", chunk);

    if (error) {
      throw new Error(`Failed to lookup existing urls: ${error.message}`);
    }

    for (const row of (data ?? []) as Array<{ url: string }>) {
      existing.add(row.url);
    }
  }
  return existing;
}

export async function bulkUpsertHackathons(
  rows: Array<Partial<Hackathon>>
): Promise<BulkUpsertResult> {
  const result: BulkUpsertResult = {
    inserted: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };
  if (rows.length === 0) return result;

  const urls = rows.map((r) => r.url).filter((u): u is string => Boolean(u));
  const existingUrls = await getExistingHackathonUrls(urls);

  for (let i = 0; i < rows.length; i += BULK_UPSERT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + BULK_UPSERT_CHUNK_SIZE);
    const payload = chunk.map((h) =>
      cleanPayload({
        title: h.title,
        description: h.description,
        url: h.url,
        platform: h.platform,
        start_date: h.start_date,
        end_date: h.end_date,
        deadline: h.deadline,
        location: h.location,
        is_online: h.is_online,
        prize_pool: h.prize_pool,
        prize_amount: h.prize_amount,
        tags: h.tags,
        image_url: h.image_url,
        organizer: h.organizer,
        region: h.region,
        scraped_at: h.scraped_at,
      })
    );

    const { error } = await getWriteClient()
      .from("hackathons")
      .upsert(payload, { onConflict: "url" });

    if (error) {
      result.failed += chunk.length;
      result.errors.push(`bulk-upsert chunk ${i}: ${error.message}`);
      continue;
    }

    for (const row of chunk) {
      if (row.url && existingUrls.has(row.url)) {
        result.updated += 1;
      } else {
        result.inserted += 1;
      }
    }
  }

  return result;
}

export async function matchHackathonsByEmbedding(
  embedding: number[],
  options: MatchOptions = {}
): Promise<Array<Hackathon & { similarity: number }>> {
  const rpcParams: SearchRpcParams = {
    query_embedding: toVectorLiteral(embedding),
    match_threshold: options.matchThreshold ?? 0.4,
    match_count: options.matchCount ?? 10,
    filter_online: options.online ?? null,
    filter_platform: options.platform ?? null,
    filter_regions:
      options.regions && options.regions.length > 0 ? options.regions : null,
    include_unknown_region_online: options.includeUnknownOnline ?? true,
  };

  const { data, error } = await getReadClient().rpc("match_hackathons", rpcParams);

  if (error) {
    throw new Error(`Failed to match hackathons: ${error.message}`);
  }

  const rows = (data ?? []) as MatchHackathonRow[];
  return rows.map((row) => ({ ...toHackathon(row), similarity: row.similarity }));
}

export async function getHackathonsWithoutEmbedding(
  limit = 200
): Promise<Hackathon[]> {
  const { data, error } = await getReadClient()
    .from("hackathons")
    .select("*")
    .is("embedding", null)
    .order("created_at", { ascending: true })
    .limit(limit)
    .returns<HackathonRow[]>();

  if (error) {
    throw new Error(`Failed to get hackathons without embedding: ${error.message}`);
  }

  return (data ?? []).map(toHackathon);
}

export async function updateHackathonEmbedding(
  id: number,
  embedding: number[]
): Promise<void> {
  const { error } = await getWriteClient()
    .from("hackathons")
    .update({ embedding: toVectorLiteral(embedding) })
    .eq("id", id);

  if (error) {
    throw new Error(
      `Failed to update embedding for hackathon ${id}: ${error.message}`
    );
  }
}

export async function getHackathonById(id: number): Promise<Hackathon | null> {
  const { data, error } = await getReadClient()
    .from("hackathons")
    .select("*")
    .eq("id", id)
    .maybeSingle<HackathonRow>();

  if (error) {
    throw new Error(`Failed to get hackathon by id: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return toHackathon(data);
}

export async function getRelatedHackathons(
  id: number,
  platform: string | null,
  limit = 3
): Promise<Hackathon[]> {
  let query = (
    getReadClient()
      .from("hackathons")
      .select(HACKATHON_LIST_COLS)
      .neq("id", id)
      .limit(limit * 3)
  ) as unknown as SupabaseFilterBuilder;

  if (platform) {
    query = query.eq("platform", platform);
  }

  query = applyActiveFilter(query);

  const { data, error } = await query.returns<HackathonRow[]>();
  if (error) return [];

  return rankCatalogHackathons((data ?? []).map(toHackathon)).slice(0, limit);
}

export async function getHackathonByUrl(url: string): Promise<Hackathon | null> {
  const { data, error } = await getReadClient()
    .from("hackathons")
    .select("*")
    .eq("url", url)
    .maybeSingle<HackathonRow>();

  if (error) {
    throw new Error(`Failed to get hackathon by url: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return toHackathon(data);
}

export type RecentHackathonsOptions = {
  regions?: Region[] | null;
  includeUnknownOnline?: boolean;
};

export async function getRecentHackathons(
  limit = 10,
  options: RecentHackathonsOptions = {}
): Promise<Hackathon[]> {
  const fetchLimit = Math.max(limit, 60);

  let query = (
    getReadClient()
      .from("hackathons")
      .select(HACKATHON_LIST_COLS)
      .order("created_at", { ascending: false })
      .limit(fetchLimit)
  ) as unknown as SupabaseFilterBuilder;

  query = applyActiveFilter(query);
  query = applyRegionFilter(query, options.regions, options.includeUnknownOnline);

  const { data, error } = await query.returns<HackathonRow[]>();

  if (error) {
    throw new Error(`Failed to get recent hackathons: ${error.message}`);
  }

  const ranked = rankCatalogHackathons((data ?? []).map(toHackathon));
  return ranked.slice(0, limit);
}

type SupabaseFilterBuilder = ReturnType<
  ReturnType<SupabaseClient["from"]>["select"]
>;

function applyRegionFilter(
  query: SupabaseFilterBuilder,
  regions: Region[] | null | undefined,
  includeUnknownOnline: boolean | undefined
): SupabaseFilterBuilder {
  if (!regions || regions.length === 0) return query;

  const regionList = regions
    .map((region) => `"${region}"`)
    .join(",");

  if (includeUnknownOnline ?? true) {
    return query.or(`region.in.(${regionList}),and(region.is.null,is_online.eq.true)`);
  }

  return query.in("region", regions);
}

function applyActiveFilter(query: SupabaseFilterBuilder): SupabaseFilterBuilder {
  const nowIso = new Date().toISOString();
  return query.or(`deadline.is.null,deadline.gte.${nowIso}`);
}

export type SystemStats = {
  total: number;
  embedded: number;
  pending: number;
  embeddingCoverage: number;
  latestScrapedAt: string | null;
  platformDistribution: Record<string, number>;
  sourceHealth: SourceHealthMetric[] | null;
};

export async function getSystemStats(): Promise<SystemStats> {
  const client = getReadClient();

  const [{ count: total, error: totalError }, { count: embedded, error: embeddedError }] =
    await Promise.all([
      client.from("hackathons").select("id", { count: "exact", head: true }),
      client
        .from("hackathons")
        .select("id", { count: "exact", head: true })
        .not("embedding", "is", null),
    ]);

  if (totalError) throw new Error(`Failed to count hackathons: ${totalError.message}`);
  if (embeddedError) {
    throw new Error(`Failed to count embedded hackathons: ${embeddedError.message}`);
  }

  const totalCount = total ?? 0;
  const embeddedCount = embedded ?? 0;

  const { data: latestRow, error: latestError } = await client
    .from("hackathons")
    .select("scraped_at")
    .order("scraped_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ scraped_at: string | null }>();

  if (latestError) {
    throw new Error(`Failed to read latest scraped_at: ${latestError.message}`);
  }

  const { data: platformRows, error: platformError } = await client
    .from("hackathons")
    .select("platform")
    .returns<Array<{ platform: string | null }>>();

  if (platformError) {
    throw new Error(`Failed to read platform distribution: ${platformError.message}`);
  }

  const platformDistribution: Record<string, number> = {};
  for (const row of platformRows ?? []) {
    const key = row.platform ?? "unknown";
    platformDistribution[key] = (platformDistribution[key] ?? 0) + 1;
  }

  let sourceHealth: SourceHealthMetric[] | null = null;
  try {
    sourceHealth = await getScrapeSourceHealth(14);
  } catch (error) {
    console.warn("[db] Source health metrics unavailable:", error);
  }

  return {
    total: totalCount,
    embedded: embeddedCount,
    pending: Math.max(0, totalCount - embeddedCount),
    embeddingCoverage:
      totalCount === 0 ? 0 : Number((embeddedCount / totalCount).toFixed(4)),
    latestScrapedAt: latestRow?.scraped_at ?? null,
    platformDistribution,
    sourceHealth,
  };
}

export const LIST_PAGE_SIZE = 24;

export type ListHackathonsOptions = {
  online?: boolean;
  platform?: Platform;
  hasPrize?: boolean;
  regions?: Region[] | null;
  includeUnknownOnline?: boolean;
  page?: number;
};

export type PaginatedHackathons = {
  items: Hackathon[];
  hasNextPage: boolean;
  page: number;
};

export async function listHackathons(
  options: ListHackathonsOptions = {}
): Promise<PaginatedHackathons> {
  const page = Math.max(1, options.page ?? 1);

  // Fetch a larger pool so the in-memory ranker has material to work with.
  // We retrieve 3× the page size (minimum 72) then rank, slice to PAGE_SIZE,
  // and detect hasNextPage from the raw pool size.
  const FETCH_MULTIPLIER = 3;
  const fetchSize = LIST_PAGE_SIZE * FETCH_MULTIPLIER;
  const fetchFrom = (page - 1) * LIST_PAGE_SIZE;
  const fetchTo = fetchFrom + fetchSize;

  let query = (
    getReadClient()
      .from("hackathons")
      .select(HACKATHON_LIST_COLS)
      .order("deadline", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(fetchFrom, fetchTo)
  ) as unknown as SupabaseFilterBuilder;

  if (options.online !== undefined) {
    query = query.eq("is_online", options.online);
  }
  if (options.platform) {
    query = query.eq("platform", options.platform);
  }
  if (options.hasPrize) {
    query = query.not("prize_pool", "is", null);
  }

  query = applyActiveFilter(query);
  query = applyRegionFilter(query, options.regions, options.includeUnknownOnline);

  const { data, error } = await query.returns<HackathonRow[]>();

  if (error) {
    throw new Error(`Failed to list hackathons: ${error.message}`);
  }

  const rows = data ?? [];
  const hasNextPage = rows.length > LIST_PAGE_SIZE;
  const ranked = rankCatalogHackathons(rows.map(toHackathon));
  const items = ranked.slice(0, LIST_PAGE_SIZE);

  return { items, hasNextPage, page };
}

export async function pruneStaleByPlatform(
  platform: string,
  scrapedBefore: string
): Promise<number> {
  const { data, error } = await getWriteClient()
    .from("hackathons")
    .delete({ count: "exact" })
    .eq("platform", platform)
    .lt("scraped_at", scrapedBefore)
    .select("id");

  if (error) {
    throw new Error(
      `Failed to prune stale ${platform} rows: ${error.message}`
    );
  }

  return data?.length ?? 0;
}

export async function pruneExpiredByDeadline(
  deadlineBefore: string,
  options: { excludePlatforms?: string[] } = {}
): Promise<number> {
  let query = getWriteClient()
    .from("hackathons")
    .delete({ count: "exact" })
    .not("deadline", "is", null)
    .lt("deadline", deadlineBefore);

  const excludePlatforms = Array.from(
    new Set(
      (options.excludePlatforms ?? [])
        .map((platform) => platform.trim())
        .filter((platform) => platform.length > 0)
    )
  );

  if (excludePlatforms.length > 0) {
    const sqlInValues = `(${excludePlatforms
      .map((platform) => `"${platform.replace(/"/g, "")}"`)
      .join(",")})`;
    query = query.not("platform", "in", sqlInValues);
  }

  const { data, error } = await query.select("id");

  if (error) {
    throw new Error(
      `Failed to prune expired hackathons: ${error.message}`
    );
  }

  return data?.length ?? 0;
}

export async function recordScrapeSourceMetric(
  input: ScrapeSourceMetricInput
): Promise<void> {
  const payload = {
    run_id: input.runId,
    source: input.source,
    platform: input.platform,
    status: input.status,
    fetched_count: Math.max(0, Math.trunc(input.fetchedCount)),
    error_message: input.errorMessage ?? null,
  };

  const { error } = await getWriteClient()
    .from("scrape_source_metrics")
    .insert(payload);

  if (error) {
    throw new Error(`Failed to record scrape source metric: ${error.message}`);
  }
}

export async function getScrapeSourceHealth(
  windowDays = 14
): Promise<SourceHealthMetric[]> {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1_000;
  const cutoffIso = new Date(now - windowDays * dayMs).toISOString();
  const sevenDaysAgo = now - 7 * dayMs;

  const { data, error } = await getReadClient()
    .from("scrape_source_metrics")
    .select("source, platform, status, fetched_count, error_message, created_at")
    .gte("created_at", cutoffIso)
    .returns<ScrapeSourceMetricRow[]>();

  if (error) {
    throw new Error(`Failed to load scrape source health: ${error.message}`);
  }

  const bySource = new Map<string, ScrapeSourceMetricRow[]>();
  for (const row of data ?? []) {
    const bucket = bySource.get(row.source) ?? [];
    bucket.push(row);
    bySource.set(row.source, bucket);
  }

  const metrics: SourceHealthMetric[] = [];

  for (const [source, rows] of bySource.entries()) {
    rows.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const latestSuccess = rows.find((row) => row.status === "success") ?? null;
    const latestCount = latestSuccess?.fetched_count ?? 0;

    const weeklyRows = rows.filter((row) => {
      const ts = new Date(row.created_at).getTime();
      return !Number.isNaN(ts) && ts >= sevenDaysAgo;
    });

    const successRows = weeklyRows.filter((row) => row.status === "success");
    const failedRows = weeklyRows.filter((row) => row.status === "failed");

    const avgCount =
      successRows.length === 0
        ? 0
        : successRows.reduce((sum, row) => sum + row.fetched_count, 0) /
          successRows.length;
    const failureRate =
      weeklyRows.length === 0 ? 0 : failedRows.length / weeklyRows.length;
    const dropRatio = avgCount > 0 ? latestCount / avgCount : null;

    let alert: string | null = null;
    if (weeklyRows.length >= 3 && failureRate >= 0.4) {
      alert = `High failure rate (${Math.round(failureRate * 100)}%)`;
    } else if (avgCount >= 5 && dropRatio !== null && dropRatio <= 0.4) {
      alert = `Volume drop (${Math.round(dropRatio * 100)}% of 7d avg)`;
    }

    metrics.push({
      source,
      platform: rows[0]?.platform ?? "unknown",
      latestCount,
      avgCount7d: Number(avgCount.toFixed(2)),
      failureRate7d: Number(failureRate.toFixed(3)),
      dropRatio: dropRatio === null ? null : Number(dropRatio.toFixed(3)),
      alert,
    });
  }

  return metrics.sort((a, b) => a.source.localeCompare(b.source));
}
