import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Hackathon, SearchParams } from "@/types/hackathon";

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

function getDbEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable");
  }

  if (!anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable");
  }

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
  }

  return { url, anonKey, serviceRoleKey };
}

const env = getDbEnv();

const readClient: SupabaseClient = createClient(env.url, env.anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const writeClient: SupabaseClient = createClient(env.url, env.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function toHackathon(row: HackathonRow): Hackathon {
  return {
    id: String(row.id),
    title: row.title,
    description: row.description ?? "",
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

function parseEmbeddingInput(query: string): string {
  const trimmed = query.trim();

  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    throw new Error(
      "SearchParams.query must be a vector literal like [0.1,0.2,...] after embedding generation."
    );
  }

  return trimmed;
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

  const { data, error } = await writeClient
    .from("hackathons")
    .upsert(payload, { onConflict: "url" })
    .select("*")
    .single<HackathonRow>();

  if (error || !data) {
    throw new Error(`Failed to upsert hackathon: ${error?.message ?? "unknown"}`);
  }

  return toHackathon(data);
}

export async function searchHackathons(
  params: SearchParams
): Promise<Array<Hackathon & { similarity: number }>> {
  const queryEmbedding = parseEmbeddingInput(params.query);

  const rpcParams: SearchRpcParams = {
    query_embedding: queryEmbedding,
    match_threshold: 0.75,
    match_count: params.limit ?? 10,
    filter_online: params.online ?? null,
    filter_platform: params.platform ?? null,
  };

  const { data, error } = await readClient.rpc("match_hackathons", rpcParams);

  if (error) {
    throw new Error(`Failed to search hackathons: ${error.message}`);
  }

  const rows = (data ?? []) as MatchHackathonRow[];
  return rows.map((row) => ({ ...toHackathon(row), similarity: row.similarity }));
}

export async function getHackathonById(id: number): Promise<Hackathon | null> {
  const { data, error } = await readClient
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
  const { data, error } = await readClient
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
  const { data, error } = await readClient
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

export async function updateTranslation(
  id: number,
  text: string
): Promise<Hackathon> {
  const { data, error } = await writeClient
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
