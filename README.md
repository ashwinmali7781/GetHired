# GetHired — AI-Powered Interview Prep Platform

A full-stack interview preparation platform built with React, Supabase, Clerk, and Gemini AI.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Auth | Clerk |
| Database | Supabase (Postgres + RLS) |
| AI | Google Gemini 2.5 Flash |
| Code Execution | Judge0 (optional) |
| Deployment | Vercel / Netlify |

---

## Local Development

### 1. Clone and install
```bash
git clone <your-repo>
cd GH7
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env.local
```
Fill in all values in `.env.local` (see `.env.example` for descriptions).

### 3. Run Supabase migrations

Open your [Supabase Dashboard](https://app.supabase.com) → SQL Editor, then run **each migration file in order**:

```
supabase/migrations/20260313160823_f01646da-46b0-4ed4-8a4c-195c6a1c25a5.sql
supabase/migrations/20260621133254_voice_interview_sessions.sql
supabase/migrations/20260622090000_roadmap_progress.sql
supabase/migrations/20260625000000_fix_clerk_rls_policies.sql   ← CRITICAL: fixes Clerk RLS
supabase/migrations/20260626000000_new_features.sql              ← notes + resume history
supabase/migrations/20260626000001_profiles_columns.sql          ← bio, location, avatar_url
```

### 4. Configure Clerk JWT template for Supabase

In **Clerk Dashboard → JWT Templates**, create a template named `supabase` with:
```json
{
  "sub": "{{user.id}}",
  "role": "authenticated",
  "aud": "authenticated"
}
```

Then in **Supabase Dashboard → Authentication → JWT Settings**, paste your Clerk JWT public key.

### 5. Start dev server
```bash
npm run dev
```

---

## Deployment

### Vercel (recommended)
1. Push to GitHub
2. Import project in Vercel
3. Add all env vars from `.env.example` in Vercel → Settings → Environment Variables
4. Deploy — `vercel.json` handles SPA routing automatically

### Netlify
1. Build command: `npm run build`
2. Publish directory: `dist`
3. `public/_redirects` handles SPA routing automatically

---

## Features

| Feature | Description |
|---------|-------------|
| **Practice** | 220+ coding problems with Monaco editor, test case runner (Judge0), hints, bookmarks |
| **Roadmap** | Week-by-week study plan with weak topic analysis |
| **Daily Challenge** | A new problem every day — same for all users |
| **Notes** | Per-problem scratch pad synced to Supabase |
| **Mock Interview** | Text-based interview with per-answer AI scoring (Gemini) |
| **Voice AI** | Speak your answers — transcribed and scored with Gemini |
| **Resume Analyzer** | ATS score, keyword gaps, section analysis, AI tips, history |
| **Leaderboard** | Global rankings by problems solved and interview score |
| **Profile** | Badges, submission heatmap, stats, bio/location |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `VITE_CLERK_PUBLISHABLE_KEY` | ✅ | Clerk publishable key |
| `VITE_GEMINI_API_KEY` | Optional | Enables AI scoring & resume AI tips |
| `VITE_JUDGE0_API_KEY` | Optional | Enables code execution in the editor |
| `VITE_JUDGE0_HOST` | Optional | Judge0 RapidAPI host |

---

## Common Issues

**Resume shows 0/100** — PDF text extraction failed. Make sure your PDF was exported from Word/Google Docs, not scanned. The app tries a CDN fallback for pdf.js automatically.

**Cross-account data showing** — Run the `20260625000000_fix_clerk_rls_policies.sql` migration. This is the most critical fix.

**Profile not saving** — Run `20260625000000_fix_clerk_rls_policies.sql` and `20260626000001_profiles_columns.sql`. The original migration used `auth.uid()` which returns null with Clerk.

**Blank page after login in production** — Check `vercel.json` or `public/_redirects` is deployed. SPA routing requires all paths to serve `index.html`.
