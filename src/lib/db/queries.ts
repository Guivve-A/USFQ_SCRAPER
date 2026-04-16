import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Hackathon, Platform } from "@/types/hackathon";

export type MatchOptions = {
  matchThreshold?: number;
  matchCount?: number;
  online?: boolean;
  platform?: Platform;
};

type HackathonRow = {
  id: number;
  title: string;
  description: string | null;
  desc_translated: string | null;
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
  embedding: number[] | null;
  scraped_at: string;
  created_at: string;
};

type MatchHackathonRow = HackathonRow & {
  similarity: number;
};

type SearchRpcParams = {
  query_embedding: string;
  match_threshold: number;
  match_count: number;
  filter_online: boolean | null;
  filter_platform: string | null;
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
    desc_translated: row.desc_translated,
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
    desc_translated: hackathon.desc_translated,
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

export async function getRecentHackathons(limit = 10): Promise<Hackathon[]> {
  const { data, error } = await getReadClient()
    .from("hackathons")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<HackathonRow[]>();

  if (error) {
    throw new Error(`Failed to get recent hackathons: ${error.message}`);
  }

  return (data ?? []).map(toHackathon);
}

export type SystemStats = {
  total: number;
  embedded: number;
  pending: number;
  embeddingCoverage: number;
  latestScrapedAt: string | null;
  platformDistribution: Record<string, number>;
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

  return {
    total: totalCount,
    embedded: embeddedCount,
    pending: Math.max(0, totalCount - embeddedCount),
    embeddingCoverage:
      totalCount === 0 ? 0 : Number((embeddedCount / totalCount).toFixed(4)),
    latestScrapedAt: latestRow?.scraped_at ?? null,
    platformDistribution,
  };
}

export type ListHackathonsOptions = {
  online?: boolean;
  platform?: Platform;
  hasPrize?: boolean;
  limit?: number;
};

export async function listHackathons(
  options: ListHackathonsOptions = {}
): Promise<Hackathon[]> {
  let query = getReadClient()
    .from("hackathons")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 60);

  if (options.online !== undefined) {
    query = query.eq("is_online", options.online);
  }
  if (options.platform) {
    query = query.eq("platform", options.platform);
  }
  if (options.hasPrize) {
    query = query.not("prize_pool", "is", null);
  }

  const { data, error } = await query.returns<HackathonRow[]>();

  if (error) {
    throw new Error(`Failed to list hackathons: ${error.message}`);
  }

  return (data ?? []).map(toHackathon);
}

export async function updateTranslation(
  id: number,
  text: string
): Promise<Hackathon> {
  const { data, error } = await getWriteClient()
    .from("hackathons")
    .update({ desc_translated: text })
    .eq("id", id)
    .select("*")
    .single<HackathonRow>();

  if (error || !data) {
    throw new Error(
      `Failed to update translated description: ${error?.message ?? "unknown"}`
    );
  }

  return toHackathon(data);
}
