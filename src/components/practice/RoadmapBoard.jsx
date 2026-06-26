import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronDown, Flame, Target, ListChecks, CalendarDays,
  Sparkles, ListTodo, Lock,
} from "lucide-react";
import {
  ROADMAP_WEEKS, TOTAL_ROADMAP_PROBLEMS, TOTAL_MILESTONES,
  WEAK_TOPIC_WEEKS, getWeekStatuses, masteryColor,
} from "@/lib/roadmap-data";
import { getWeakTopicRecoveryPlan } from "@/lib/roadmap-ai";

const difficultyColors = {
  Easy:   "bg-success/10 text-success border-success/20",
  Medium: "bg-warning/10 text-warning border-warning/20",
  Hard:   "bg-destructive/10 text-destructive border-destructive/20",
};

const STATUS_FILTERS = [
  { value: "all",         label: "All weeks" },
  { value: "in_progress", label: "In progress" },
  { value: "completed",   label: "Completed" },
  { value: "upcoming",    label: "Upcoming" },
];

const statusBadge = {
  in_progress: <Badge className="gap-1 border-primary/20 bg-primary/10 text-primary">In progress</Badge>,
  completed:   <Badge className="gap-1 border-success/20 bg-success/10 text-success">Completed</Badge>,
  upcoming:    <Badge variant="secondary" className="gap-1 text-muted-foreground">Upcoming</Badge>,
};

/** Day-granularity streak across any roadmap or practice activity. */
function calcStreak(activityDates) {
  if (!activityDates.length) return 0;
  const days = [...new Set(activityDates.map((d) => new Date(d).toDateString()))];
  days.sort((a, b) => new Date(b) - new Date(a));
  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (const day of days) {
    const d = new Date(day);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((cursor - d) / 86400000);
    if (diff <= 1) { streak++; cursor = d; }
    else break;
  }
  return streak;
}

