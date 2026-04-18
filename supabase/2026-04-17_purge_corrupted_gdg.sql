-- ============================================================
--  Purge corrupted GDG rows (location hardcoded as 'Ecuador')
--  These rows have location = 'Ecuador' injected by the old scraper
--  bug, not from the event itself. Deleting them so the fixed
--  scraper can re-index them with the real chapter city on the
--  next scheduled run.
--
--  Safe to run multiple times (DELETE WHERE is idempotent once rows
--  are gone). Run the SELECT preview first, confirm the count, then
--  run the DELETE.
-- ============================================================

-- 1. PREVIEW — confirm what will be deleted (read-only) -------
SELECT
  id,
  title,
  platform,
  location,
  is_online,
  region,
  scraped_at
FROM hackathons
WHERE platform = 'gdg'
  AND location = 'Ecuador'
  AND is_online = false
ORDER BY title;

-- ============================================================
--  Expected output: all the presential GDG events that were
--  given location='Ecuador' by the buggy scraper (Bengaluru,
--  Berlin, etc.). If any rows look genuinely Ecuadorian (e.g.
--  a GDG Quito event where the chapter city came back as
--  'Ecuador'), move them to the UPDATE section instead.
-- ============================================================


-- 2. DELETE — run after confirming the preview ----------------
/
DELETE FROM hackathons
WHERE platform = 'gdg'
  AND location = 'Ecuador'
  AND is_online = false;
*/


-- 3. BROADER SAFETY NET (optional) ----------------------------
--  Also catch any platform='gdg' presential event whose location
--  is 'Ecuador' but title/description clearly isn't Ecuador.
--  Uncomment if the basic delete above leaves stragglers.
/
DELETE FROM hackathons
WHERE platform = 'gdg'
  AND is_online = false
  AND region = 'ecuador'
  AND LOWER(COALESCE(title, '') || ' ' || COALESCE(description, ''))
      !~ '(ecuador|quito|guayaquil|cuenca|loja|manta|ambato|riobamba|ibarra|latacunga|esmeraldas|machala)';
*/


-- 4. VERIFICATION — run after the DELETE ----------------------
/
SELECT
  platform,
  location,
  is_online,
  region,
  COUNT(*) AS total
FROM hackathons
WHERE platform = 'gdg'
GROUP BY platform, location, is_online, region
ORDER BY total DESC;
*/

-- Expected: no rows with platform='gdg', location='Ecuador',
-- is_online=false after the delete.
