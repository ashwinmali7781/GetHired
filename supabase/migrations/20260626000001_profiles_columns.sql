-- ─────────────────────────────────────────────────────────────────
-- Add missing columns to profiles that ProfilePage tries to save
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio          TEXT,
  ADD COLUMN IF NOT EXISTS location     TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url   TEXT,
  ADD COLUMN IF NOT EXISTS github_url   TEXT,
  ADD COLUMN IF NOT EXISTS website_url  TEXT,
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT now();

-- Allow anyone to SELECT profiles (needed for leaderboard name lookup)
-- Individual data is still protected by UPDATE/INSERT policies
DROP POLICY IF EXISTS "Public profiles are viewable by all" ON public.profiles;
CREATE POLICY "Public profiles are viewable by all" ON public.profiles
  FOR SELECT USING (true);
