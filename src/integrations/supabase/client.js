import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!isSupabaseConfigured) {
  console.error(
    "[Supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. " +
    "Copy .env.example to .env and fill in your Supabase project values."
  );
}

/**
 * Creates a Supabase client that authenticates every request with the
 * Clerk session JWT (Third-Party Auth integration).
 *
 * The `getToken` callback is called before each authenticated Supabase
 * request.  It should return the current access token string, or null
 * when the user is signed out.
 *
 * Supabase Dashboard setup required:
 *   Authentication → Sign In Providers → add Clerk
 *   (using your Clerk Frontend API URL)
 *
 * Once configured, `auth.jwt() ->> 'sub'` in RLS policies resolves to
 * the Clerk user id.
 *
 * @param {() => Promise<string | null>} getToken
 * @returns {import("@supabase/supabase-js").SupabaseClient}
 */
export function createClerkSupabaseClient(getToken) {
  return createClient(SUPABASE_URL ?? "", SUPABASE_ANON_KEY ?? "", {
    auth: {
      // Disable Supabase's built-in auth — Clerk handles all session
      // management including storage, refresh, and SSO.
      persistSession:    false,
      autoRefreshToken:  false,
      detectSessionInUrl: false,
    },
    async accessToken() {
      try {
        return (await getToken?.()) ?? null;
      } catch (err) {
        console.error("[Supabase] accessToken fetch failed:", err);
        return null;
      }
    },
    global: {
      headers: {
        // Identify the client in Supabase logs
        "x-client-info": "gethired-web",
      },
    },
  });
}
