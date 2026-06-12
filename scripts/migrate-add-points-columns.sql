-- ============================================================
-- Migration: add points_exact and points_result to predictions
-- Run this in Supabase SQL Editor BEFORE deploying the new code
-- ============================================================

-- Step 1: Add columns (safe to run multiple times)
ALTER TABLE predictions
  ADD COLUMN IF NOT EXISTS points_exact  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points_result INTEGER NOT NULL DEFAULT 0;

-- Step 2: Backfill from existing points values
--   Exact score (points = 4) → points_exact = 3, points_result = 1
--   Correct result (points = 1) → points_exact = 0, points_result = 1
--   Wrong (points = 0) → points_exact = 0, points_result = 0
UPDATE predictions
SET
  points_exact  = CASE WHEN points = 4 THEN 3 ELSE 0 END,
  points_result = CASE WHEN points >= 1 THEN 1 ELSE 0 END
WHERE is_calculated = true AND points IS NOT NULL;

-- Step 3: Verify results
SELECT
  points,
  points_exact,
  points_result,
  COUNT(*) AS cnt
FROM predictions
WHERE is_calculated = true
GROUP BY points, points_exact, points_result
ORDER BY points DESC;
-- Expected:
--  points=4, points_exact=3, points_result=1
--  points=1, points_exact=0, points_result=1
--  points=0, points_exact=0, points_result=0
