-- Switch user identification from Supabase Auth (auth.users / auth.uid())
-- to Clerk, via Supabase's "Third-Party Auth" JWT integration.
--
-- MANUAL STEP REQUIRED (cannot be done from SQL):
-- In the Supabase Dashboard go to Authentication -> Sign In Providers ->
-- Add provider -> Clerk, and paste your Clerk "Frontend API URL"
-- (Clerk Dashboard -> Configure -> API Keys -> Frontend API URL, looks like
-- https://your-app-name.clerk.accounts.dev). Once that's saved, Supabase
-- verifies Clerk-issued JWTs automatically and `auth.jwt() ->> 'sub'`
-- resolves to the signed-in Clerk user id on every request.

-- 1. Drop the auth.users-based auto-profile trigger.
--    Clerk never inserts into Supabase's auth.users table, so this would
--    never fire again anyway; the app now upserts profiles client-side
--    (see src/hooks/use-sync-profile.js).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Drop old Supabase-Auth-only RLS policies.
DROP POLICY IF EXISTS "Users can view own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own history"   ON public.practice_history;
DROP POLICY IF EXISTS "Users can insert own history" ON public.practice_history;
DROP POLICY IF EXISTS "Users can view own bookmarks"   ON public.bookmarks;
DROP POLICY IF EXISTS "Users can insert own bookmarks" ON public.bookmarks;
DROP POLICY IF EXISTS "Users can delete own bookmarks" ON public.bookmarks;
DROP POLICY IF EXISTS "Users can view own sessions"   ON public.interview_sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON public.interview_sessions;

-- 3. Re-point user_id columns at Clerk's string user ids ("user_xxx")
--    instead of Supabase's auth.users(id) uuids.
ALTER TABLE public.profiles           DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
ALTER TABLE public.practice_history   DROP CONSTRAINT IF EXISTS practice_history_user_id_fkey;
ALTER TABLE public.bookmarks          DROP CONSTRAINT IF EXISTS bookmarks_user_id_fkey;
ALTER TABLE public.interview_sessions DROP CONSTRAINT IF EXISTS interview_sessions_user_id_fkey;

ALTER TABLE public.profiles           ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE public.practice_history   ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE public.bookmarks          ALTER COLUMN user_id TYPE TEXT USING user_id::text;
ALTER TABLE public.interview_sessions ALTER COLUMN user_id TYPE TEXT USING user_id::text;

-- 4. New RLS policies based on the Clerk user id inside the verified JWT.
--    `profiles` and the leaderboard need to be readable across users (to
--    show names/scores on the leaderboard) — note this is also a fix for
--    the leaderboard, which previously could only ever show the signed-in
--    user's own rows because the old policies restricted SELECT to
--    `auth.uid() = user_id`.
CREATE POLICY "Authenticated users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.jwt() ->> 'sub') = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.jwt() ->> 'sub') = user_id);

CREATE POLICY "Authenticated users can view all history" ON public.practice_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own history" ON public.practice_history FOR INSERT WITH CHECK ((auth.jwt() ->> 'sub') = user_id);

CREATE POLICY "Users can view own bookmarks"   ON public.bookmarks FOR SELECT USING ((auth.jwt() ->> 'sub') = user_id);
CREATE POLICY "Users can insert own bookmarks" ON public.bookmarks FOR INSERT WITH CHECK ((auth.jwt() ->> 'sub') = user_id);
CREATE POLICY "Users can delete own bookmarks" ON public.bookmarks FOR DELETE USING ((auth.jwt() ->> 'sub') = user_id);

CREATE POLICY "Authenticated users can view all sessions" ON public.interview_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own sessions" ON public.interview_sessions FOR INSERT WITH CHECK ((auth.jwt() ->> 'sub') = user_id);
