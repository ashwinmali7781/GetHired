import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { useSignIn } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const LoginPage = () => {
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [showPw,      setShowPw]      = useState(false);
  const [loading,     setLoading]     = useState(false);
  const { signIn, setActive, isLoaded } = useSignIn();
  const navigate  = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  // Already signed in — skip the page
  if (!authLoading && user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        navigate("/dashboard");
      } else {
        // e.g. MFA required
        toast({
          title: "Additional step required",
          description: "Please complete the sign-in flow to continue.",
        });
      }
    } catch (err) {
      toast({
        title: "Login failed",
        description:
          err?.errors?.[0]?.longMessage ||
          err?.errors?.[0]?.message ||
          "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {/* Ambient background blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-60 -top-60 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[100px]" />
        <div className="absolute -bottom-60 -right-60 h-[500px] w-[500px] rounded-full bg-accent/5 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Brand mark */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary shadow-elevated">
            <img src="/logo.svg" alt="" className="h-7 w-7" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            Get<span className="text-primary">Hired</span>
          </span>
        </div>

        <Card className="shadow-card">
          <CardHeader className="pb-4 text-center">
            <CardTitle className="text-xl font-bold">Welcome back</CardTitle>
            <CardDescription className="text-sm">Sign in to your GetHired account</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="h-10"
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="h-10 pr-10"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPw ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="h-10 w-full gradient-primary text-primary-foreground font-semibold shadow-sm"
                disabled={loading || !isLoaded}
                aria-busy={loading}
              >
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…</>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs uppercase text-muted-foreground">Or continue with</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <SocialAuthButtons authClient={signIn} isLoaded={isLoaded} disabled={loading} />

            <p className="mt-5 text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/signup" className="font-semibold text-primary hover:underline">
                Create one
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
