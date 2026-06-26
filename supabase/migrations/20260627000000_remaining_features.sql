-- ═══════════════════════════════════════════════════════
-- Remaining features migration
-- ═══════════════════════════════════════════════════════

-- 1. Discussion threads (per-problem comments)
CREATE TABLE IF NOT EXISTS public.discussions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL,
  display_name TEXT,
  content     TEXT NOT NULL,
  parent_id   UUID REFERENCES public.discussions(id) ON DELETE CASCADE,
  upvotes     INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.discussions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view discussions"   ON public.discussions FOR SELECT USING (true);
CREATE POLICY "Users can insert discussions"  ON public.discussions FOR INSERT WITH CHECK ((auth.jwt() ->> 'sub') = user_id);
CREATE POLICY "Users can update own posts"    ON public.discussions FOR UPDATE USING ((auth.jwt() ->> 'sub') = user_id);
CREATE POLICY "Users can delete own posts"    ON public.discussions FOR DELETE USING ((auth.jwt() ->> 'sub') = user_id);
CREATE INDEX IF NOT EXISTS discussions_question_idx ON public.discussions (question_id, created_at DESC);

-- discussion upvotes (prevent double-voting)
CREATE TABLE IF NOT EXISTS public.discussion_votes (
  user_id       TEXT NOT NULL,
  discussion_id UUID NOT NULL REFERENCES public.discussions(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, discussion_id)
);
ALTER TABLE public.discussion_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own votes" ON public.discussion_votes FOR ALL USING ((auth.jwt() ->> 'sub') = user_id);

-- 2. XP / points log
CREATE TABLE IF NOT EXISTS public.xp_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL,
  amount     INTEGER NOT NULL,
  reason     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.xp_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own XP"   ON public.xp_log FOR SELECT USING ((auth.jwt() ->> 'sub') = user_id);
CREATE POLICY "Users insert own XP" ON public.xp_log FOR INSERT WITH CHECK ((auth.jwt() ->> 'sub') = user_id);
CREATE INDEX IF NOT EXISTS xp_log_user_idx ON public.xp_log (user_id, created_at DESC);

-- Add total_xp cache column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_xp INTEGER NOT NULL DEFAULT 0;

-- 3. Weekly contest table
CREATE TABLE IF NOT EXISTS public.contests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,
  question_ids UUID[] NOT NULL DEFAULT '{}'
);
ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view contests" ON public.contests FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.contest_submissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id  UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL,
  question_id UUID NOT NULL REFERENCES public.questions(id),
  is_correct  BOOLEAN NOT NULL DEFAULT false,
  time_taken  INTEGER,  -- seconds
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contest_id, user_id, question_id)
);
ALTER TABLE public.contest_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view contest submissions"  ON public.contest_submissions FOR SELECT USING (true);
CREATE POLICY "Users insert own contest submissions" ON public.contest_submissions FOR INSERT WITH CHECK ((auth.jwt() ->> 'sub') = user_id);
