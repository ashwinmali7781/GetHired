/**
 * TokenDebugBadge (development only)
 * ────────────────────────────────────
 * Renders a small floating badge showing the current token status.
 * Only rendered when import.meta.env.DEV is true — tree-shaken out of
 * production builds entirely.
 *
 * Usage in AppLayout (or anywhere at the root level):
 *   import { TokenDebugBadge } from "@/components/dev/TokenDebugBadge";
 *   ...
 *   {import.meta.env.DEV && <TokenDebugBadge />}
 */

import { useState } from "react";
import { useTokenStatus } from "@/hooks/use-token-status";
import { KeyRound, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

export const TokenDebugBadge = () => {
  const { isAuthenticated, accessToken, expiresIn, expiresAt, refreshToken, sub } = useTokenStatus();
  const [expanded, setExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  if (!isAuthenticated) return null;

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshToken();
    setRefreshing(false);
  };

  const shortToken = accessToken
    ? `${accessToken.slice(0, 12)}…${accessToken.slice(-8)}`
    : "—";

  return (
    <div className="fixed bottom-4 right-4 z-50 font-mono text-xs">
      <div className="rounded-xl border border-border bg-card/95 shadow-lg backdrop-blur-sm">
        {/* Header row */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 px-3 py-2 w-full text-left"
        >
          <KeyRound className="h-3 w-3 text-green-500 shrink-0" />
          <span className="text-muted-foreground">Token</span>
          <span className="ml-1 text-foreground font-semibold">
            {expiresIn ?? "—"}
          </span>
          {expanded ? (
            <ChevronUp className="ml-auto h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronDown className="ml-auto h-3 w-3 text-muted-foreground" />
          )}
        </button>

        {/* Expanded panel */}
        {expanded && (
          <div className="border-t border-border px-3 pb-3 pt-2 space-y-1.5 min-w-[260px]">
            <Row label="sub" value={sub ?? "—"} />
            <Row label="token" value={shortToken} mono />
            <Row
              label="expires"
              value={expiresAt ? expiresAt.toLocaleTimeString() : "—"}
            />
            <Row label="in" value={expiresIn ?? "—"} />

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs text-foreground hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing…" : "Force refresh"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const Row = ({ label, value, mono = false }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-muted-foreground shrink-0">{label}</span>
    <span className={`truncate text-right text-foreground ${mono ? "font-mono" : ""}`}>
      {value}
    </span>
  </div>
);
