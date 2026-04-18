-- ============================================================
-- Supabase distributed rate limiter for API routes
-- Run in Supabase SQL Editor before enabling distributed mode.
-- Safe to re-run.
-- ============================================================

BEGIN;

-- 1) Storage table ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_updated_at
  ON public.api_rate_limits(updated_at);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_rate_limits FORCE ROW LEVEL SECURITY;

-- Remove old policies if present. We keep this table server-only.
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'api_rate_limits'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.api_rate_limits;', p.policyname);
  END LOOP;
END
$$;

REVOKE ALL ON TABLE public.api_rate_limits FROM anon;
REVOKE ALL ON TABLE public.api_rate_limits FROM authenticated;


-- 2) Atomic consume function ------------------------------------
DROP FUNCTION IF EXISTS public.consume_api_rate_limit(TEXT, INTEGER, INTEGER);

CREATE FUNCTION public.consume_api_rate_limit(
  p_bucket_key TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  retry_after_sec INTEGER,
  current_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  now_ts TIMESTAMPTZ := NOW();
  safe_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 0), 1), 10000);
  safe_window_seconds INTEGER := LEAST(GREATEST(COALESCE(p_window_seconds, 0), 1), 86400);
  normalized_bucket_key TEXT := LEFT(TRIM(COALESCE(p_bucket_key, '')), 250);
  current_window_start TIMESTAMPTZ;
  v_count INTEGER;
  v_window_started_at TIMESTAMPTZ;
BEGIN
  IF normalized_bucket_key = '' THEN
    RAISE EXCEPTION 'Invalid bucket key';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 10000 THEN
    RAISE EXCEPTION 'Invalid limit value';
  END IF;

  IF p_window_seconds IS NULL OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'Invalid window value';
  END IF;

  current_window_start :=
    TO_TIMESTAMP(FLOOR(EXTRACT(EPOCH FROM now_ts) / safe_window_seconds) * safe_window_seconds);

  INSERT INTO public.api_rate_limits AS rl (
    bucket_key,
    window_started_at,
    request_count,
    updated_at
  )
  VALUES (
    normalized_bucket_key,
    current_window_start,
    1,
    now_ts
  )
  ON CONFLICT (bucket_key)
  DO UPDATE
  SET
    window_started_at = CASE
      WHEN rl.window_started_at < current_window_start THEN current_window_start
      ELSE rl.window_started_at
    END,
    request_count = CASE
      WHEN rl.window_started_at < current_window_start THEN 1
      ELSE rl.request_count + 1
    END,
    updated_at = now_ts
  RETURNING request_count, window_started_at
  INTO v_count, v_window_started_at;

  current_count := v_count;
  allowed := (v_count <= safe_limit);
  remaining := GREATEST(0, safe_limit - v_count);
  retry_after_sec := GREATEST(
    1,
    safe_window_seconds - FLOOR(EXTRACT(EPOCH FROM (now_ts - v_window_started_at)))::INTEGER
  );

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_api_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_api_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

COMMIT;

-- Optional verification ----------------------------------------
SELECT * FROM public.consume_api_rate_limit('chat:127.0.0.1', 2, 60);
SELECT * FROM public.consume_api_rate_limit('chat:127.0.0.1', 2, 60);
 SELECT * FROM public.consume_api_rate_limit('chat:127.0.0.1', 2, 60);
