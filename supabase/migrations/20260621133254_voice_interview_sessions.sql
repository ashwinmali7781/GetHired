-- AI Voice Interview feature: stores each completed voice-interview session
-- (TTS-asked questions, speech-to-text answers, and Gemini's score breakdown).

CREATE TABLE IF NOT EXISTS public.voice_interview_sessions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              TEXT NOT NULL,
  category             TEXT NOT NULL,
  technical_score      INTEGER NOT NULL DEFAULT 0,
  communication_score  INTEGER NOT NULL DEFAULT 0,
  confidence_score     INTEGER NOT NULL DEFAULT 0,
  grammar_score        INTEGER NOT NULL DEFAULT 0,
  overall_score        INTEGER NOT NULL DEFAULT 0,
  feedback             TEXT,
  transcript           JSONB,                      -- [{ question, answer }, ...]
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_interview_sessions ENABLE ROW LEVEL SECURITY;

-- Private to the owner only — unlike practice_history/interview_sessions,
-- this table holds the candidate's actual spoken transcript, so it's not
-- exposed on the leaderboard.
CREATE POLICY "Users can view own voice sessions" ON public.voice_interview_sessions
  FOR SELECT USING ((auth.jwt() ->> 'sub') = user_id);

CREATE POLICY "Users can insert own voice sessions" ON public.voice_interview_sessions
  FOR INSERT WITH CHECK ((auth.jwt() ->> 'sub') = user_id);

CREATE INDEX IF NOT EXISTS voice_interview_sessions_user_id_created_at_idx
  ON public.voice_interview_sessions (user_id, created_at DESC);
