-- Performance indexes for HackFinder
-- Run in Supabase SQL Editor. All use IF NOT EXISTS — safe to re-run.

-- Speeds up the active-event filter (deadline IS NULL OR deadline >= now())
-- used in listHackathons, getRecentHackathons, getRelatedHackathons.
CREATE INDEX IF NOT EXISTS idx_hackathons_deadline
  ON public.hackathons (deadline ASC NULLS LAST);

-- Speeds up region + is_online filters used by applyRegionFilter.
CREATE INDEX IF NOT EXISTS idx_hackathons_region_online
  ON public.hackathons (region, is_online);

-- Speeds up platform listing and stale-prune queries.
CREATE INDEX IF NOT EXISTS idx_hackathons_platform_scraped
  ON public.hackathons (platform, scraped_at DESC);

-- Speeds up embedding coverage check (WHERE embedding IS NULL).
CREATE INDEX IF NOT EXISTS idx_hackathons_embedding_null
  ON public.hackathons (id)
  WHERE embedding IS NULL;

-- Speeds up the daily health-check query on scrape_source_metrics.
CREATE INDEX IF NOT EXISTS idx_scrape_source_metrics_created_at
  ON public.scrape_source_metrics (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scrape_source_metrics_source_created
  ON public.scrape_source_metrics (source, created_at DESC);
