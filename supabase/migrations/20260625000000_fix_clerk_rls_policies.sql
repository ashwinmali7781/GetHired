-- ============================================================
-- Fix: Replace auth.uid() with Clerk-compatible auth.jwt()->>'sub'
-- and fix user_id column types to TEXT (Clerk IDs are strings like "user_xxx")
-- ============================================================

-- ── profiles ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Remove FK constraint that references auth.users (Clerk bypasses Supabase Auth)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
ALTER TABLE public.profiles ALTER COLUMN user_id TYPE TEXT;

-- Also add email column if missing (useSyncProfile upserts it)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING ((auth.jwt() ->> 'sub') = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK ((auth.jwt() ->> 'sub') = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING ((auth.jwt() ->> 'sub') = user_id);

-- ── practice_history ────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own history" ON public.practice_history;
DROP POLICY IF EXISTS "Users can insert own history" ON public.practice_history;

ALTER TABLE public.practice_history DROP CONSTRAINT IF EXISTS practice_history_user_id_fkey;
ALTER TABLE public.practice_history ALTER COLUMN user_id TYPE TEXT;

CREATE POLICY "Users can view own history" ON public.practice_history
  FOR SELECT USING ((auth.jwt() ->> 'sub') = user_id);
CREATE POLICY "Users can insert own history" ON public.practice_history
  FOR INSERT WITH CHECK ((auth.jwt() ->> 'sub') = user_id);

-- ── bookmarks ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own bookmarks" ON public.bookmarks;
DROP POLICY IF EXISTS "Users can insert own bookmarks" ON public.bookmarks;
DROP POLICY IF EXISTS "Users can delete own bookmarks" ON public.bookmarks;

ALTER TABLE public.bookmarks DROP CONSTRAINT IF EXISTS bookmarks_user_id_fkey;
ALTER TABLE public.bookmarks ALTER COLUMN user_id TYPE TEXT;

CREATE POLICY "Users can view own bookmarks" ON public.bookmarks
  FOR SELECT USING ((auth.jwt() ->> 'sub') = user_id);
CREATE POLICY "Users can insert own bookmarks" ON public.bookmarks
  FOR INSERT WITH CHECK ((auth.jwt() ->> 'sub') = user_id);
CREATE POLICY "Users can delete own bookmarks" ON public.bookmarks
  FOR DELETE USING ((auth.jwt() ->> 'sub') = user_id);

-- ── interview_sessions ───────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own sessions" ON public.interview_sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON public.interview_sessions;

ALTER TABLE public.interview_sessions DROP CONSTRAINT IF EXISTS interview_sessions_user_id_fkey;
ALTER TABLE public.interview_sessions ALTER COLUMN user_id TYPE TEXT;

CREATE POLICY "Users can view own sessions" ON public.interview_sessions
  FOR SELECT USING ((auth.jwt() ->> 'sub') = user_id);
CREATE POLICY "Users can insert own sessions" ON public.interview_sessions
  FOR INSERT WITH CHECK ((auth.jwt() ->> 'sub') = user_id);
