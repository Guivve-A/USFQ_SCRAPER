-- ============================================================
--  Data fix — Region false positives (GDG hardcoded location bug)
--  Run immediately in Supabase SQL Editor.
--  Safe to re-run: only touches region = 'ecuador' + is_online = false
--  rows that do NOT mention Ecuador in their location/title/description.
-- ============================================================

-- Preview — see what will be corrected (read-only) ---------
 SELECT id, title, location, is_online, region, platform
 FROM hackathons
 WHERE region = 'ecuador'
   AND is_online = false
   AND LOWER(COALESCE(location, '') || ' ' || COALESCE(title, '') || ' ' || COALESCE(description, ''))
       !~ '(ecuador|quito|guayaquil|cuenca|loja|manta|ambato|machala|riobamba|portoviejo|ibarra|esmeraldas|latacunga)'
 ORDER BY platform, title;

-- 2. Correct the false positives -------------------------------
UPDATE hackathons
SET region = CASE
  -- Known LATAM cities/countries → reclassify as latam
  WHEN LOWER(COALESCE(location, '') || ' ' || COALESCE(title, ''))
       ~ '(mexico|méxico|colombia|bogotá|bogota|perú|peru|lima|brazil|brasil|são paulo|sao paulo|argentina|buenos aires|chile|santiago|venezuela|bolivia|paraguay|uruguay|cuba|panama|costa rica|guatemala|honduras|nicaragua|dominicana|puerto rico)'
    THEN 'latam'
  -- Everything else presential that is NOT Ecuador → other
  ELSE 'other'
END
WHERE region = 'ecuador'
  AND is_online = false
  AND LOWER(
        COALESCE(location, '') || ' ' ||
        COALESCE(title, '')    || ' ' ||
        COALESCE(description, '')
      ) !~ '(ecuador|quito|guayaquil|cuenca|loja|manta|ambato|machala|riobamba|portoviejo|ibarra|esmeraldas|latacunga)';

-- 3. Verification (run after the UPDATE) ----------------------
-- SELECT region, is_online, COUNT(*) AS total
-- FROM hackathons
-- GROUP BY region, is_online
-- ORDER BY region, is_online;

-- Expected: no rows with region='ecuador' AND is_online=false
-- that don't mention Ecuador.
