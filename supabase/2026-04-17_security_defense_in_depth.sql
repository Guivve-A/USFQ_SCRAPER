-- ============================================================
-- Defense in Depth: RLS + read-only access + RPC hardening
-- Safe to re-run in Supabase SQL Editor.
-- ============================================================

BEGIN;

-- 1) Enforce Row Level Security for hackathons ----------------
ALTER TABLE public.hackathons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hackathons FORCE ROW LEVEL SECURITY;

-- Remove any legacy policies to avoid accidental write access.
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'hackathons'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.hackathons;', p.policyname);
  END LOOP;
END
$$;

-- Strict read-only policies for public and authenticated users.
CREATE POLICY hackathons_read_anon
  ON public.hackathons
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY hackathons_read_authenticated
  ON public.hackathons
  FOR SELECT
  TO authenticated
  USING (true);

-- Explicit table privileges: SELECT only for client-facing roles.
REVOKE ALL ON TABLE public.hackathons FROM anon;
REVOKE ALL ON TABLE public.hackathons FROM authenticated;
GRANT SELECT ON TABLE public.hackathons TO anon;
GRANT SELECT ON TABLE public.hackathons TO authenticated;


-- 2) RPC hardening: static SQL and bounded parameters ---------
-- No string concatenation or EXECUTE dynamic SQL is used.
-- Return shape changed (embedding removed), so we must drop then recreate.
DROP FUNCTION IF EXISTS public.match_hackathons(
  vector,
  double precision,
  integer,
  boolean,
  text,
  text[],
  boolean
);
DROP FUNCTION IF EXISTS public.match_hackathons(
  vector,
  double precision,
  integer,
  boolean,
  text
);

CREATE FUNCTION public.match_hackathons(
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
  scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  region TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  safe_match_count INT := LEAST(GREATEST(COALESCE(match_count, 10), 1), 50);
  safe_match_threshold FLOAT := LEAST(GREATEST(COALESCE(match_threshold, 0.4), 0), 1);
  safe_filter_platform TEXT := CASE
    WHEN filter_platform IS NULL THEN NULL
    WHEN filter_platform = ANY (ARRAY['devpost', 'mlh', 'eventbrite', 'gdg', 'lablab', 'luma'])
      THEN filter_platform
    ELSE NULL
  END;
  safe_filter_regions TEXT[] := NULL;
BEGIN
  IF filter_platform IS NOT NULL AND safe_filter_platform IS NULL THEN
    RAISE EXCEPTION 'Invalid filter_platform value';
  END IF;

  IF filter_regions IS NOT NULL THEN
    IF COALESCE(array_length(filter_regions, 1), 0) > 8 THEN
      RAISE EXCEPTION 'Too many filter_regions values';
    END IF;

    SELECT ARRAY(
      SELECT DISTINCT region_value
      FROM unnest(filter_regions) AS region_value
      WHERE region_value IN ('ecuador', 'latam', 'global', 'other')
      LIMIT 8
    )
    INTO safe_filter_regions;

    IF COALESCE(array_length(safe_filter_regions, 1), 0) = 0 THEN
      RAISE EXCEPTION 'Invalid filter_regions values';
    END IF;
  END IF;

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
    h.scraped_at,
    h.created_at,
    h.region,
    1 - (h.embedding <=> query_embedding) AS similarity
  FROM public.hackathons AS h
  WHERE h.embedding IS NOT NULL
    AND 1 - (h.embedding <=> query_embedding) > safe_match_threshold
    AND (filter_online IS NULL OR h.is_online = filter_online)
    AND (safe_filter_platform IS NULL OR h.platform = safe_filter_platform)
    AND (
      safe_filter_regions IS NULL
      OR h.region = ANY(safe_filter_regions)
      OR (include_unknown_region_online AND h.region IS NULL AND h.is_online = true)
    )
    AND (h.deadline IS NULL OR h.deadline >= NOW())
  ORDER BY h.embedding <=> query_embedding
  LIMIT safe_match_count;
END;
$$;

-- Function execution privileges for API-facing roles.
REVOKE ALL
  ON FUNCTION public.match_hackathons(vector, double precision, integer, boolean, text, text[], boolean)
  FROM PUBLIC;

GRANT EXECUTE
  ON FUNCTION public.match_hackathons(vector, double precision, integer, boolean, text, text[], boolean)
  TO anon, authenticated, service_role;

COMMIT;

-- Optional verification queries:
SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'hackathons';
 SELECT schemaname, tablename, policyname, cmd, roles FROM pg_policies WHERE tablename = 'hackathons';
