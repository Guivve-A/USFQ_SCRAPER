-- ============================================================
--  Phase 1 / Step 2 — Hide expired events (no deletes, DB-side filter)
--  Run in Supabase SQL Editor AFTER 2026-04-17_region_column.sql.
--  Safe to re-run: OR REPLACE + IF NOT EXISTS throughout.
-- ============================================================

-- 1. Index so the deadline filter costs nothing ---------------
CREATE INDEX IF NOT EXISTS idx_hackathons_deadline
  ON hackathons(deadline);

-- 2. Replace match_hackathons with deadline-aware version -----
--    All existing parameters preserved; only WHERE clause changes.
CREATE OR REPLACE FUNCTION match_hackathons(
  query_embedding VECTOR(384),
  match_threshold FLOAT,
  match_count INT,
  filter_online BOOL DEFAULT NULL,
  filter_platform TEXT DEFAULT NULL,
  filter_regions TEXT[] DEFAULT NULL,
  include_unknown_region_online BOOL DEFAULT TRUE
)
RETURNS TABLE (
  id BIGINT,
  title TEXT,
  description TEXT,
  desc_translated TEXT,
  url TEXT,
  platform TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  deadline TIMESTAMPTZ,
  location TEXT,
  is_online BOOLEAN,
  prize_pool TEXT,
  prize_amount NUMERIC,
  tags TEXT[],
  image_url TEXT,
  organizer TEXT,
  embedding VECTOR(384),
  scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  region TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    h.id,
    h.title,
    h.description,
    h.desc_translated,
    h.url,
    h.platform,
    h.start_date,
    h.end_date,
    h.deadline,
    h.location,
    h.is_online,
    h.prize_pool,
    h.prize_amount,
    h.tags,
    h.image_url,
    h.organizer,
    h.embedding,
    h.scraped_at,
    h.created_at,
    h.region,
    1 - (h.embedding <=> query_embedding) AS similarity
  FROM hackathons h
  WHERE h.embedding IS NOT NULL
    AND 1 - (h.embedding <=> query_embedding) > match_threshold
    AND (filter_online IS NULL OR h.is_online = filter_online)
    AND (filter_platform IS NULL OR h.platform = filter_platform)
    AND (
      filter_regions IS NULL
      OR h.region = ANY(filter_regions)
      OR (include_unknown_region_online AND h.region IS NULL AND h.is_online = true)
    )
    AND (h.deadline IS NULL OR h.deadline >= NOW())
  ORDER BY h.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 3. Sanity checks (optional) ---------------------------------
-- SELECT COUNT(*) FROM hackathons WHERE deadline < NOW();          -- rows hidden
-- SELECT COUNT(*) FROM hackathons WHERE deadline IS NULL OR deadline >= NOW(); -- rows visible
