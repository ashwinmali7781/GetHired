import { useCallback, useEffect, useRef, useState } from "react";
import { useUser, useClerk, useSession } from "@clerk/clerk-react";
import {
  getAccessToken,
  scheduleTokenRefresh,
  clearTokenState,
  TokenStore,
  parseJwtPayload,
} from "@/lib/auth-tokens";

/**
 * useAuth()
 * ─────────
 * Compatibility layer around Clerk that gives the rest of the app:
 *
 *   user            — normalised user object (id, email, displayName, imageUrl, createdAt)
 *                     or null when signed out / loading.
 *   loading         — true until Clerk has loaded.
 *   signOut()       — signs out and redirects to /.
 *
 *   accessToken     — current JWT string (null when signed out).
 *   refreshToken()  — async fn → forces a fresh JWT from Clerk and returns it.
 *   tokenExpiry     — Date | null — when the current access token expires.
 *   tokenMeta       — raw parsed JWT payload for advanced usage.
 *
 * No Provider is needed — Clerk's own <ClerkProvider> (in main.jsx)
 * supplies the underlying context.
 */
export const useAuth = () => {
  const { user: clerkUser, isLoaded, isSignedIn } = useUser();
  const { signOut: clerkSignOut } = useClerk();
  const { session } = useSession();

  const [accessToken, setAccessToken] = useState(null);
  const [tokenExpiry, setTokenExpiry] = useState(null);
  const [tokenMeta,   setTokenMeta]   = useState(null);
  const hasScheduled  = useRef(false);

  // ── Normalised user object ────────────────────────────────────────────────
  const user =
    isLoaded && isSignedIn && clerkUser
      ? {
          id:          clerkUser.id,
          email:       clerkUser.primaryEmailAddress?.emailAddress ?? "",
          displayName:
            clerkUser.fullName ||
            clerkUser.username ||
            clerkUser.primaryEmailAddress?.emailAddress ||
            "",
          imageUrl:    clerkUser.imageUrl,
          createdAt:   clerkUser.createdAt,
        }
      : null;

  // ── Fetch + cache access token ────────────────────────────────────────────
  const fetchAndStoreToken = useCallback(
    async ({ forceRefresh = false } = {}) => {
      const token = await getAccessToken(session, { forceRefresh });
      if (token) {
        setAccessToken(token);
        const payload = parseJwtPayload(token);
        setTokenMeta(payload);
        setTokenExpiry(payload?.exp ? new Date(payload.exp * 1000) : null);
      } else {
        setAccessToken(null);
        setTokenMeta(null);
        setTokenExpiry(null);
      }
      return token;
    },
    [session]
  );

  // ── On mount / session change: fetch initial token & schedule refresh ─────
  useEffect(() => {
    if (!isLoaded) return;

    if (!session) {
      // User signed out — clean up
      clearTokenState();
      setAccessToken(null);
      setTokenMeta(null);
      setTokenExpiry(null);
      hasScheduled.current = false;
      return;
    }

    // Initial fetch
    fetchAndStoreToken();

    // Schedule proactive background refresh (runs before expiry)
    if (!hasScheduled.current) {
      hasScheduled.current = true;
      scheduleTokenRefresh(session, () => fetchAndStoreToken({ forceRefresh: true }));
    }

    return () => {
      // Component unmount — the timer is cleaned up inside clearTokenState
      // when the user actually signs out; here we just clear the flag so a
      // new schedule is created if the component remounts with a new session.
      hasScheduled.current = false;
    };
  }, [isLoaded, session, fetchAndStoreToken]);

  // ── Public refreshToken() ─────────────────────────────────────────────────
  const refreshToken = useCallback(
    () => fetchAndStoreToken({ forceRefresh: true }),
    [fetchAndStoreToken]
  );

  // ── Sign-out ──────────────────────────────────────────────────────────────
  const signOut = useCallback(() => {
    clearTokenState();
    return clerkSignOut({ redirectUrl: "/" });
  }, [clerkSignOut]);

  // ── Token expiry label for UI (e.g. "expires in 12 min") ─────────────────
  const tokenExpiryLabel = tokenExpiry
    ? TokenStore.expiresInLabel()
    : null;

  return {
    user,
    loading: !isLoaded,
    signOut,

    // Token API
    accessToken,
    refreshToken,
    tokenExpiry,
    tokenExpiryLabel,
    tokenMeta,
  };
};
