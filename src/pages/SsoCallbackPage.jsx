import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useClerk } from "@clerk/clerk-react";
import { Sparkles } from "lucide-react";

const SsoCallbackPage = () => {
  const { handleRedirectCallback } = useClerk();
  const navigate = useNavigate();

  useEffect(() => {
    handleRedirectCallback({})
      .then(() => navigate("/dashboard", { replace: true }))
      .catch((err) => {
        console.error("[SSO] Redirect callback failed:", err);
        navigate("/login", { replace: true });
      });
  }, [handleRedirectCallback, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-elevated animate-pulse">
        <Sparkles className="h-7 w-7 text-white" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-foreground">Completing sign-in…</p>
        <p className="text-xs text-muted-foreground">You'll be redirected in a moment</p>
      </div>
    </div>
  );
};

export default SsoCallbackPage;
