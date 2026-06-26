import { useEffect, useState } from "react";
import { calcCompanyReadiness, getLevel } from "@/lib/xp";
import { useAuth } from "@/contexts/AuthContext";
import { useSupabase } from "@/hooks/use-supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import {
  CheckCircle, Target, Clock, TrendingUp, Flame, Zap, ArrowRight,
  Code2, Mic, ScanText, Trophy, Sparkles, Activity, CalendarDays, Star, Building2,
} from "lucide-react";

import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, CartesianGrid, AreaChart, Area,
} from "recharts";

// Deterministic daily challenge — same problem for everyone on the same day
function getDailyIndex(totalProblems) {
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  return seed % totalProblems;
}

function calcStreak(history) {
  if (!history.length) return 0;
  const days = [...new Set(history.map((h) => new Date(h.created_at).toDateString()))];
  days.sort((a, b) => new Date(b) - new Date(a));
  let streak = 0, cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (const day of days) {
    const d = new Date(day);
    d.setHours(0, 0, 0, 0);
    if (Math.round((cursor - d) / 86400000) <= 1) { streak++; cursor = d; }
    else break;
  }
  return streak;
}

function buildWeeklyActivity(history) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push({ label: d.toLocaleDateString("en-US", { weekday: "short" }), date: d.toDateString(), count: 0, correct: 0 });
  }
  history.forEach((h) => {
    const slot = days.find((d) => d.date === new Date(h.created_at).toDateString());
    if (slot) { slot.count++; if (h.is_correct) slot.correct++; }
  });
  return days;
}

const CAT_COLORS = { Arrays: "#6366f1", Trees: "#8b5cf6", Graphs: "#ec4899", "Dynamic Programming": "#f59e0b" };

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.4, ease: "easeOut" },
});

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name === "correct" ? "Correct" : "Attempted"}: {p.value}
        </p>
      ))}
    </div>
  );
};

