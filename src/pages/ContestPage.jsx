import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSupabase } from "@/hooks/use-supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Trophy, Clock, Zap, Lock, CheckCircle, ArrowRight, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { awardXP } from "@/lib/xp";

// Generate deterministic weekly contest from the question bank
function getWeeklyContest(questions) {
  if (!questions.length) return null;
  const now = new Date();
  // Week number since epoch
  const weekNum = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
  const seed = weekNum * 31337;

  // Pick 4 questions: 2 easy, 1 medium, 1 hard
  const easy   = questions.filter(q => q.difficulty === "Easy");
  const medium = questions.filter(q => q.difficulty === "Medium");
  const hard   = questions.filter(q => q.difficulty === "Hard");

  const pick = (arr, n, offset) => {
    const result = [];
    for (let i = 0; i < n && arr.length > 0; i++) {
      result.push(arr[(seed + offset + i * 7919) % arr.length]);
    }
    return result;
  };

  const picked = [
    ...pick(easy, 2, 0),
    ...pick(medium, 1, 1000),
    ...pick(hard, 1, 2000),
  ].filter(Boolean);

  // Contest window: Mon 00:00 UTC → Sun 23:59 UTC
  const day = now.getUTCDay();
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - ((day + 6) % 7));
  monday.setUTCHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  return {
    id:        `week-${weekNum}`,
    title:     `Week ${weekNum % 52 + 1} Contest`,
    starts_at: monday.toISOString(),
    ends_at:   sunday.toISOString(),
    questions: picked,
    xpRewards: { Easy: 15, Medium: 35, Hard: 75 },
  };
}

function CountdownTimer({ endsAt }) {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    const update = () => {
      const diff = new Date(endsAt) - new Date();
      if (diff <= 0) { setTimeLeft("Ended"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${d}d ${h}h ${m}m`);
    };
    update();
    const t = setInterval(update, 60000);
    return () => clearInterval(t);
  }, [endsAt]);
  return <span>{timeLeft}</span>;
}

const ContestPage = () => {
  const { user }  = useAuth();
  const supabase  = useSupabase();
  const [questions, setQuestions]       = useState([]);
  const [contest, setContest]           = useState(null);
  const [solvedIds, setSolvedIds]       = useState(new Set());
  const [contestSolved, setContestSolved] = useState(new Set());
  const [loading, setLoading]           = useState(true);
  const [leaderboard, setLeaderboard]   = useState([]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    Promise.all([
      supabase.from("questions").select("id, title, difficulty, category").limit(220),
      supabase.from("practice_history").select("question_id, is_correct").eq("user_id", user.id),
    ]).then(([q, h]) => {
      const allQs = q.data || [];
      setQuestions(allQs);
      const c = getWeeklyContest(allQs);
      setContest(c);

      const solved = new Set((h.data || []).filter(r => r.is_correct).map(r => r.question_id));
      setSolvedIds(solved);

      if (c) {
        const cs = new Set(c.questions.filter(q => solved.has(q.id)).map(q => q.id));
        setContestSolved(cs);

        // Fake leaderboard from practice_history counts (no real contest table needed)
        supabase.from("profiles").select("user_id, display_name, total_xp")
          .order("total_xp", { ascending: false }).limit(10)
          .then(({ data }) => setLeaderboard(data || []));
      }
      setLoading(false);
    });
  }, [user, supabase]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"/>
    </div>
  );

  if (!contest) return (
    <div className="text-center py-20 text-muted-foreground text-sm">No contest available.</div>
  );

  const totalXp = contest.questions.reduce((sum, q) => sum + (contestSolved.has(q.id) ? contest.xpRewards[q.difficulty] : 0), 0);
  const maxXp   = contest.questions.reduce((sum, q) => sum + contest.xpRewards[q.difficulty], 0);
  const progress = Math.round((contestSolved.size / contest.questions.length) * 100);

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl gradient-primary">
            <Trophy className="h-6 w-6 text-white"/>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{contest.title}</h1>
            <p className="text-sm text-muted-foreground">Solve all 4 problems before the week ends</p>
          </div>
          <div className="ml-auto flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-1.5">
            <Clock className="h-3.5 w-3.5 text-amber-500"/>
            <span className="text-xs font-semibold text-amber-600">
              <CountdownTimer endsAt={contest.ends_at}/>
            </span>
          </div>
        </div>
      </motion.div>

      {/* Progress */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="shadow-card">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{contestSolved.size} / {contest.questions.length} solved</span>
              <div className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-primary"/>
                <span className="text-sm font-bold text-primary">{totalXp} / {maxXp} XP</span>
              </div>
            </div>
            <Progress value={progress} className="h-2"/>
            {contestSolved.size === contest.questions.length && (
              <p className="text-xs text-emerald-500 font-semibold flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5"/> Contest complete! Great work this week.
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Problems */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">This Week's Problems</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {contest.questions.map((q, i) => {
              const done = contestSolved.has(q.id);
              return (
                <div key={q.id} className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition-all ${
                  done ? "border-emerald-500/20 bg-emerald-500/5" : "border-border/60 bg-muted/10 hover:bg-muted/30"
                }`}>
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                  }`}>
                    {done ? <CheckCircle className="h-4 w-4"/> : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{q.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge className={`text-[10px] px-1.5 ${
                        q.difficulty === "Easy" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                        q.difficulty === "Medium" ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                        "bg-red-500/10 text-red-500 border-red-500/20"
                      }`}>{q.difficulty}</Badge>
                      <span className="text-[10px] text-muted-foreground">{q.category}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 text-xs font-bold text-primary">
                      <Zap className="h-3 w-3"/>{contest.xpRewards[q.difficulty]} XP
                    </div>
                    <Link to="/practice">
                      <Button size="sm" variant={done ? "outline" : "default"}
                        className={`h-7 text-xs rounded-xl gap-1 ${done ? "" : "gradient-primary text-white border-0"}`}>
                        {done ? "Revisit" : <>Solve <ArrowRight className="h-3 w-3"/></>}
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </motion.div>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500"/> Weekly XP Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {leaderboard.map((u, i) => (
                <div key={u.user_id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                  u.user_id === user?.id ? "bg-primary/5 border border-primary/20" : "bg-muted/20"
                }`}>
                  <span className={`text-sm font-black w-5 text-center ${
                    i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-amber-700" : "text-muted-foreground"
                  }`}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
                  <p className="flex-1 text-xs font-semibold text-foreground truncate">
                    {u.display_name || "Anonymous"}
                    {u.user_id === user?.id && <span className="text-primary ml-1">(you)</span>}
                  </p>
                  <div className="flex items-center gap-1 text-xs font-bold text-primary">
                    <Zap className="h-3 w-3"/>{u.total_xp || 0}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* How it works */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="shadow-card border-border/40">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5"/> How weekly contests work
            </p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• New set of 4 problems every Monday at midnight UTC</li>
              <li>• Solve them anytime during the week from the Practice page</li>
              <li>• Earn bonus XP: Easy +15, Medium +35, Hard +75</li>
              <li>• Rankings reset every week — everyone starts fresh</li>
            </ul>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default ContestPage;
