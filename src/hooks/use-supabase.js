import { useMemo } from "react";
import { useSession } from "@clerk/clerk-react";
import { createClerkSupabaseClient } from "@/integrations/supabase/client";
import { makeSupabaseTokenFetcher } from "@/lib/auth-tokens";

/**
 * Returns a Supabase client whose requests carry the current Clerk JWT,
 * so Supabase RLS policies that check `auth.jwt() ->> 'sub'` resolve to
 * the signed-in user's Clerk user id.
 *
 * The token fetcher is cache-aware (via auth-tokens.js) — it won't hit
 * Clerk's network on every single Supabase call; it uses the in-memory
 * cache and only asks Clerk for a new token when the cached one is about
 * to expire.
 *
 * The Supabase client is re-created only when the Clerk session changes
 * (sign-in, sign-out, or token rotation).
 */
export function useSupabase() {
  const { session } = useSession();

  return useMemo(
    () => createClerkSupabaseClient(makeSupabaseTokenFetcher(session)),
    [session]
  );
}
