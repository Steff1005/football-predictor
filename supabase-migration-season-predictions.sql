-- ============================================================
-- Прогнози на сезон 2026/27 (топ-5 ліг)
-- Запустити в Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

CREATE TABLE IF NOT EXISTS season_predictions (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season       text        NOT NULL DEFAULT '2026-27',
  league_code  text        NOT NULL,          -- PL | PD | SA | BL1 | FL1

  champion_id  integer     NOT NULL,          -- 1 місце
  place2_id    integer     NOT NULL,
  place3_id    integer     NOT NULL,
  place4_id    integer     NOT NULL,

  rel1_id      integer     NOT NULL,          -- три останні місця
  rel2_id      integer     NOT NULL,
  rel3_id      integer     NOT NULL,

  positive_id  integer     NOT NULL,          -- позитивний сюрприз сезону
  negative_id  integer     NOT NULL,          -- негативний сюрприз сезону

  created_at   timestamptz NOT NULL DEFAULT now(),

  -- Один прогноз на лігу — редагування не передбачене
  UNIQUE (user_id, season, league_code)
);

CREATE INDEX IF NOT EXISTS season_predictions_league_idx
  ON season_predictions (season, league_code);

ALTER TABLE season_predictions ENABLE ROW LEVEL SECURITY;

-- Читати може будь-який автентифікований учасник (картки видно всім)
DROP POLICY IF EXISTS "Anyone can read season predictions" ON season_predictions;
CREATE POLICY "Anyone can read season predictions"
  ON season_predictions FOR SELECT
  TO authenticated
  USING (true);

-- Створити можна лише свій прогноз
DROP POLICY IF EXISTS "Users insert own season prediction" ON season_predictions;
CREATE POLICY "Users insert own season prediction"
  ON season_predictions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE/DELETE політик немає навмисно: після збереження картка незмінна.
-- Виправити помилковий прогноз може лише адмін через service role.