const DashboardPage = () => {
  const { user } = useAuth();
  const supabase = useSupabase();
  const [history, setHistory]           = useState([]);
  const [sessions, setSessions]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [dailyChallenge, setDailyChallenge] = useState(null);
  const [dailySolved, setDailySolved]   = useState(false);
  const [xpData, setXpData]             = useState(null);
  const [companyReady, setCompanyReady] = useState([]);
  const [allQuestions, setAllQuestions] = useState([]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([
      supabase.from("practice_history").select("*, questions(category, difficulty)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
      supabase.from("interview_sessions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("questions").select("id, title, difficulty, category").limit(220),
      supabase.from("profiles").select("total_xp").eq("user_id", user.id).single(),
    ]).then(async ([h, s, q, xp]) => {
      const histData = (h.data || []).map((r) => ({ ...r, category: r.questions?.category, difficulty: r.questions?.difficulty }));
      setHistory(histData);
      setSessions(s.data || []);

      // Pick daily challenge
      const allQs = q.data || [];
      if (allQs.length > 0) {
        const dc = allQs[getDailyIndex(allQs.length)];
        setDailyChallenge(dc);
        // Check if already solved today
        const today = new Date().toDateString();
        const solvedToday = histData.some(
          (r) => r.question_id === dc.id && r.is_correct && new Date(r.created_at).toDateString() === today
        );
        setDailySolved(solvedToday);
      }
      // XP level
      const totalXp = xp?.data?.total_xp || 0;
      // inline level calc
      const LEVELS = [
        {level:1,xp:0,title:"Newcomer"},{level:2,xp:100,title:"Beginner"},
        {level:3,xp:250,title:"Learner"},{level:4,xp:500,title:"Practitioner"},
        {level:5,xp:900,title:"Developer"},{level:6,xp:1400,title:"Engineer"},
        {level:7,xp:2000,title:"Senior Dev"},{level:8,xp:3000,title:"Tech Lead"},
      ];
      let lvl = LEVELS[0];
      for (const l of LEVELS) { if (totalXp >= l.xp) lvl = l; else break; }
      const nextLvl = LEVELS[LEVELS.indexOf(lvl) + 1] || null;
      const lvlProgress = nextLvl ? Math.round(((totalXp - lvl.xp) / (nextLvl.xp - lvl.xp)) * 100) : 100;
      setXpData({ totalXp, level: lvl.level, title: lvl.title, progress: lvlProgress, nextXp: nextLvl?.xp });

      // Company readiness
      const allQs2 = allQs;
      const solvedIds = new Set(histData.filter(h => h.is_correct).map(h => h.question_id));
      const topicMap = {};
      allQs2.forEach(q => {
        if (!q.category) return;
        if (!topicMap[q.category]) topicMap[q.category] = { solved: 0, total: 0 };
        topicMap[q.category].total++;
        if (solvedIds.has(q.id)) topicMap[q.category].solved++;
      });
      setCompanyReady(calcCompanyReadiness(topicMap));
      setAllQuestions(allQs2);

      setLoading(false);
    });
  }, [user, supabase]);


  if (loading) return <DashboardSkeleton />;

  const totalSolved  = history.length;
  const correctCount = history.filter((h) => h.is_correct).length;
  const accuracy     = totalSolved > 0 ? Math.round((correctCount / totalSolved) * 100) : 0;
  const avgScore     = sessions.length > 0 ? Math.round(sessions.reduce((s, x) => s + (x.score || 0), 0) / sessions.length) : 0;
  const streak       = calcStreak(history);
  const weekly       = buildWeeklyActivity(history);

  const catData = Object.entries(
    history.reduce((acc, h) => {
      const cat = h.category || "Other";
      if (!acc[cat]) acc[cat] = { solved: 0, total: 0 };
      acc[cat].total++;
      if (h.is_correct) acc[cat].solved++;
      return acc;
    }, {})
  ).map(([name, v]) => ({ name: name.replace("Dynamic Programming", "DP"), solved: v.solved, total: v.total }));

  const stats = [
    { icon: CheckCircle, label: "Problems Solved", value: totalSolved,    color: "text-violet-500",  bg: "bg-violet-500/10", border: "border-violet-500/20" },
    { icon: Target,      label: "Accuracy",         value: `${accuracy}%`, color: "text-indigo-500", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
    { icon: Clock,       label: "Interviews",        value: sessions.length, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
    { icon: TrendingUp,  label: "Avg Score",         value: `${avgScore}%`, color: "text-emerald-500",bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  ];

  const quickActions = [
    { label: "Solve a Problem",  desc: "Jump into practice",    icon: Code2,   to: "/practice",        gradient: "from-indigo-500/15 to-indigo-400/5",  border: "border-indigo-500/20",  iconBg: "bg-indigo-500/10 text-indigo-500" },
    { label: "Mock Interview",   desc: "AI-powered Q&A",       icon: Mic,     to: "/voice-interview", gradient: "from-violet-500/15 to-violet-400/5",  border: "border-violet-500/20",  iconBg: "bg-violet-500/10 text-violet-500" },
    { label: "Analyze Resume",   desc: "Get your ATS score",   icon: ScanText, to: "/resume-analyzer", gradient: "from-pink-500/15 to-pink-400/5",      border: "border-pink-500/20",    iconBg: "bg-pink-500/10 text-pink-500" },
    { label: "Leaderboard",      desc: "See how you rank",     icon: Trophy,  to: "/leaderboard",     gradient: "from-amber-500/15 to-amber-400/5",    border: "border-amber-500/20",   iconBg: "bg-amber-500/10 text-amber-500" },
  ];

  const firstName = user?.displayName?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  return (
    <div className="space-y-6 pb-8">

      {/* ── Header ── */}
      <motion.div {...fadeUp(0)} className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground font-medium">Welcome back 👋</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-0.5">
            Hey, <span className="text-gradient">{firstName}</span>
          </h1>
        </div>

        {/* Streak widget */}
        <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all ${
          streak > 0
            ? "border-orange-400/30 bg-gradient-to-br from-orange-400/10 to-orange-500/5"
            : "border-border bg-muted/40"
        }`}>
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${streak > 0 ? "bg-orange-400/20" : "bg-muted"}`}>
            <Flame className={`h-5 w-5 ${streak > 0 ? "text-orange-400" : "text-muted-foreground"}`} />
          </div>
          <div>
            <p className={`text-2xl font-bold leading-none ${streak > 0 ? "text-orange-400" : "text-muted-foreground"}`}>{streak}</p>
            <p className="text-xs text-muted-foreground mt-0.5">day streak</p>
          </div>
        </div>
      </motion.div>

      {/* ── Daily Challenge ── */}
      {dailyChallenge && (
        <motion.div {...fadeUp(0.08)}>
          <Card className={`shadow-card border overflow-hidden ${dailySolved ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent"}`}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${dailySolved ? "bg-emerald-500/15" : "bg-amber-500/15"}`}>
                {dailySolved
                  ? <CheckCircle className="h-5 w-5 text-emerald-500"/>
                  : <CalendarDays className="h-5 w-5 text-amber-500"/>
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Daily Challenge</p>
                  <Badge className={`text-[10px] px-2 ${
                    dailyChallenge.difficulty === "Easy" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                    dailyChallenge.difficulty === "Medium" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                    "bg-red-500/10 text-red-500 border-red-500/20"
                  }`}>{dailyChallenge.difficulty}</Badge>
                  {dailySolved && <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] px-2">✓ Completed</Badge>}
                </div>
                <p className="text-sm font-semibold text-foreground mt-0.5 truncate">{dailyChallenge.title}</p>
                <p className="text-xs text-muted-foreground">{dailyChallenge.category} · Resets at midnight</p>
              </div>
              <Link to="/practice">
                <Button size="sm" variant={dailySolved ? "outline" : "default"}
                  className={`shrink-0 text-xs h-8 rounded-xl gap-1.5 ${dailySolved ? "" : "gradient-primary text-white border-0"}`}>
                  {dailySolved ? "Revisit" : <><Star className="h-3 w-3"/> Solve now</>}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Quick Actions ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((a, i) => (
          <motion.div key={a.label} {...fadeUp(i * 0.05 + 0.05)}>

            <Link to={a.to}>
              <div className={`group flex items-center gap-3 rounded-2xl border bg-gradient-to-br ${a.gradient} ${a.border} p-4 card-hover cursor-pointer`}>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${a.iconBg} transition-transform group-hover:scale-110`}>
                  <a.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{a.label}</p>
                  <p className="text-xs text-muted-foreground">{a.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* ── Stats ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} {...fadeUp(0.2 + i * 0.06)}>
            <Card className={`shadow-card border ${stat.border} card-hover`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</p>
                    <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                  </div>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg} ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* ── Activity Chart ── */}
      <motion.div {...fadeUp(0.42)}>
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Activity className="h-4 w-4 text-primary" /> 7-Day Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={weekly} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradAttempted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradCorrect" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="count"   name="count"   stroke="hsl(var(--primary)/0.3)" fill="url(#gradAttempted)" strokeWidth={2} />
                <Area type="monotone" dataKey="correct" name="correct" stroke="hsl(var(--primary))"     fill="url(#gradCorrect)"   strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-1 flex items-center gap-5 text-xs text-muted-foreground justify-end">
              <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary/25 border border-primary/20" />Attempted</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" />Correct</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Progress + Category ── */}
      <div className="grid gap-5 lg:grid-cols-2">
        <motion.div {...fadeUp(0.5)}>
          <Card className="shadow-card h-full">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Zap className="h-4 w-4 text-primary" /> Progress by Difficulty
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {[
                { label: "Easy",   color: "bg-emerald-500", textColor: "text-emerald-500", solved: history.filter(h => h.difficulty === "Easy"   && h.is_correct).length, total: 10 },
                { label: "Medium", color: "bg-amber-500",   textColor: "text-amber-500",   solved: history.filter(h => h.difficulty === "Medium" && h.is_correct).length, total: 10 },
                { label: "Hard",   color: "bg-red-500",     textColor: "text-red-500",     solved: history.filter(h => h.difficulty === "Hard"   && h.is_correct).length, total: 10 },
              ].map((d) => (
                <div key={d.label} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className={`font-semibold ${d.textColor}`}>{d.label}</span>
                    <span className="text-muted-foreground font-mono text-xs">{d.solved}/{d.total}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${d.color}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${(d.solved / d.total) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...fadeUp(0.55)}>
          {catData.length > 0 ? (
            <Card className="shadow-card h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Performance by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={catData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="solved" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      {catData.map((entry) => (
                        <Cell key={entry.name} fill={CAT_COLORS[entry.name] || "#6366f1"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-card h-full flex items-center justify-center">
              <CardContent className="py-12 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <Code2 className="h-7 w-7 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">No data yet</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">Solve problems to see category breakdown</p>
                <Link to="/practice">
                  <Button size="sm" className="gap-1.5 gradient-primary text-white">
                    Start Practicing <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>

      {/* ── Recent activity ── */}
      {/* XP Level Card */}
      {xpData && (
        <motion.div {...fadeUp(0.45)}>
          <Card className="shadow-card border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl gradient-primary shadow-elevated">
                  <span className="text-white text-xl font-black">{xpData.level}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-foreground">{xpData.title}</p>
                    <span className="text-xs font-semibold text-primary">{xpData.totalXp} XP</span>
                  </div>
                  <Progress value={xpData.progress} className="h-2"/>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {xpData.nextXp ? `${xpData.nextXp - xpData.totalXp} XP to next level` : "Max level reached!"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Company Readiness */}
      {companyReady.length > 0 && (
        <motion.div {...fadeUp(0.5)}>
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary"/> Company Readiness
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {companyReady.slice(0, 6).map(({ company, readiness }) => (
                <div key={company} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">{company}</span>
                    <span className={`text-xs font-bold ${
                      readiness >= 70 ? "text-emerald-500" : readiness >= 40 ? "text-amber-500" : "text-red-400"
                    }`}>{readiness}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{
                      width: `${readiness}%`,
                      background: readiness >= 70 ? "#10b981" : readiness >= 40 ? "#f59e0b" : "#ef4444"
                    }}/>
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground pt-1">Based on topics covered vs company focus areas</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Recent Practice */}
        <motion.div {...fadeUp(0.6)}>
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Recent Practice</CardTitle>
                <Link to="/practice"><Button variant="ghost" size="sm" className="text-xs text-primary gap-1">View all <ArrowRight className="h-3 w-3" /></Button></Link>
              </div>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="py-10 text-center">
                  <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No practice history yet</p>
                  <Link to="/practice"><Button size="sm" variant="outline" className="mt-3">Start solving</Button></Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.slice(0, 5).map((h, i) => (
                    <div key={h.id || i} className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className={`h-2 w-2 rounded-full ${h.is_correct ? "bg-emerald-500" : "bg-red-400"}`} />
                        <Badge variant="secondary" className={`text-[10px] px-2 ${h.is_correct ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-500"}`}>
                          {h.is_correct ? "Correct" : "Attempted"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleDateString()}</span>
                      </div>
                      {h.time_spent_seconds && (
                        <span className="text-xs font-mono text-muted-foreground">{Math.round(h.time_spent_seconds / 60)}m</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Interview Sessions */}
        <motion.div {...fadeUp(0.65)}>
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Interview Sessions</CardTitle>
                <Link to="/voice-interview"><Button variant="ghost" size="sm" className="text-xs text-primary gap-1">New <ArrowRight className="h-3 w-3" /></Button></Link>
              </div>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <div className="py-10 text-center">
                  <Mic className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No interviews yet</p>
                  <Link to="/voice-interview"><Button size="sm" variant="outline" className="mt-3">Try AI interview</Button></Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {sessions.slice(0, 5).map((s, i) => {
                    const pct = Math.round(((s.score || 0) / (s.total_questions || 1)) * 100);
                    return (
                      <div key={s.id || i} className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 hover:bg-muted/40 transition-colors">
                        <div>
                          <p className="text-sm font-medium">{s.score}/{s.total_questions} correct</p>
                          <p className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</p>
                        </div>
                        <Badge className={`text-xs font-bold ${pct >= 70 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-600 border-amber-500/20"}`}>
                          {pct}%
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Topic Heatmap */}
      {allQuestions.length > 0 && (
        <motion.div {...fadeUp(0.7)}>
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-primary"/> Topic Coverage Heatmap
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const solvedSet = new Set(history.filter(h => h.is_correct).map(h => h.question_id));
                const topicMap = {};
                allQuestions.forEach(q => {
                  if (!q.category) return;
                  if (!topicMap[q.category]) topicMap[q.category] = { solved: 0, total: 0 };
                  topicMap[q.category].total++;
                  if (solvedSet.has(q.id)) topicMap[q.category].solved++;
                });
                const topics = Object.entries(topicMap).map(([name, d]) => ({
                  name, solved: d.solved, total: d.total,
                  pct: d.total > 0 ? Math.round((d.solved / d.total) * 100) : 0,
                })).sort((a, b) => b.pct - a.pct);
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {topics.map(t => (
                      <div key={t.name} className="rounded-xl border border-border/40 p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-semibold text-foreground truncate">{t.name}</p>
                          <span className="text-[10px] font-bold ml-1 shrink-0" style={{
                            color: t.pct >= 70 ? "#10b981" : t.pct >= 40 ? "#f59e0b" : t.pct > 0 ? "#6366f1" : "#6b7280"
                          }}>{t.pct}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{
                            width: `${t.pct}%`,
                            background: t.pct >= 70 ? "#10b981" : t.pct >= 40 ? "#f59e0b" : t.pct > 0 ? "#6366f1" : "#e5e7eb"
                          }}/>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{t.solved}/{t.total} solved</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default DashboardPage;
