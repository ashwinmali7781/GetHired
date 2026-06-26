import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSupabase } from "@/hooks/use-supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Medal, Award, Code2, Star, Flame, Crown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const RANK_CONFIG = [
  { icon: Crown,  color: "text-yellow-500",  bg: "bg-yellow-500/10",  border: "border-yellow-500/30", gradient: "from-yellow-400/15 to-yellow-300/5" },
  { icon: Medal,  color: "text-slate-400",   bg: "bg-slate-400/10",   border: "border-slate-400/30",  gradient: "from-slate-400/10 to-slate-300/5" },
  { icon: Award,  color: "text-orange-500",  bg: "bg-orange-500/10",  border: "border-orange-500/30", gradient: "from-orange-400/10 to-orange-300/5" },
];

function LeaderboardSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} className={`h-16 rounded-2xl ${i < 3 ? "h-20" : ""}`} />
      ))}
    </div>
  );
}

function Podium({ board }) {
  if (board.length < 3) return null;
  const podium = [board[1], board[0], board[2]]; // 2nd, 1st, 3rd
  const heights = ["h-20", "h-28", "h-16"];
  const labels  = ["2nd", "1st", "3rd"];
  const colors  = ["text-slate-400", "text-yellow-500", "text-orange-500"];
  const bgs     = ["bg-slate-400/10", "bg-yellow-500/10", "bg-orange-500/10"];

  return (
    <div className="flex items-end justify-center gap-3 pb-4 pt-2">
      {podium.map((entry, i) => entry && (
        <motion.div
          key={entry.user_id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 + 0.2 }}
          className="flex flex-col items-center gap-2"
        >
          <Avatar className={`h-10 w-10 ring-2 ${i === 1 ? "ring-yellow-500/50 h-12 w-12" : "ring-slate-400/30"}`}>
            <AvatarFallback className={`text-xs font-bold ${bgs[i]} ${colors[i]}`}>
              {(entry.name || "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <p className={`text-xs font-semibold ${colors[i]} max-w-[72px] truncate text-center`}>{entry.name || "Anon"}</p>
          <div className={`${heights[i]} w-20 rounded-t-xl ${bgs[i]} border border-current/20 ${colors[i]} flex items-start justify-center pt-2`}>
            <span className={`text-lg font-bold ${colors[i]}`}>{labels[i]}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

const LeaderboardPage = () => {
  const { user } = useAuth();
  const supabase = useSupabase();
  const [solvedBoard, setSolvedBoard] = useState([]);
  const [scoreBoard,  setScoreBoard]  = useState([]);
  const [tab,     setTab]     = useState("solved");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: hist }, { data: sess }] = await Promise.all([
        supabase.from("practice_history").select("user_id, is_correct").eq("is_correct", true),
        supabase.from("interview_sessions").select("user_id, score, total_questions"),
      ]);

      const ids = new Set([...(hist||[]).map(h=>h.user_id), ...(sess||[]).map(s=>s.user_id)]);
      let nameById = {};
      if (ids.size > 0) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, display_name").in("user_id", [...ids]);
        nameById = Object.fromEntries((profiles||[]).map(p => [p.user_id, p.display_name]));
      }

      const solvedMap = {};
      (hist||[]).forEach(({ user_id }) => {
        if (!solvedMap[user_id]) solvedMap[user_id] = { user_id, name: nameById[user_id]||"Anonymous", count: 0 };
        solvedMap[user_id].count++;
      });
      setSolvedBoard(Object.values(solvedMap).sort((a,b) => b.count - a.count).slice(0,10));

      const scoreMap = {};
      (sess||[]).forEach(({ user_id, score, total_questions }) => {
        if (!scoreMap[user_id]) scoreMap[user_id] = { user_id, name: nameById[user_id]||"Anonymous", total: 0, count: 0 };
        scoreMap[user_id].total += (score||0) / (total_questions||1) * 100;
        scoreMap[user_id].count++;
      });
      setScoreBoard(Object.values(scoreMap).map(e => ({ ...e, avg: Math.round(e.total / e.count) })).sort((a,b) => b.avg - a.avg).slice(0,10));
      setLoading(false);
    })();
  }, [supabase]);

  const board = tab === "solved" ? solvedBoard : scoreBoard;
  const myRank = board.findIndex(e => e.user_id === user?.id) + 1;
  const myEntry = board.find(e => e.user_id === user?.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-center space-y-1 mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Leaderboard</h1>
          <p className="text-muted-foreground text-sm">Compete with fellow developers worldwide</p>
        </div>
      </motion.div>

      {/* My rank card */}
      {!loading && myEntry && (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/0 shadow-elevated">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-lg">
                  #{myRank}
                </div>
                <div>
                  <p className="text-sm font-semibold">Your Ranking</p>
                  <p className="text-xs text-muted-foreground">
                    {tab === "solved" ? `${myEntry.count} problems solved` : `${myEntry.avg}% avg score`}
                  </p>
                </div>
              </div>
              <Badge className="bg-primary/10 text-primary border-primary/20 text-sm px-3 py-1 font-bold">
                Top {Math.ceil((myRank / board.length) * 100)}%
              </Badge>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Tab switcher */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
        <div className="flex gap-1 rounded-2xl bg-muted/60 p-1.5">
          {[
            { id: "solved", label: "Most Solved",     icon: Code2 },
            { id: "score",  label: "Interview Score", icon: Star  },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all ${
                tab === t.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Board */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="shadow-card overflow-hidden">
            {/* Podium (top 3 only) */}
            {!loading && board.length >= 3 && (
              <div className="border-b border-border bg-gradient-to-b from-muted/30 to-transparent px-4 pt-4">
                <Podium board={board} />
              </div>
            )}

            <CardContent className="p-0">
              {loading ? (
                <div className="p-4"><LeaderboardSkeleton /></div>
              ) : board.length === 0 ? (
                <div className="py-16 text-center">
                  <Trophy className="mx-auto h-12 w-12 text-muted-foreground/20 mb-3" />
                  <p className="text-sm text-muted-foreground">No data yet — be the first!</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {board.map((entry, idx) => {
                    const rank = idx + 1;
                    const cfg  = RANK_CONFIG[idx] || null;
                    const isMe = entry.user_id === user?.id;
                    return (
                      <motion.div
                        key={entry.user_id}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${
                          isMe ? "bg-primary/5" : "hover:bg-muted/30"
                        }`}
                      >
                        {/* Rank */}
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                          cfg ? `${cfg.bg} ${cfg.color}` : "bg-muted text-muted-foreground"
                        }`}>
                          {cfg ? <cfg.icon className="h-4 w-4" /> : rank}
                        </div>

                        {/* Avatar */}
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarFallback className={`text-xs font-bold ${cfg ? `${cfg.bg} ${cfg.color}` : "bg-muted"}`}>
                            {(entry.name || "?").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${isMe ? "text-primary" : "text-foreground"}`}>
                            {entry.name || "Anonymous"}
                            {isMe && <span className="ml-2 text-[10px] font-normal text-primary/70">(you)</span>}
                          </p>
                        </div>

                        {/* Score */}
                        <div className="text-right shrink-0">
                          <p className={`text-base font-bold ${cfg ? cfg.color : "text-foreground"}`}>
                            {tab === "solved" ? entry.count : `${entry.avg}%`}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {tab === "solved" ? "solved" : "avg score"}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default LeaderboardPage;
