import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { useSignUp } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2, MailCheck, ArrowLeft } from "lucide-react";

const errMsg = (err) =>
  err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || "Something went wrong.";

const SignupPage = () => {
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPw,      setShowPw]      = useState(false);
  const [code,        setCode]        = useState("");
  const [step,        setStep]        = useState("form"); // "form" | "verify"
  const [loading,     setLoading]     = useState(false);

  const { signUp, setActive, isLoaded } = useSignUp();
  const navigate  = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  if (!authLoading && user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    try {
      const [firstName, ...rest] = displayName.trim().split(/\s+/);
      await signUp.create({
        emailAddress: email,
        password,
        firstName:    firstName || undefined,
        lastName:     rest.join(" ") || undefined,
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStep("verify");
      toast({ title: "Check your email", description: "We sent a 6-digit code to " + email });
    } catch (err) {
      toast({ title: "Signup failed", description: errMsg(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        toast({ title: "Account created!", description: "Welcome to GetHired 🎉" });
        navigate("/dashboard");
      } else {
        toast({
          title: "Verification incomplete",
          description: "Please double-check the code and try again.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({ title: "Verification failed", description: errMsg(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (!isLoaded) return;
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      toast({ title: "Code resent", description: "Check your inbox." });
    } catch (err) {
      toast({ title: "Couldn't resend", description: errMsg(err), variant: "destructive" });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
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
          {/* ── STEP 1: Sign-up form ── */}
          {step === "form" && (
            <>
              <CardHeader className="pb-4 text-center">
                <CardTitle className="text-xl font-bold">Create your account</CardTitle>
                <CardDescription className="text-sm">Start your journey to getting hired</CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
                    <Input
                      id="name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required
                      autoComplete="name"
                      placeholder="John Doe"
                      className="h-10"
                      disabled={loading}
                    />
                  </div>

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
                    <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPw ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                        placeholder="Min. 8 characters"
                        minLength={8}
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
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account…</>
                    ) : (
                      "Get Started"
                    )}
                  </Button>
                </form>

                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs uppercase text-muted-foreground">Or continue with</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <SocialAuthButtons authClient={signUp} isLoaded={isLoaded} disabled={loading} />

                <p className="mt-5 text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link to="/login" className="font-semibold text-primary hover:underline">
                    Sign in
                  </Link>
                </p>
              </CardContent>
            </>
          )}

          {/* ── STEP 2: Email verification ── */}
          {step === "verify" && (
            <>
              <CardHeader className="pb-4 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <MailCheck className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl font-bold">Check your email</CardTitle>
                <CardDescription className="text-sm">
                  We sent a 6-digit code to{" "}
                  <span className="font-medium text-foreground">{email}</span>
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleVerify} className="space-y-4" noValidate>
                  <div className="space-y-1.5">
                    <Label htmlFor="code" className="text-sm font-medium">Verification Code</Label>
                    <Input
                      id="code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      required
                      placeholder="123456"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                      className="h-10 text-center text-lg tracking-[0.5em] font-mono"
                      disabled={loading}
                      maxLength={6}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="h-10 w-full gradient-primary text-primary-foreground font-semibold shadow-sm"
                    disabled={loading || !isLoaded || code.length !== 6}
                    aria-busy={loading}
                  >
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…</>
                    ) : (
                      "Verify & Continue"
                    )}
                  </Button>
                </form>

                <div className="mt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => { setStep("form"); setCode(""); }}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>
                  <button
                    type="button"
                    onClick={resendCode}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    Resend code
                  </button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default SignupPage;
