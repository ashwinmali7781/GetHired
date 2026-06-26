import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { TokenStore } from "@/lib/auth-tokens";

/**
 * useTokenStatus()
 * ────────────────
 * Provides live token status for UI components (e.g. a session indicator
 * in the navbar or a debug panel in development).
 *
 * Returns:
 *   isAuthenticated  — boolean
 *   accessToken      — current JWT string or null
 *   expiresIn        — human-readable label ("12 min", "< 1 min", "expired")
 *   expiresAt        — Date | null
 *   refreshToken     — async function to force-refresh the token
 *   sub              — Clerk user id extracted from the JWT payload
 */
export function useTokenStatus() {
  const { user, accessToken, tokenExpiry, tokenMeta, refreshToken } = useAuth();
  const [expiresIn, setExpiresIn] = useState(TokenStore.expiresInLabel());

  // Update the "expires in" label every 30 seconds
  useEffect(() => {
    if (!tokenExpiry) {
      setExpiresIn(null);
      return;
    }
    const tick = () => setExpiresIn(TokenStore.expiresInLabel());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [tokenExpiry]);

  return {
    isAuthenticated: Boolean(user && accessToken),
    accessToken,
    expiresIn,
    expiresAt:       tokenExpiry,
    refreshToken,
    sub:             tokenMeta?.sub ?? null,
  };
}
