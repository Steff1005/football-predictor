-- ============================================================
-- Історія змін рахунку + позначка часу оновлення матчу
-- Запустити в Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Коли рядок матчу востаннє змінювався
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION touch_matches_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS matches_touch_updated_at ON matches;
CREATE TRIGGER matches_touch_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION touch_matches_updated_at();

-- 2. Журнал змін рахунку та статусу
CREATE TABLE IF NOT EXISTS match_score_history (
  id          bigserial   PRIMARY KEY,
  match_id    uuid        NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  old_home    integer,
  old_away    integer,
  new_home    integer,
  new_away    integer,
  old_status  text,
  new_status  text,
  changed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS match_score_history_match_idx
  ON match_score_history (match_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS match_score_history_time_idx
  ON match_score_history (changed_at DESC);

-- 3. Тригер: писати рядок щоразу, коли змінився рахунок або статус.
--    На рівні БД, а не в коді — так фіксуються ВСІ джерела змін
--    (sync-matches, live-scores, ручні правки, скрипти).
CREATE OR REPLACE FUNCTION log_match_score_change()
RETURNS trigger AS $$
BEGIN
  IF NEW.home_score IS DISTINCT FROM OLD.home_score
     OR NEW.away_score IS DISTINCT FROM OLD.away_score
     OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO match_score_history
      (match_id, old_home, old_away, new_home, new_away, old_status, new_status)
    VALUES
      (NEW.id, OLD.home_score, OLD.away_score, NEW.home_score, NEW.away_score,
       OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS matches_log_score_change ON matches;
CREATE TRIGGER matches_log_score_change
  AFTER UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION log_match_score_change();

-- 4. RLS: журнал — суто службовий, читає лише service role
ALTER TABLE match_score_history ENABLE ROW LEVEL SECURITY;
-- Політик навмисно немає: клієнтські ключі доступу не мають,
-- service role обходить RLS.
