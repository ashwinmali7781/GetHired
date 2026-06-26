import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSupabase } from "@/hooks/use-supabase";

/**
 * useSyncProfile()
 * ────────────────
 * Keeps public.profiles.display_name in sync with the signed-in Clerk
 * user.  Supabase no longer auto-creates a profile row on signup (that
 * relied on Supabase Auth's own auth.users table, which Clerk bypasses),
 * so this fills that gap from the client once per session.
 *
 * The upsert is guarded by a ref so it only fires once per user id,
 * even if the component tree re-renders (e.g. on token refresh).
 */
export function useSyncProfile() {
  const { user } = useAuth();
  const supabase = useSupabase();
  const syncedFor = useRef(null);

  useEffect(() => {
    if (!user || syncedFor.current === user.id) return;
    syncedFor.current = user.id;

    supabase
      .from("profiles")
      .upsert(
        {
          user_id:      user.id,
          display_name: user.displayName,
          email:        user.email,
          avatar_url:   user.imageUrl ?? null,
          updated_at:   new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .then(({ error }) => {
        if (error) {
          console.error("[profiles] sync failed:", error.message);
          // Reset so it can retry on the next render cycle
          syncedFor.current = null;
        }
      });
  }, [user, supabase]);
}
