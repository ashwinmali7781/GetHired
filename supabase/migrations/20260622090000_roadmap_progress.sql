-- 10-week DSA Roadmap feature (merged into the Practice page).
-- Tracks which roadmap milestones (checklist items inside each week) a
-- user has checked off. The curriculum itself (weeks/milestones/problem
-- counts) lives client-side in src/lib/roadmap-data.js — this table only
-- stores per-user completion state, same pattern as `bookmarks`.

CREATE TABLE IF NOT EXISTS public.roadmap_progress (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  week_number   INTEGER NOT NULL,
  milestone_id  TEXT NOT NULL,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, milestone_id)
);

ALTER TABLE public.roadmap_progress ENABLE ROW LEVEL SECURITY;

-- Private to the owner, same as bookmarks — no reason to expose another
-- user's exact checklist state.
CREATE POLICY "Users can view own roadmap progress" ON public.roadmap_progress
  FOR SELECT USING ((auth.jwt() ->> 'sub') = user_id);

CREATE POLICY "Users can insert own roadmap progress" ON public.roadmap_progress
  FOR INSERT WITH CHECK ((auth.jwt() ->> 'sub') = user_id);

CREATE POLICY "Users can delete own roadmap progress" ON public.roadmap_progress
  FOR DELETE USING ((auth.jwt() ->> 'sub') = user_id);

CREATE INDEX IF NOT EXISTS roadmap_progress_user_id_idx ON public.roadmap_progress (user_id);
