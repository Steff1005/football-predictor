-- Push notifications migration
-- Run in Supabase SQL Editor (Dashboard → SQL Editor)

-- 1. Add notification preferences to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notify_results  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_reminder boolean NOT NULL DEFAULT true;

-- 2. Create push_subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    text        NOT NULL UNIQUE,
  subscription jsonb      NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 4. Users can manage only their own subscriptions
CREATE POLICY "Users manage own push subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Service role can read all (for sending notifications from API)
-- No extra policy needed — service role bypasses RLS by default.
