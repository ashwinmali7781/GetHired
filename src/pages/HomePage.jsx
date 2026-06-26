import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Code, MessageSquare, BarChart3, ArrowRight, GitBranch, ScanText, Mic, CheckCircle2, Users, Zap, Star } from "lucide-react";
import { motion } from "framer-motion";

const STATS = [
  { value: "500+",  label: "Problems" },
  { value: "4 AI",  label: "Features" },
  { value: "Live",  label: "Leaderboard" },
  { value: "Free",  label: "To Start" },
];

const TESTIMONIALS = [
  { name: "Arjun S.", role: "SWE @ Google", text: "The daily streak kept me consistent. Landed my FAANG offer after 6 weeks.", stars: 5 },
  { name: "Priya M.", role: "SWE @ Meta",   text: "Voice interviews are so realistic — totally prepared me for the real thing.", stars: 5 },
  { name: "Rohan K.", role: "SDE-2 @ Amazon", text: "Resume analyzer caught keywords I was missing. ATS score went from 54% to 91%.", stars: 5 },
];

const HomePage = () => {
  const { user, loading } = useAuth();


  const features = [
    { icon: Code,         title: "Coding Practice",   description: "Solve curated interview problems with an integrated VS Code-style editor. Auto-graded with real test cases." },
    { icon: Mic,          title: "Voice Interviews",   description: "Speak your answers aloud. AI listens, evaluates, and gives real-time coaching feedback on your delivery." },
    { icon: MessageSquare,title: "Text Mock Interview",description: "Get asked technical questions and receive instant AI-powered written feedback with detailed scoring." },
    { icon: ScanText,     title: "Resume Analyzer",    description: "Upload your resume PDF. Get an ATS score, missing keywords, and actionable improvement tips instantly." },
    { icon: BarChart3,    title: "Progress Tracking",  description: "Monitor your growth with streaks, a GitHub-style heatmap, category charts, and a live leaderboard." },
    { icon: Zap,          title: "10-Week Roadmap",    description: "Structured learning path from Arrays to Dynamic Programming. Never wonder what to study next." },
  ];

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #0f0f23 0%, #1a1040 50%, #0d1929 100%)" }}>

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
        <div className="pointer-events-none absolute -left-40 top-0 h-[500px] w-[500px] rounded-full bg-indigo-500/20 blur-[120px]" />
        <div className="pointer-events-none absolute -right-40 bottom-0 h-[400px] w-[400px] rounded-full bg-violet-500/20 blur-[120px]" />

        <div className="container relative flex min-h-[78vh] flex-col items-center justify-center px-4 py-20 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary shadow-elevated">
              <img src="/vite.svg" alt="GetHired logo" className="h-10 w-10" />
            </div>
            <div className="mb-2 flex items-center justify-center gap-2">
              <GitBranch className="h-5 w-5 text-indigo-400" />
              <span className="text-sm font-semibold uppercase tracking-widest text-indigo-400">GetHired</span>
            </div>
            <h1 className="mb-4 text-5xl font-bold tracking-tight text-white sm:text-7xl">
              Get <span style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Hired</span> Faster
            </h1>
            <p className="mx-auto mb-8 max-w-xl text-lg text-white/60">
              Master coding interviews with AI-powered practice, voice coaching, resume analysis, and live leaderboards — all in one place.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              {user ? (
                <Link to="/dashboard">
                  <Button size="lg" className="gap-2 gradient-primary text-white shadow-elevated">
                    Go to Dashboard <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/signup">
                    <Button size="lg" className="gap-2 gradient-primary text-white shadow-elevated">
                      Get Started Free <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link to="/login">
                    <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10">
                      Sign In
                    </Button>
                  </Link>
                </>
              )}
            </div>

            {/* Stats bar */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
              className="mt-12 flex flex-wrap items-center justify-center gap-8">
              {STATS.map((s) => (
                <div key={s.label} className="text-center">
                  <p className="text-2xl font-bold text-white">{s.value}</p>
                  <p className="text-xs text-white/40 uppercase tracking-wide">{s.label}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Features grid */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
        <div className="container py-24">
          <div className="mb-12 text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-indigo-400">Everything you need</p>
            <h2 className="text-3xl font-bold text-white">Built for serious candidates</h2>
            <p className="mt-3 text-white/40 max-w-md mx-auto text-sm">6 powerful tools. One platform. Zero excuses.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <motion.div key={feature.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: i * 0.1 }}
                className="group rounded-xl border border-white/10 p-7 transition-all hover:border-indigo-500/40 hover:-translate-y-1"
                style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl gradient-primary">
                  <feature.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-white">{feature.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Testimonials */}
      <div className="relative py-20">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />
        <div className="container">
          <div className="mb-10 text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-violet-400">From our users</p>
            <h2 className="text-2xl font-bold text-white">They landed the job. You can too.</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <motion.div key={t.name} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }}
                className="rounded-xl border border-white/10 p-6" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="flex mb-3">
                  {Array.from({ length: t.stars }).map((_, si) => (
                    <Star key={si} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm text-white/70 leading-relaxed mb-4">"{t.text}"</p>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full gradient-primary text-xs font-bold text-white">
                    {t.name.slice(0, 1)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white leading-none">{t.name}</p>
                    <p className="text-xs text-white/40 mt-0.5">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA banner */}
      <div className="container pb-24">
        <div className="relative overflow-hidden rounded-2xl border border-indigo-500/30 p-10 text-center"
          style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.10))" }}>
          <div className="pointer-events-none absolute inset-0 opacity-5"
            style={{ backgroundImage: "radial-gradient(circle, #6366f1 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
          <h2 className="relative text-2xl font-bold text-white mb-2">{user ? "Welcome back! 👋" : "Ready to get hired?"}</h2>
          <p className="relative text-white/50 mb-6 text-sm">{user ? "Pick up where you left off." : "Start for free. No credit card required."}</p>
          <Link to={user ? "/dashboard" : "/signup"}>
            <Button size="lg" className="gap-2 gradient-primary text-white shadow-elevated">
              {user ? "Go to Dashboard" : "Create Free Account"} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 py-8 text-center text-sm text-white/30">
        © {new Date().getFullYear()} GetHired. Built to help you land your dream job. 🚀
      </div>
    </div>
  );
};

export default HomePage;
