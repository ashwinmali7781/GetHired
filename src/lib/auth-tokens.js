/**
 * auth-tokens.js
 * ──────────────
 * Centralised access-token / refresh-token management for the GetHired
 * platform.  The app uses Clerk for identity; Clerk owns the actual
 * refresh-token lifecycle internally.  This module:
 *
 *  1. Wraps Clerk's `session.getToken()` so the rest of the code has a
 *     single place to ask for a JWT.
 *  2. Maintains a short-lived in-memory cache to avoid hammering Clerk on
 *     every Supabase request.
 *  3. Provides a `TokenStore` class that persists the last-known token
 *     metadata (expiry, issue time, scopes) to sessionStorage so the UI
 *     can show token state without making a network round-trip.
 *  4. Exports helpers used by AuthContext and useSupabase.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Refresh the cached token this many ms before it expires. */
const REFRESH_BUFFER_MS = 30_000; // 30 seconds

/** How long we consider a cached token valid without re-checking Clerk. */
const CACHE_TTL_MS = 55_000; // 55 seconds (Clerk tokens live ~60 s)

/** sessionStorage key for persisted token metadata. */
const STORAGE_KEY = "gh_token_meta";

// ─── In-memory cache ──────────────────────────────────────────────────────────

let _cachedToken = null;   // string | null
let _cacheExpiry = 0;       // epoch ms when this cache entry expires
let _refreshTimer = null;   // ReturnType<typeof setTimeout>

// ─── Token metadata (non-secret, safe to persist) ────────────────────────────

/**
 * Parse the payload of a JWT without verifying the signature.
 * Verification happens server-side (Supabase/Clerk edge functions).
 *
 * @param {string} token
 * @returns {{ sub?: string, exp?: number, iat?: number, [key: string]: unknown } | null}
 */
export function parseJwtPayload(token) {
  try {
    const [, payloadB64] = token.split(".");
    const json = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Returns whether the given token is expired (or will expire within
 * `bufferMs` milliseconds).
 *
 * @param {string} token
 * @param {number} [bufferMs=0]
 */
export function isTokenExpired(token, bufferMs = 0) {
  const payload = parseJwtPayload(token);
  if (!payload?.exp) return true;
  return payload.exp * 1000 - bufferMs < Date.now();
}

// ─── TokenStore ───────────────────────────────────────────────────────────────

/**
 * Persists non-secret token metadata to sessionStorage.
 * Cleared automatically on tab close.  Used by the UI to surface
 * "session active / expires in N minutes" information without
 * re-fetching the live token.
 */
export class TokenStore {
  /** @param {string} token */
  static save(token) {
    const payload = parseJwtPayload(token);
    if (!payload) return;
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          sub:       payload.sub   ?? null,
          iat:       payload.iat   ?? null,
          exp:       payload.exp   ?? null,
          savedAt:   Date.now(),
        })
      );
    } catch {
      // sessionStorage may be blocked in private-browsing contexts — ignore
    }
  }

  /** @returns {{ sub: string|null, iat: number|null, exp: number|null, savedAt: number } | null} */
  static load() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  static clear() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  }

  /**
   * Returns milliseconds until the stored token expires,
   * or 0 if it is already expired / not stored.
   */
  static msUntilExpiry() {
    const meta = TokenStore.load();
    if (!meta?.exp) return 0;
    return Math.max(0, meta.exp * 1000 - Date.now());
  }

  /**
   * Human-readable "expires in …" string for UI display.
   * @returns {string}
   */
  static expiresInLabel() {
    const ms = TokenStore.msUntilExpiry();
    if (ms <= 0) return "expired";
    const minutes = Math.ceil(ms / 60_000);
    return minutes === 1 ? "< 1 min" : `${minutes} min`;
  }
}

// ─── Token retrieval ──────────────────────────────────────────────────────────

/**
 * Returns a valid access token, using the in-memory cache when possible.
 *
 * @param {import("@clerk/clerk-react").ActiveSessionResource | null | undefined} session
 *   The Clerk session object from `useSession().session`.
 * @param {{ forceRefresh?: boolean }} [opts]
 * @returns {Promise<string | null>}
 */
export async function getAccessToken(session, { forceRefresh = false } = {}) {
  if (!session) return null;

  // Serve from cache if still valid and no forced refresh
  if (
    !forceRefresh &&
    _cachedToken &&
    Date.now() < _cacheExpiry &&
    !isTokenExpired(_cachedToken, REFRESH_BUFFER_MS)
  ) {
    return _cachedToken;
  }

  try {
    const token = await session.getToken();
    if (!token) return null;

    // Update in-memory cache
    _cachedToken  = token;
    _cacheExpiry  = Date.now() + CACHE_TTL_MS;

    // Persist metadata (not the token itself)
    TokenStore.save(token);

    return token;
  } catch (err) {
    console.error("[auth-tokens] Failed to get token:", err);
    return null;
  }
}

// ─── Proactive refresh scheduler ─────────────────────────────────────────────

/**
 * Schedules a background token refresh so there is always a fresh token
 * ready before it expires.  Safe to call multiple times — clears any
 * previous timer first.
 *
 * @param {import("@clerk/clerk-react").ActiveSessionResource | null | undefined} session
 * @param {() => void} [onRefreshed]   optional callback after a successful refresh
 */
export function scheduleTokenRefresh(session, onRefreshed) {
  if (_refreshTimer) clearTimeout(_refreshTimer);
  if (!session) return;

  const meta = TokenStore.load();
  if (!meta?.exp) return;

  const msUntilRefresh = meta.exp * 1000 - Date.now() - REFRESH_BUFFER_MS;
  if (msUntilRefresh <= 0) {
    // Already in the buffer window — refresh immediately
    getAccessToken(session, { forceRefresh: true }).then(onRefreshed);
    return;
  }

  _refreshTimer = setTimeout(async () => {
    await getAccessToken(session, { forceRefresh: true });
    onRefreshed?.();
    // Re-schedule for the next cycle
    scheduleTokenRefresh(session, onRefreshed);
  }, msUntilRefresh);
}

/** Tear down any pending refresh timer and wipe the cache. */
export function clearTokenState() {
  if (_refreshTimer) clearTimeout(_refreshTimer);
  _refreshTimer = null;
  _cachedToken  = null;
  _cacheExpiry  = 0;
  TokenStore.clear();
}

// ─── Convenience: build a Supabase accessToken getter ────────────────────────

/**
 * Returns a function suitable for passing to `createClerkSupabaseClient`
 * that uses the cache-aware `getAccessToken` helper.
 *
 * @param {import("@clerk/clerk-react").ActiveSessionResource | null | undefined} session
 * @returns {() => Promise<string | null>}
 */
export function makeSupabaseTokenFetcher(session) {
  return () => getAccessToken(session);
}