const RoadmapBoard = ({ user, supabase, onPracticeWeek }) => {
  const { toast } = useToast();
  const [completedIds, setCompletedIds]   = useState(new Set());
  const [history, setHistory]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [statusFilter, setStatusFilter]   = useState("all");
  const [expandedWeeks, setExpandedWeeks] = useState(new Set());
  const [analyzing, setAnalyzing]         = useState(false);
  const [aiPlan, setAiPlan]               = useState("");

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const load = async () => {
      const [progressRes, historyRes] = await Promise.all([
        supabase.from("roadmap_progress").select("milestone_id, completed_at"),
        supabase.from("practice_history").select("*, questions(category)").order("created_at", { ascending: false }),
      ]);
      setCompletedIds(new Set((progressRes.data || []).map((r) => r.milestone_id)));
      setHistory((historyRes.data || []).map((h) => ({ ...h, category: h.questions?.category })));
      setLoading(false);
    };
    load();
  }, [user, supabase]);

  const weeks = useMemo(() => getWeekStatuses(completedIds), [completedIds]);

  // Default-expand whichever week is currently "in progress", once loaded.
  useEffect(() => {
    if (loading) return;
    const current = weeks.find((w) => w.status === "in_progress");
    if (current) setExpandedWeeks(new Set([current.week]));
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMilestone = async (week, milestoneId, checked) => {
    if (!user) return;
    // optimistic UI
    setCompletedIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(milestoneId) : next.delete(milestoneId);
      return next;
    });
    if (checked) {
      const { error } = await supabase.from("roadmap_progress").insert({
        user_id: user.id, week_number: week, milestone_id: milestoneId,
      });
      if (error) {
        setCompletedIds((prev) => { const n = new Set(prev); n.delete(milestoneId); return n; });
        toast({ title: "Couldn't save progress", description: error.message, variant: "destructive" });
      }
    } else {
      const { error } = await supabase.from("roadmap_progress").delete()
        .eq("user_id", user.id).eq("milestone_id", milestoneId);
      if (error) {
        setCompletedIds((prev) => new Set(prev).add(milestoneId));
        toast({ title: "Couldn't save progress", description: error.message, variant: "destructive" });
      }
    }
  };

  const toggleExpanded = (week) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      next.has(week) ? next.delete(week) : next.add(week);
      return next;
    });
  };

  /* ── Stats ── */
  const overallFraction = completedIds.size / TOTAL_MILESTONES;
  const overallPct       = Math.round(overallFraction * 100);
  const currentWeek      = weeks.find((w) => w.status === "in_progress") || weeks[weeks.length - 1];
  const problemsSolved   = history.filter((h) => h.is_correct).length;
  const streak = calcStreak([
    ...history.map((h) => h.created_at),
  ]);

  /* ── Weak topic analysis (real data: milestone completion blended with
     practice accuracy in that category where we have any submissions) ── */
  const topicScores = useMemo(() => {
    return WEAK_TOPIC_WEEKS.map((weekNum) => {
      const week = ROADMAP_WEEKS.find((w) => w.week === weekNum);
      const solved = week.milestones.filter((m) => completedIds.has(m.id)).length;
      const milestoneFraction = solved / week.milestones.length;

      let mastery;
      if (week.dbCategory) {
        const attempts = history.filter((h) => h.category === week.dbCategory);
        if (attempts.length > 0) {
          const acc = attempts.filter((h) => h.is_correct).length / attempts.length;
          mastery = Math.round(0.5 * milestoneFraction * 100 + 0.5 * acc * 100);
        } else {
          mastery = Math.round(milestoneFraction * 100);
        }
      } else {
        mastery = Math.round(milestoneFraction * 100);
      }

      return { week: weekNum, title: week.title, mastery, solved, total: week.milestones.length };
    }).sort((a, b) => a.mastery - b.mastery);
  }, [completedIds, history]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAiPlan("");
    const plan = await getWeakTopicRecoveryPlan(topicScores);
    setAiPlan(plan);
    setAnalyzing(false);
  };

  const filteredWeeks = statusFilter === "all" ? weeks : weeks.filter((w) => w.status === statusFilter);

  const handlePracticeWeek = (week) => {
    if (!week.dbCategory) {
      toast({
        title: `No dedicated problems for ${week.title} yet`,
        description: "Showing the full problem bank instead — great warm-ups either way.",
      });
    }
    onPracticeWeek(week);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Weak topic analysis */}
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Target className="h-4 w-4 text-primary" /> Weak topic analysis
          </CardTitle>
          <Button size="sm" variant="outline" onClick={handleAnalyze} disabled={analyzing} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            {analyzing ? "Analyzing..." : "Analyze my weak topics"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {topicScores.map((t) => (
            <div key={t.week} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-card-foreground">{t.title}</span>
                <span className="text-xs text-muted-foreground">{t.mastery}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${t.mastery}%`, backgroundColor: masteryColor(t.mastery) }}
                />
              </div>
            </div>
          ))}
          <p className="pt-1 text-xs text-muted-foreground">
            Roadmap prioritized — weakest topics: {topicScores[0]?.title} & {topicScores[1]?.title}. Click a week below to start.
          </p>

          {(analyzing || aiPlan) && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-semibold text-primary">2-Week Recovery Plan</h4>
              </div>
              {analyzing ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Building your focused recovery plan...
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-sm text-foreground/80">{aiPlan}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: ListChecks,   label: "topics done",   value: `${overallPct}%`, title: "Overall progress" },
          { icon: CalendarDays, label: currentWeek?.title || "—", value: `Week ${currentWeek?.week ?? 1}`, title: "Current week" },
          { icon: ListTodo,     label: `/ ${TOTAL_ROADMAP_PROBLEMS} total`, value: problemsSolved, title: "Problems solved" },
          { icon: Flame,        label: "day streak",    value: streak, title: "Streak" },
        ].map((s) => (
          <Card key={s.title} className="shadow-card">
            <CardContent className="pt-5">
              <p className="text-xs text-muted-foreground">{s.title}</p>
              <p className="mt-1 text-2xl font-bold text-card-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Roadmap completion */}
      <Card className="shadow-card">
        <CardContent className="space-y-2 pt-5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-card-foreground">Roadmap completion</span>
            <span className="text-muted-foreground">{overallPct}%</span>
          </div>
          <Progress value={overallPct} className="h-2" />
        </CardContent>
      </Card>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={statusFilter === f.value ? "default" : "outline"}
            onClick={() => setStatusFilter(f.value)}
            className="rounded-full text-xs"
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Week list */}
      <div className="space-y-3">
        {filteredWeeks.map((week) => {
          const isOpen = expandedWeeks.has(week.week);
          const doneCount = week.milestones.filter((m) => completedIds.has(m.id)).length;
          const isUpcoming = week.status === "upcoming";

          return (
            <Card
              key={week.week}
              className={`shadow-card transition-colors ${
                week.status === "in_progress" ? "border-l-4 border-l-primary" : ""
              } ${isUpcoming ? "opacity-70" : ""}`}
            >
              <Collapsible open={isOpen} onOpenChange={() => toggleExpanded(week.week)}>
                <CollapsibleTrigger asChild>
                  <button className="flex w-full items-center justify-between gap-3 p-4 text-left">
                    <div className="flex items-center gap-3">
                      {statusBadge[week.status]}
                      <span className="font-semibold text-card-foreground">
                        Week {week.week}: {week.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{doneCount}/{week.milestones.length}</span>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-3 pt-0">
                    <div className="space-y-2">
                      {week.milestones.map((m) => (
                        <label
                          key={m.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 hover:bg-muted/40"
                        >
                          <div className="flex items-center gap-2.5">
                            <Checkbox
                              checked={completedIds.has(m.id)}
                              onCheckedChange={(checked) => toggleMilestone(week.week, m.id, Boolean(checked))}
                              disabled={!user}
                            />
                            <span className={`text-sm ${completedIds.has(m.id) ? "text-muted-foreground line-through" : "text-card-foreground"}`}>
                              {m.label}
                            </span>
                          </div>
                          <Badge className={`${difficultyColors[m.difficulty]} text-xs`}>{m.difficulty}</Badge>
                        </label>
                      ))}
                    </div>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handlePracticeWeek(week)}>
                      <ListTodo className="h-3.5 w-3.5" />
                      Practice {week.problemsTotal} problems
                    </Button>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}

        {filteredWeeks.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">No weeks match this filter.</div>
        )}
      </div>

      {!user && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" /> Sign in to save your roadmap progress across devices.
        </div>
      )}
    </div>
  );
};

export default RoadmapBoard;
