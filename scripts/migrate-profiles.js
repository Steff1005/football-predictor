#!/usr/bin/env node
/**
 * Profiles migration: add first_name + last_name columns and update trigger.
 *
 * This script cannot run DDL directly via the Supabase JS client.
 * It prints the SQL to run in Supabase Dashboard → SQL Editor, then verifies
 * whether the columns already exist so you know if the migration is needed.
 *
 * Usage:  node scripts/migrate-profiles.js
 */

const path = require('path')
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const SQL = `
-- ── 1. Add columns (safe to re-run) ────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name  TEXT;

-- ── 2. Recreate handle_new_user to include full name ────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, first_name, last_name, total_points, total_predictions)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    0,
    0
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. Ensure trigger exists ────────────────────────────────────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
`

async function main() {
  console.log('╔══════════════════════════════════════════╗')
  console.log('║  Profiles Migration — full name support  ║')
  console.log('╚══════════════════════════════════════════╝\n')

  // Check if columns already exist by trying to select them
  const { error } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .limit(1)

  if (!error) {
    console.log('✅  Columns first_name and last_name already exist — migration not needed.\n')
    return
  }

  if (error.code === 'PGRST204' || error.message?.includes('first_name')) {
    console.log('⚠️  Columns are missing. Run this SQL in Supabase Dashboard → SQL Editor:\n')
    console.log('━'.repeat(60))
    console.log(SQL)
    console.log('━'.repeat(60))
    console.log('\nAfter running the SQL, re-run this script to verify.')
  } else {
    console.error('Unexpected error checking columns:', error.message)
  }
}

main().catch(err => { console.error('[fatal]', err.message); process.exit(1) })
