-- ============================================================
-- New features migration
-- ============================================================

-- 1. Problem notes (per-user, per-question scratch pad)
CREATE TABLE IF NOT EXISTS public.problem_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  content     TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id)
);
ALTER TABLE public.problem_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notes" ON public.problem_notes
  FOR SELECT USING ((auth.jwt() ->> 'sub') = user_id);
CREATE POLICY "Users can insert own notes" ON public.problem_notes
  FOR INSERT WITH CHECK ((auth.jwt() ->> 'sub') = user_id);
CREATE POLICY "Users can update own notes" ON public.problem_notes
  FOR UPDATE USING ((auth.jwt() ->> 'sub') = user_id);
CREATE POLICY "Users can delete own notes" ON public.problem_notes
  FOR DELETE USING ((auth.jwt() ->> 'sub') = user_id);
CREATE INDEX IF NOT EXISTS problem_notes_user_id_idx ON public.problem_notes (user_id);

-- 2. Resume analysis history
CREATE TABLE IF NOT EXISTS public.resume_analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL,
  file_name       TEXT,
  ats_score       INTEGER NOT NULL DEFAULT 0,
  sections_present TEXT[],
  missing_keywords TEXT[],
  improvements     TEXT[],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.resume_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own analyses" ON public.resume_analyses
  FOR SELECT USING ((auth.jwt() ->> 'sub') = user_id);
CREATE POLICY "Users can insert own analyses" ON public.resume_analyses
  FOR INSERT WITH CHECK ((auth.jwt() ->> 'sub') = user_id);
CREATE INDEX IF NOT EXISTS resume_analyses_user_id_idx ON public.resume_analyses (user_id, created_at DESC);
