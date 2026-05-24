#!/usr/bin/env node
/**
 * Creates the "avatars" public storage bucket in Supabase.
 * Usage: node scripts/setup-storage.js
 */

const path = require('path')
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') })

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

async function main() {
  const { error } = await supabase.storage.createBucket('avatars', {
    public: true,
    fileSizeLimit: 5242880,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  })

  if (error) {
    if (error.message.toLowerCase().includes('already exist')) {
      console.log('✅ Bucket "avatars" already exists — skipping creation')
    } else {
      console.error('❌ Failed to create bucket:', error.message)
      process.exit(1)
    }
  } else {
    console.log('✅ Created public bucket "avatars"')
  }

  console.log(`
Run this SQL in the Supabase SQL Editor to set up storage access policies:

-- Public read (anyone can view avatars)
CREATE POLICY "avatars public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Authenticated users can upload/replace their own avatar
CREATE POLICY "avatars auth upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (select auth.uid())::text = split_part(name, '.', 1));

CREATE POLICY "avatars auth update"
ON storage.objects FOR UPDATE
TO authenticated
USING   (bucket_id = 'avatars' AND (select auth.uid())::text = split_part(name, '.', 1))
WITH CHECK (bucket_id = 'avatars' AND (select auth.uid())::text = split_part(name, '.', 1));
`)
}

main().catch(console.error)
