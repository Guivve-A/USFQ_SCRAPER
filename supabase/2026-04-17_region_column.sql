-- ============================================================
--  Phase 1 / Step 1 — Geographic filter (Ecuador value-prop)
--  Run this once in Supabase SQL Editor BEFORE deploying new app code.
--  Safe to re-run: all statements use IF [NOT] EXISTS / OR REPLACE.
-- ============================================================

-- 1. Add region column + constraint + indexes -----------------
ALTER TABLE hackathons
  ADD COLUMN IF NOT EXISTS region TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hackathons_region_check'
  ) THEN
    ALTER TABLE hackathons
      ADD CONSTRAINT hackathons_region_check
      CHECK (region IS NULL OR region IN ('ecuador','latam','global','other'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_hackathons_region
  ON hackathons(region);

CREATE INDEX IF NOT EXISTS idx_hackathons_region_online
  ON hackathons(region, is_online);

-- 2. Best-effort backfill for existing rows -------------------
--    Heuristic: parse location text + is_online flag.
--    Scraper will refine on next run; this gets the catalog usable today.
UPDATE hackathons
SET region = CASE
  WHEN LOWER(COALESCE(location, '')) ~ '(ecuador|quito|guayaquil|cuenca|loja|manta|ambato)'
    THEN 'ecuador'
  WHEN LOWER(COALESCE(location, '')) ~ '(latam|latin america|latinoam|iberoam|sudameric|south america)'
    THEN 'latam'
  WHEN is_online = true
    AND LOWER(COALESCE(location, '')) !~ '(argentina|brazil|brasil|mexico|colombia|chile|peru|venezuela|bolivia|paraguay|uruguay|india|united states|usa|\bu\.s\.\b|canada|united kingdom|\buk\b|germany|france|italy|spain|espana|china|japan|australia|nigeria|kenya)'
    THEN 'global'
  WHEN LOWER(COALESCE(location, '')) ~ '(argentina|brazil|brasil|mexico|colombia|chile|peru|venezuela|bolivia|paraguay|uruguay|india|united states|usa|canada|united kingdom|germany|france|italy|spain|china|japan|australia|nigeria|kenya)'
    THEN 'other'
  ELSE NULL
END
WHERE region IS NULL;

-- 3. Replace match_hackathons RPC with region-aware version ---
--    Keeps existing 5 named parameters; adds two optional ones
--    so deployed code that doesn't pass them continues to work.
DROP FUNCTION IF EXISTS match_hackathons(vector, float, int, bool, text);
DROP FUNCTION IF EXISTS match_hackathons(vector, float, int, bool, text, text[], bool);

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
  ORDER BY h.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 4. Sanity checks (run these, not required to commit) --------
-- SELECT region, COUNT(*) FROM hackathons GROUP BY region ORDER BY 2 DESC;
-- SELECT title, location, is_online, region FROM hackathons ORDER BY random() LIMIT 10;
