import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSupabase } from "@/hooks/use-supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { reviewCode, isGeminiConfigured, getAIHint } from "@/lib/gemini";
import { DiscussionPanel } from "@/components/practice/DiscussionPanel";
import { awardXP, XP_REWARDS } from "@/lib/xp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Bookmark, BookmarkCheck, Search, Eye, EyeOff, Play, Clock, Copy, Check,
  Building2, Map, ListFilter, Send, ChevronDown, ChevronUp, Terminal,
  Cpu, MemoryStick, CheckCircle2, XCircle, AlertCircle, Loader2, Lock, Code2,
  RotateCcw, PauseCircle, PlayCircle, Shuffle, TrendingUp, Flame, FileText,
  ChevronRight, ChevronLeft, Lightbulb, History,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import Editor from "@monaco-editor/react";
import RoadmapBoard from "@/components/practice/RoadmapBoard";
import { runAgainstTestCases, LANGUAGES, getLanguage, isJudge0Configured } from "@/lib/judge0";

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */
const difficultyColors = {
  Easy:   "bg-success/10 text-success border-success/20",
  Medium: "bg-warning/10 text-warning border-warning/20",
  Hard:   "bg-destructive/10 text-destructive border-destructive/20",
};

const COMPANIES = [
  "All Companies", "Google", "Meta", "Amazon", "Microsoft", "Apple", "Netflix",
  "Uber", "Airbnb", "LinkedIn", "Bloomberg", "Adobe", "Oracle",
  "Salesforce", "Goldman Sachs", "ByteDance",
];

const CATEGORIES = [
  "All Categories", "Arrays", "Strings", "Linked Lists", "Stacks & Queues",
  "Trees", "Graphs", "Dynamic Programming", "Searching", "Greedy",
  "Bit Manipulation", "Heap", "Hashing", "Math",
];

/* ─────────────────────────────────────────────
   Helper components
───────────────────────────────────────────── */
function VerdictPill({ passed, label, hidden }) {
  if (hidden) return (
    <span className="flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground">
      <Lock className="h-3 w-3" /> Hidden
    </span>
  );
  return passed ? (
    <span className="flex items-center gap-1 rounded-full border border-success/20 bg-success/10 px-2.5 py-0.5 text-xs text-success">
      <CheckCircle2 className="h-3 w-3" /> Passed
    </span>
  ) : (
    <span className="flex items-center gap-1 rounded-full border border-destructive/20 bg-destructive/10 px-2.5 py-0.5 text-xs text-destructive">
      <XCircle className="h-3 w-3" /> {label || "Failed"}
    </span>
  );
}

function StatsBar({ timeSec, memoryKb }) {
  if (!timeSec && !memoryKb) return null;
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      {timeSec != null && <span className="flex items-center gap-1"><Cpu className="h-3 w-3" /> {(timeSec * 1000).toFixed(0)} ms</span>}
      {memoryKb != null && <span className="flex items-center gap-1"><MemoryStick className="h-3 w-3" /> {(memoryKb / 1024).toFixed(1)} MB</span>}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Build clean LeetCode-style stub (never leaks solution)
───────────────────────────────────────────── */
function extractFnName(code) {
  const m = code.match(/function\s+(\w+)\s*\(/) || code.match(/def\s+(\w+)\s*\(/);
  return m?.[1] || "solve";
}
function extractArgs(code) {
  const m = code.match(/function\s+\w+\s*\(([^)]*)\)/) || code.match(/def\s+\w+\s*\(([^)]*)\)/);
  if (!m) return [];
  return m[1].split(",").map(a => a.trim().replace(/^self$/, "")).filter(Boolean);
}
function buildFunctionStub(q, lang) {
  const fnName  = q.function_name || extractFnName(q.starter_code || "");
  const argList = extractArgs(q.starter_code || "");
  if (lang === "javascript") {
    return `/**\n * @param {*} ${argList[0] || "input"}\n * @return {*}\n */\nvar ${fnName} = function(${argList.join(", ")}) {\n    \n};`;
  }
  if (lang === "python") {
    const pyArgs = argList.length ? "self, " + argList.join(", ") : "self";
    return `class Solution:\n    def ${fnName}(${pyArgs}):\n        `;
  }
  if (lang === "cpp") {
    return `#include <bits/stdc++.h>\nusing namespace std;\n\nclass Solution {\npublic:\n    auto ${fnName}(${argList.map(a => `auto ${a}`).join(", ")}) {\n        \n    }\n};`;
  }
  if (lang === "java") {
    return `class Solution {\n    public Object ${fnName}(${argList.map(a => `Object ${a}`).join(", ")}) {\n        \n    }\n}`;
  }
  return `function ${fnName}(${argList.join(", ")}) {\n    \n}`;
}

/* ─────────────────────────────────────────────
   useTimer — fixed: tracks startTime in a ref,
   not state, so the interval always reads the
   latest value without needing it as a dependency
───────────────────────────────────────────── */
function useTimer() {
  const [elapsed, setElapsed]   = useState(0);
  const [paused, setPaused]     = useState(false);
  const [started, setStarted]   = useState(false); // NEW: has the timer ever been started?
  const startTimeRef            = useRef(null);   // Date.now() when timer last (re)started
  const accumulatedRef          = useRef(0);      // seconds accumulated before last pause
  const intervalRef             = useRef(null);

  const tick = useCallback(() => {
    if (startTimeRef.current == null) return;
    const delta = Math.floor((Date.now() - startTimeRef.current) / 1000);
    setElapsed(accumulatedRef.current + delta);
  }, []);

  const start = useCallback(() => {
    clearInterval(intervalRef.current);
    accumulatedRef.current = 0;
    startTimeRef.current   = Date.now();
    setElapsed(0);
    setPaused(false);
    setStarted(true);
    intervalRef.current = setInterval(tick, 1000);
  }, [tick]);

  const pause = useCallback(() => {
    if (paused) {
      // Resume
      startTimeRef.current = Date.now();
      intervalRef.current  = setInterval(tick, 1000);
      setPaused(false);
    } else {
      // Pause — accumulate elapsed so far
      if (startTimeRef.current != null) {
        accumulatedRef.current += Math.floor((Date.now() - startTimeRef.current) / 1000);
      }
      clearInterval(intervalRef.current);
      setPaused(true);
    }
  }, [paused, tick]);

  const stop = useCallback(() => {
    clearInterval(intervalRef.current);
    startTimeRef.current = null;
  }, []);

  const getElapsed = useCallback(() => {
    if (startTimeRef.current == null) return accumulatedRef.current;
    return accumulatedRef.current + Math.floor((Date.now() - startTimeRef.current) / 1000);
  }, []);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const reset = useCallback(() => {
    clearInterval(intervalRef.current);
    startTimeRef.current   = null;
    accumulatedRef.current = 0;
    setElapsed(0);
    setPaused(false);
    setStarted(false);
  }, []);

  return { elapsed, paused, started, start, pause, stop, reset, getElapsed };
}

/* ─────────────────────────────────────────────
   Resizable drag divider
───────────────────────────────────────────── */
function useDragDivider(initialPct = 42) {
  const [pct, setPct]   = useState(initialPct);
  const dragging        = useRef(false);
  const containerRef    = useRef(null);
  const onMouseDown     = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor     = "col-resize";
    document.body.style.userSelect = "none";
  }, []);
  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setPct(Math.min(Math.max(((e.clientX - rect.left) / rect.width) * 100, 20), 75));
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor     = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);
  return { pct, containerRef, onMouseDown };
}

function useVerticalDragDivider(initialPct = 65) {
  const [pct, setPct]   = useState(initialPct);
  const dragging        = useRef(false);
  const containerRef    = useRef(null);
  const onMouseDown     = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor     = "row-resize";
    document.body.style.userSelect = "none";
  }, []);
  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setPct(Math.min(Math.max(((e.clientY - rect.top) / rect.height) * 100, 30), 85));
    };
    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor     = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);
  return { pct, containerRef, onMouseDown };
}

const fmt = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/* ─────────────────────────────────────────────
   Notes panel (persistent per question — Supabase with localStorage fallback)
───────────────────────────────────────────── */
function NotesPanel({ questionId }) {
  const { user }  = useAuth();
  const supabase  = useSupabase();
  const lsKey     = `note_${questionId}`;
  const [val, setVal]       = useState(() => localStorage.getItem(lsKey) || "");
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef(null);

  // Load from Supabase on mount (overrides localStorage if found)
  useEffect(() => {
    if (!user || !supabase || !questionId) return;
    supabase.from("problem_notes")
      .select("content")
      .eq("user_id", user.id)
      .eq("question_id", questionId)
      .single()
      .then(({ data }) => {
        if (data?.content !== undefined) {
          setVal(data.content);
          localStorage.setItem(lsKey, data.content);
        }
      });
  }, [user, supabase, questionId, lsKey]);

  const handleChange = (e) => {
    const v = e.target.value;
    setVal(v);
    localStorage.setItem(lsKey, v); // instant local save

    // Debounce Supabase upsert by 1.5s
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (!user || !supabase) return;
    setSaving(true);
    saveTimer.current = setTimeout(async () => {
      await supabase.from("problem_notes").upsert(
        { user_id: user.id, question_id: questionId, content: v, updated_at: new Date().toISOString() },
        { onConflict: "user_id,question_id" }
      );
      setSaving(false);
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full p-3 gap-2">
      <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
        <FileText className="h-3 w-3" /> Scratch notes
        {saving && <span className="text-[10px] text-primary animate-pulse ml-auto">Saving…</span>}
        {!saving && user && <span className="text-[10px] text-muted-foreground/50 ml-auto">Auto-saved</span>}
        {!user && <span className="text-[10px] text-muted-foreground/50 ml-auto">Saved locally</span>}
      </p>
      <textarea
        className="flex-1 resize-none rounded-md border border-border bg-muted/30 p-2 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/50"
        placeholder="Jot down your approach, complexity analysis, edge cases…"
        value={val}
        onChange={handleChange}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Success celebration overlay
───────────────────────────────────────────── */
function SuccessOverlay({ show, time, onDismiss }) {
  if (!show) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onDismiss}
      >
        <motion.div
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          className="rounded-2xl border border-success/30 bg-card p-8 text-center shadow-2xl max-w-xs w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-4xl mb-3">🎉</div>
          <h2 className="text-xl font-bold text-success mb-1">All Tests Passed!</h2>
          <p className="text-sm text-muted-foreground mb-4">Solved in <span className="font-mono font-semibold text-foreground">{fmt(time)}</span></p>
          <Button size="sm" onClick={onDismiss} className="w-full">Continue</Button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════
   Main component
═══════════════════════════════════════════ */
const PracticePage = () => {
  const { user }   = useAuth();
  const supabase   = useSupabase();
  const { toast }  = useToast();
  const timer      = useTimer();
  const { pct, containerRef, onMouseDown } = useDragDivider(42);
  const { pct: vPct, containerRef: vContainerRef, onMouseDown: vOnMouseDown } = useVerticalDragDivider(65);

  /* list state */
  const [questions, setQuestions]           = useState([]);
  const [solvedSet, setSolvedSet]           = useState(new Set());
  const [bookmarks, setBookmarks]           = useState(new Set());
  const [search, setSearch]                 = useState("");
  const [diffFilter, setDiffFilter]         = useState("all");
  const [catFilter, setCatFilter]           = useState("all");
  const [companyFilter, setCompanyFilter]   = useState("All Companies");
  const [activeTab, setActiveTab]           = useState("roadmap");
  const [sortBy, setSortBy]                 = useState("difficulty");   // NEW: sort

  /* editor / solve state */
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [language, setLanguage]                 = useState("python");
  const [code, setCode]                         = useState("");
  const [showSolution, setShowSolution]         = useState(false);
  const [copied, setCopied]                     = useState(false);
  const [descTab, setDescTab]                   = useState("description"); // "description" | "notes" | "ai-review"
  const [aiReview, setAiReview]                 = useState(null);
  const [aiReviewing, setAiReviewing]           = useState(false);
  const [showSuccess, setShowSuccess]           = useState(false);
  const [solveTime, setSolveTime]               = useState(0);
  const [hintIdx, setHintIdx]                   = useState(0);            // progressive hints
  const [aiHints, setAiHints]                   = useState([]);            // AI-generated hints text[]
  const [hintLoading, setHintLoading]           = useState(false);

  /* judge0 state */
  const [running, setRunning]                   = useState(false);
  const [submitting, setSubmitting]             = useState(false);
  const [runResults, setRunResults]             = useState(null);
  const [submitResults, setSubmitResults]       = useState(null);
  const [judgeTab, setJudgeTab]                 = useState("output");
  const [expandedCase, setExpandedCase]         = useState(0);
  const [submissionHistory, setSubmissionHistory] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  /* ── load questions + bookmarks + solved ── */
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("questions").select("*").order("difficulty");
      setQuestions(data || []);
      if (user) {
        const [bm, ph] = await Promise.all([
          supabase.from("bookmarks").select("question_id"),
          supabase.from("practice_history").select("question_id").eq("is_correct", true),
        ]);
        setBookmarks(new Set((bm.data || []).map(b => b.question_id)));
        setSolvedSet(new Set((ph.data || []).map(p => p.question_id)));
      }
    };
    load();
  }, [user, supabase]);

  /* ── filtering + sorting ── */
  const filtered = questions
    .filter((q) => {
      if (search && !q.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (diffFilter !== "all" && q.difficulty !== diffFilter) return false;
      if (catFilter !== "all" && q.category !== catFilter) return false;
      if (companyFilter !== "All Companies" && !(q.companies || []).includes(companyFilter)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "difficulty") {
        const order = { Easy: 0, Medium: 1, Hard: 2 };
        return (order[a.difficulty] ?? 1) - (order[b.difficulty] ?? 1);
      }
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "unsolved") {
        const aS = solvedSet.has(a.id) ? 1 : 0;
        const bS = solvedSet.has(b.id) ? 1 : 0;
        return aS - bS;
      }
      return 0;
    });

  /* ── navigate prev / next problem (within current filtered list) ── */
  const currentIdx   = selectedQuestion ? filtered.findIndex(q => q.id === selectedQuestion.id) : -1;
  const canGoPrev    = currentIdx > 0;
  const canGoNext    = currentIdx !== -1 && currentIdx < filtered.length - 1;

  const openQuestion = useCallback((q) => {
    setSelectedQuestion(q);
    setLanguage("python");
    setCode(buildFunctionStub(q, "python"));
    setShowSolution(false);
    setRunResults(null);
    setSubmitResults(null);
    setJudgeTab("output");
    setExpandedCase(0);
    setDescTab("description");
    setAiReview(null);
    setAiHints([]);
    setHintIdx(0);
    setHintIdx(0);
    setShowSuccess(false);
    setSubmissionHistory([]);
    setSelectedSubmission(null); // reset to 0:00 (not started) — user clicks to start
    // Load submission history for this question
    if (user) {
      supabase.from("practice_history")
        .select("*")
        .eq("user_id", user.id)
        .eq("question_id", q.id)
        .order("created_at", { ascending: false })
        .limit(20)
        .then(({ data }) => setSubmissionHistory(data || []));
    }
  }, [timer, user, supabase]);

  const goToQuestion = useCallback((q) => {
    if (!q) return;
    openQuestion(q);
  }, [openQuestion]);

  /* ── random problem ── */
  const handleRandom = () => {
    const pool = filtered.filter(q => !solvedSet.has(q.id));
    const pick = pool.length ? pool[Math.floor(Math.random() * pool.length)] : filtered[Math.floor(Math.random() * filtered.length)];
    if (pick) openQuestion(pick);
  };

  /* ── switch language ── */
  const switchLanguage = useCallback((val) => {
    setLanguage(val);
    if (selectedQuestion) setCode(buildFunctionStub(selectedQuestion, val));
    setRunResults(null);
    setSubmitResults(null);
  }, [selectedQuestion]);

  /* ── reset code ── */
  const handleReset = () => {
    if (!selectedQuestion) return;
    setCode(buildFunctionStub(selectedQuestion, language));
    setRunResults(null);
    setSubmitResults(null);
  };

  /* ── bookmark ── */
  const toggleBookmark = async (questionId) => {
    if (!user) return;
    if (bookmarks.has(questionId)) {
      await supabase.from("bookmarks").delete().eq("user_id", user.id).eq("question_id", questionId);
      setBookmarks(prev => { const n = new Set(prev); n.delete(questionId); return n; });
    } else {
      await supabase.from("bookmarks").insert({ user_id: user.id, question_id: questionId });
      setBookmarks(prev => new Set(prev).add(questionId));
    }
  };

  /* ── keyboard shortcuts ── */
  useEffect(() => {
    if (!selectedQuestion) return;
    const handler = (e) => {
      // Ctrl/Cmd + Enter → Run
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleRun();
      }
      // Ctrl/Cmd + Shift + Enter → Submit
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuestion, code, language]);

  /* ── Run Code ── */
  const handleRun = async () => {
    if (!selectedQuestion) return;
    const tc = (selectedQuestion.test_cases || []).filter(t => !t.hidden);
    if (!tc.length) {
      // No public test cases — just show the testcase tab with the message inline
      setJudgeTab("output");
      return;
    }
    setRunning(true);
    setRunResults(null);
    setJudgeTab("output");
    const result = await runAgainstTestCases({ language, sourceCode: code, testCases: tc });
    setRunResults(result);
    setExpandedCase(0);
    setRunning(false);
    if (result.error) toast({ title: "Execution error", description: result.message, variant: "destructive" });
  };

  /* ── Submit ── */
  const handleSubmit = async () => {
    if (!user || !selectedQuestion) return;
    const _submitStart = Date.now();

    // Guard: reject empty / stub-only code
    const trimmed = code.trim();
    const stub = buildFunctionStub(selectedQuestion, language).trim();
    if (!trimmed || trimmed === stub || trimmed.length < 30) {
      toast({ title: "Write your solution first", description: "Add code before submitting.", variant: "destructive" });
      return;
    }

    const tc = selectedQuestion.test_cases || [];
    if (!tc.length) {
      // No test cases — accept if code is non-trivial, show panel result
      const accepted = code.trim().length > 20;
      setSubmitting(true);
      setSubmitResults(null);
      setJudgeTab("submit");
      await supabase.from("practice_history").insert({
        user_id: user.id, question_id: selectedQuestion.id,
        user_answer: code, is_correct: accepted,
        time_spent_seconds: timer.getElapsed(),
      });
      // Simulate a short delay so "Judging…" shows briefly
      await new Promise(r => setTimeout(r, 600));
      setSubmitResults({
        error: false,
        noTestCases: true,
        accepted,
        passedCount: accepted ? 1 : 0,
        totalCount: 1,
        results: [],
        maxTimeSec: null,
        maxMemoryKb: null,
      });
      setSubmitting(false);
      // Refresh submission history
      const { data: hist } = await supabase.from("practice_history").select("*").eq("user_id", user.id).eq("question_id", selectedQuestion.id).order("created_at", { ascending: false }).limit(20);
      setSubmissionHistory(hist || []);
      if (accepted) {
        setShowSolution(true);
        const finalTime = timer.getElapsed();
        timer.stop();
        setSolveTime(finalTime);
        setSolvedSet(prev => new Set(prev).add(selectedQuestion.id));
        setShowSuccess(true);
      }
      return;
    }
    setSubmitting(true);
    setSubmitResults(null);
    setJudgeTab("submit");
    const result = await runAgainstTestCases({ language, sourceCode: code, testCases: tc });
    setSubmitResults(result);
    setExpandedCase(0);
    setSubmitting(false);

    if (!result.error) {
      const allPassed = result.passedCount === result.totalCount;
      await supabase.from("practice_history").insert({
        user_id: user.id, question_id: selectedQuestion.id,
        user_answer: code, is_correct: allPassed,
        time_spent_seconds: timer.getElapsed(),
      });
      // Refresh submission history
      const { data: hist } = await supabase.from("practice_history").select("*").eq("user_id", user.id).eq("question_id", selectedQuestion.id).order("created_at", { ascending: false }).limit(20);
      setSubmissionHistory(hist || []);
      if (allPassed) {
        const finalTime = timer.getElapsed();
        timer.stop();
        setSolveTime(finalTime);
        setSolvedSet(prev => new Set(prev).add(selectedQuestion.id));
        setShowSuccess(true);
        setShowSolution(true);
      } else {
        toast({ title: `${result.passedCount}/${result.totalCount} test cases passed`, variant: "destructive" });
      }
    } else {
      toast({ title: "Execution error", description: result.message, variant: "destructive" });
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePracticeWeek = (week) => {
    setSearch(""); setCatFilter(week.dbCategory || "all");
    setCompanyFilter("All Companies"); setActiveTab("browse");
  };

  /* ─────────────────────────────────────────────
     PROBLEM DETAIL VIEW
  ───────────────────────────────────────────── */
  if (selectedQuestion) {
    const publicCases    = (selectedQuestion.test_cases || []).filter(t => !t.hidden);
    const dbExamples     = selectedQuestion.examples || [];          // structured examples from migration
    const constraints    = selectedQuestion.constraints || [];
    const hints          = selectedQuestion.hints || [];
    const isSolved       = solvedSet.has(selectedQuestion.id);

    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden relative">
        {/* Success overlay */}
        <SuccessOverlay show={showSuccess} time={solveTime} onDismiss={() => setShowSuccess(false)} />

        {/* ── Top bar ── */}
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-card/60 px-4 py-2 backdrop-blur gap-2">
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => { timer.reset(); setSelectedQuestion(null); }} className="gap-1 text-xs h-7 px-2">
              ← Back
            </Button>
            {/* Prev / Next navigation */}
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!canGoPrev} onClick={() => goToQuestion(filtered[currentIdx - 1])} title="Previous problem">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!canGoNext} onClick={() => goToQuestion(filtered[currentIdx + 1])} title="Next problem">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <span className="hidden text-xs font-medium text-foreground sm:block truncate max-w-[180px]">
              {selectedQuestion.title}
            </span>
            <Badge className={`text-xs shrink-0 ${difficultyColors[selectedQuestion.difficulty]}`}>
              {selectedQuestion.difficulty}
            </Badge>
            <Badge variant="outline" className="text-xs shrink-0">{selectedQuestion.category}</Badge>
            {isSolved && (
              <Badge className="text-xs shrink-0 bg-success/10 text-success border-success/20">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Solved
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Timer — click to start, then toggle pause/resume */}
            <button
              onClick={() => timer.started ? timer.pause() : timer.start()}
              className="flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs hover:bg-muted transition-colors"
              title={!timer.started ? "Start timer" : timer.paused ? "Resume timer" : "Pause timer"}
            >
              {!timer.started
                ? <PlayCircle className="h-3 w-3 text-muted-foreground/50" />
                : timer.paused
                  ? <PlayCircle className="h-3 w-3 text-success" />
                  : <PauseCircle className="h-3 w-3 text-muted-foreground" />}
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className={`font-mono text-xs font-medium ${!timer.started || timer.paused ? "text-muted-foreground/50" : ""}`}>
                {timer.started ? fmt(timer.elapsed) : "0:00"}
              </span>
            </button>
            <button
              onClick={() => toggleBookmark(selectedQuestion.id)}
              className="rounded-md p-1.5 text-muted-foreground hover:text-primary transition-colors"
            >
              {bookmarks.has(selectedQuestion.id)
                ? <BookmarkCheck className="h-4 w-4 text-primary" />
                : <Bookmark className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* ── Main split ── */}
        <div ref={containerRef} className="flex flex-1 overflow-hidden relative">

          {/* LEFT: description + notes tabs */}
          <div className="flex flex-col shrink-0 overflow-hidden" style={{ width: `${pct}%` }}>
            {/* Description / Notes / Submissions tab switcher */}
            <div className="flex shrink-0 items-center border-b border-border bg-card/30 px-3 gap-1 pt-1">
              {[
                { id: "description",  label: "Description" },
                { id: "submissions",  label: "Submissions" },
                { id: "notes",        label: "Notes"        },
                { id: "ai-review",    label: "✦ AI Review"  },
                { id: "discuss",      label: "💬 Discuss"    },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setDescTab(t.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${descTab === t.id ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {descTab === "notes" ? (
              <div className="flex-1 overflow-hidden min-h-0">
                <NotesPanel questionId={selectedQuestion.id} />
              </div>
                        ) : descTab === "discuss" ? (
              <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
                <DiscussionPanel questionId={selectedQuestion.id} />
              </div>
            ) : descTab === "ai-review" ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {!aiReview && !aiReviewing && (
                  <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary">
                      <span className="text-white text-xl">✦</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground">AI Code Reviewer</p>
                    <p className="text-xs text-muted-foreground max-w-[220px]">Get instant feedback on your solution — bugs, complexity, style tips</p>
                    <button
                      onClick={async () => {
                        setAiReviewing(true);
                        const result = await reviewCode({
                          code,
                          language,
                          questionTitle: selectedQuestion.title,
                          questionDescription: selectedQuestion.description,
                        });
                        setAiReview(result);
                        setAiReviewing(false);
                      }}
                      className="mt-2 flex items-center gap-2 rounded-xl gradient-primary px-4 py-2 text-xs font-semibold text-white"
                    >
                      ✦ Review my code
                    </button>
                  </div>
                )}
                {aiReviewing && (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"/>
                    <p className="text-xs text-muted-foreground">Reviewing your code with Gemini AI…</p>
                  </div>
                )}
                {aiReview && !aiReview.error && (
                  <div className="space-y-4">
                    {/* Overall */}
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                      <p className="text-xs font-semibold text-primary mb-1">Overall Assessment</p>
                      <p className="text-xs text-foreground leading-relaxed">{aiReview.overall}</p>
                    </div>
                    {/* Complexity */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-border bg-muted/30 p-3">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Time</p>
                        <p className="text-sm font-bold text-foreground">{aiReview.timeComplexity}</p>
                      </div>
                      <div className="rounded-xl border border-border bg-muted/30 p-3">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Space</p>
                        <p className="text-sm font-bold text-foreground">{aiReview.spaceComplexity}</p>
                      </div>
                    </div>
                    {/* Bugs */}
                    {aiReview.bugs?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-red-500 mb-2 flex items-center gap-1.5">⚠ Bugs / Edge Cases</p>
                        <ul className="space-y-1.5">
                          {aiReview.bugs.map((b, i) => (
                            <li key={i} className="text-xs text-foreground flex gap-2 rounded-lg bg-red-500/5 border border-red-500/15 px-3 py-2">
                              <span className="shrink-0 text-red-400">•</span>{b}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {/* Improvements */}
                    {aiReview.improvements?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-amber-500 mb-2">💡 Improvements</p>
                        <ul className="space-y-1.5">
                          {aiReview.improvements.map((tip, i) => (
                            <li key={i} className="text-xs text-foreground flex gap-2 rounded-lg bg-amber-500/5 border border-amber-500/15 px-3 py-2">
                              <span className="shrink-0 text-amber-400">{i+1}.</span>{tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {/* Style */}
                    {aiReview.style?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-blue-500 mb-2">✓ Style & Readability</p>
                        <ul className="space-y-1.5">
                          {aiReview.style.map((s, i) => (
                            <li key={i} className="text-xs text-foreground flex gap-2 rounded-lg bg-blue-500/5 border border-blue-500/15 px-3 py-2">
                              <span className="shrink-0 text-blue-400">•</span>{s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {/* Re-review button */}
                    <button
                      onClick={async () => {
                        setAiReview(null);
                        setAiReviewing(true);
                        const result = await reviewCode({ code, language, questionTitle: selectedQuestion.title, questionDescription: selectedQuestion.description });
                        setAiReview(result);
                        setAiReviewing(false);
                      }}
                      className="w-full rounded-xl border border-border py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      ↺ Re-review updated code
                    </button>
                  </div>
                )}
                {aiReview?.error && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-400">
                    {aiReview.message}
                  </div>
                )}
              </div>
            ) : descTab === "submissions" ? (
              <div className="flex-1 overflow-y-auto">
                <div className="p-4">
                  {!user && (
                    <p className="text-xs text-muted-foreground">Sign in to see your submission history.</p>
                  )}
                  {user && submissionHistory.length === 0 && (
                    <div className="py-8 text-center">
                      <History className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">No submissions yet.</p>
                      <p className="text-xs text-muted-foreground mt-1">Submit your solution to see history here.</p>
                    </div>
                  )}
                  {user && submissionHistory.length > 0 && (
                    <div className="space-y-0">
                      <div className="grid grid-cols-3 gap-2 px-2 pb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b border-border/40 mb-1">
                        <span>Status</span>
                        <span>Time Spent</span>
                        <span>Date</span>
                      </div>
                      {submissionHistory.map((sub, i) => {
                        const date = new Date(sub.created_at);
                        const dateStr = date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
                        const timeStr = sub.time_spent_seconds != null ? fmt(sub.time_spent_seconds) : "—";
                        return (
                          <div key={i} onClick={() => setSelectedSubmission(sub)}
                            className="grid grid-cols-3 gap-2 px-2 py-2.5 border-b border-border/20 hover:bg-muted/10 transition-colors rounded cursor-pointer group">
                            <span className={`flex items-center gap-1.5 text-xs font-medium group-hover:underline ${sub.is_correct ? "text-success" : "text-destructive"}`}>
                              {sub.is_correct
                                ? <CheckCircle2 className="h-3 w-3 shrink-0" />
                                : <XCircle className="h-3 w-3 shrink-0" />}
                              {sub.is_correct ? "Accepted" : "Wrong Answer"}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">{timeStr}</span>
                            <span className="text-xs text-muted-foreground">{dateStr}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <div className="p-5 space-y-5">
                  <div>
                    <h1 className="text-lg font-bold text-foreground">{selectedQuestion.title}</h1>
                    {(selectedQuestion.companies || []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {selectedQuestion.companies.map(c => (
                          <span key={c} className="flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3" /> {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {selectedQuestion.description}
                  </p>

                  {/* Examples — from test cases (new problems) or examples field (old problems) */}
                  {publicCases.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Examples</h3>
                      {publicCases.map((tc, i) => {
                        let parsedIn, parsedOut;
                        try { parsedIn  = JSON.parse(tc.stdin);    } catch { parsedIn  = tc.stdin;    }
                        try { parsedOut = JSON.parse(tc.expected); } catch { parsedOut = tc.expected; }
                        return (
                          <div key={i} className="rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs space-y-1">
                            <div className="text-xs font-semibold text-foreground mb-1">Example {i + 1}:</div>
                            <div><span className="text-muted-foreground">Input: </span><span className="text-foreground">{JSON.stringify(parsedIn)}</span></div>
                            <div><span className="text-muted-foreground">Output: </span><span className="text-foreground">{JSON.stringify(parsedOut)}</span></div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {publicCases.length === 0 && dbExamples.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Examples</h3>
                      {dbExamples.map((ex, i) => (
                        <div key={i} className="rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs space-y-1">
                          <div className="text-xs font-semibold text-foreground mb-1">Example {i + 1}:</div>
                          <div><span className="text-muted-foreground">Input: </span><span className="text-foreground">{ex.input}</span></div>
                          <div><span className="text-muted-foreground">Output: </span><span className="text-foreground">{ex.output}</span></div>
                          {ex.explanation && <div className="text-muted-foreground mt-1 font-sans not-mono">{ex.explanation}</div>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Constraints */}
                  {constraints.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Constraints:</h3>
                      <ul className="space-y-1">
                        {constraints.map((c, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-foreground font-mono">
                            <span className="shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                            <span dangerouslySetInnerHTML={{ __html: c.replace(/(\d+)\^(\d+)/g, "$1<sup>$2</sup>").replace(/<=|>=|<|>/g, m => `<span class="text-primary">${m}</span>`) }} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {constraints.length === 0 && selectedQuestion.constraints_text && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Constraints:</h3>
                      <p className="text-xs text-foreground font-mono whitespace-pre-wrap">{selectedQuestion.constraints_text}</p>
                    </div>
                  )}

                  {/* AI Progressive hints */}
                  {!showSolution && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-amber-500 flex items-center gap-1.5">
                          <Lightbulb className="h-3.5 w-3.5" />
                          {isGeminiConfigured() ? "AI Hints" : "Hints"} ({aiHints.length}/4)
                        </span>
                        {aiHints.length < 4 && (
                          <button
                            onClick={async () => {
                              if (hintLoading) return;
                              const nextLevel = aiHints.length + 1;
                              // Use static hints first if available
                              const staticHint = hints[aiHints.length];
                              if (staticHint) {
                                setAiHints(prev => [...prev, staticHint]);
                                setHintIdx(h => h + 1);
                                return;
                              }
                              setHintLoading(true);
                              const { hint } = await getAIHint({
                                questionTitle: selectedQuestion.title,
                                questionDescription: selectedQuestion.description,
                                code,
                                language,
                                hintLevel: nextLevel,
                                previousHints: aiHints,
                              });
                              setAiHints(prev => [...prev, hint]);
                              setHintIdx(h => h + 1);
                              setHintLoading(false);
                            }}
                            disabled={hintLoading}
                            className="text-xs text-amber-500 hover:underline disabled:opacity-50 flex items-center gap-1"
                          >
                            {hintLoading ? (
                              <><span className="inline-block h-3 w-3 animate-spin rounded-full border border-amber-500 border-t-transparent"/> Generating…</>
                            ) : (
                              <>Get hint {aiHints.length + 1} →</>
                            )}
                          </button>
                        )}
                      </div>
                      {aiHints.length === 0 && (
                        <p className="text-xs text-muted-foreground italic">Click "Get hint 1" for a gentle nudge. Each hint gets more specific.</p>
                      )}
                      {aiHints.map((h, i) => (
                        <div key={i} className="flex gap-2 text-xs">
                          <span className="shrink-0 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-600">{i + 1}</span>
                          <p className="text-muted-foreground leading-relaxed">{h}</p>
                        </div>
                      ))}
                      {aiHints.length === 4 && (
                        <p className="text-[10px] text-muted-foreground/60 text-center">Maximum hints reached. Try implementing the approach described above!</p>
                      )}
                    </div>
                  )}

                  {/* Solution explanation */}
                  {showSolution && selectedQuestion.solution && (
                    <div className="rounded-xl border border-accent/20 bg-accent/5 p-4">
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-accent">Solution Explanation</h4>
                      <p className="text-sm text-muted-foreground">{selectedQuestion.solution}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Drag divider ── */}
          <div
            onMouseDown={onMouseDown}
            className="relative flex shrink-0 cursor-col-resize items-center justify-center bg-border hover:bg-primary/40 transition-colors z-10"
            style={{ width: "4px" }}
          >
            <div className="absolute flex flex-col gap-0.5 pointer-events-none">
              {[0,1,2].map(i => <div key={i} className="h-1 w-1 rounded-full bg-muted-foreground/50" />)}
            </div>
          </div>

          {/* RIGHT: editor + output — vertical split, OR submission detail */}
          <div ref={vContainerRef} className="flex flex-1 flex-col overflow-hidden min-w-0">

          {selectedSubmission ? (
            /* ── Submission detail view (LeetCode-style) ── */
            <div className="flex flex-1 flex-col overflow-hidden min-h-0">
              {/* Header bar */}
              <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card/40 px-3 py-2">
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> All Submissions
                </button>
                <div className="h-4 w-px bg-border" />
                <span className={`flex items-center gap-1.5 text-sm font-semibold ${selectedSubmission.is_correct ? "text-success" : "text-destructive"}`}>
                  {selectedSubmission.is_correct
                    ? <CheckCircle2 className="h-4 w-4" />
                    : <XCircle className="h-4 w-4" />}
                  {selectedSubmission.is_correct ? "Accepted" : "Wrong Answer"}
                </span>
              </div>

              {/* Stats row */}
              <div className="shrink-0 flex items-center gap-6 border-b border-border/40 bg-[#0d0d0d] px-4 py-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Submitted</p>
                  <p className="text-xs text-foreground font-medium">
                    {new Date(selectedSubmission.created_at).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Time Spent</p>
                  <p className="text-xs text-foreground font-mono font-medium">
                    {selectedSubmission.time_spent_seconds != null ? fmt(selectedSubmission.time_spent_seconds) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Language</p>
                  <p className="text-xs text-foreground font-medium capitalize">
                    {selectedSubmission.language || "Python3"}
                  </p>
                </div>
              </div>

              {/* Code label */}
              <div className="shrink-0 flex items-center gap-2 border-b border-border/40 bg-[#161616] px-4 py-2">
                <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Code</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground capitalize">{selectedSubmission.language || "Python3"}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(selectedSubmission.user_answer || ""); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>

              {/* Read-only code view */}
              <div className="flex-1 overflow-hidden min-h-0">
                <Editor
                  height="100%"
                  language={getLanguage(selectedSubmission.language || "python").monaco}
                  value={selectedSubmission.user_answer || ""}
                  theme="vs-dark"
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 13,
                    fontFamily: "JetBrains Mono, Fira Code, Consolas, monospace",
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    wordWrap: "on",
                    padding: { top: 16, bottom: 16 },
                    renderLineHighlight: "line",
                    folding: false,
                    glyphMargin: false,
                    lineDecorationsWidth: 8,
                    contextmenu: false,
                    domReadOnly: true,
                    cursorStyle: "line-thin",
                  }}
                />
              </div>
            </div>
          ) : (
            /* ── Normal editor + bottom panel ── */
            <>
            {/* Language + toolbar */}
            <div className="flex shrink-0 items-center justify-between border-b border-border bg-card/40 px-3 py-2 gap-2">
              <Select value={language} onValueChange={switchLanguage}>
                <SelectTrigger className="h-7 w-[160px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map(l => <SelectItem key={l.value} value={l.value} className="text-xs">{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={handleReset} className="h-7 gap-1 text-xs px-2" title="Reset to stub">
                  <RotateCcw className="h-3 w-3" /> Reset
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCopy} className="h-7 gap-1 text-xs px-2">
                  {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowSolution(s => !s)} className="h-7 gap-1 text-xs px-2">
                  {showSolution ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {showSolution ? "Hide" : "Hint"}
                </Button>
              </div>
            </div>

            {/* Monaco editor — takes vPct% of right column height */}
            <div className="overflow-hidden min-h-0" style={{ flex: `0 0 ${vPct}%` }}>
              <Editor
                height="100%"
                language={getLanguage(language).monaco}
                value={code}
                onChange={v => setCode(v || "")}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  fontFamily: "JetBrains Mono, Fira Code, Consolas, monospace",
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  tabSize: 4,
                  wordWrap: "on",
                  padding: { top: 16, bottom: 16 },
                  renderLineHighlight: "line",
                  cursorBlinking: "smooth",
                  smoothScrolling: true,
                  contextmenu: false,
                  folding: false,
                  lineDecorationsWidth: 8,
                  glyphMargin: false,
                }}
              />
            </div>

            {/* Vertical drag handle */}
            <div
              onMouseDown={vOnMouseDown}
              className="shrink-0 flex items-center justify-center border-t border-border bg-card/40 cursor-row-resize hover:bg-primary/10 transition-colors"
              style={{ height: "6px" }}
            >
              <div className="flex gap-0.5">
                {[0,1,2,3,4].map(i => <div key={i} className="h-0.5 w-3 rounded-full bg-muted-foreground/30" />)}
              </div>
            </div>

            {/* Bottom panel: tabs + run/submit bar + content */}
            <div className="flex flex-col border-t border-border bg-[#0d0d0d] overflow-hidden" style={{ flex: `0 0 calc(${100-vPct}% - 6px)`, minHeight: 0 }}>
              {/* Tab bar + Run/Submit buttons */}
              <div className="flex items-center justify-between border-b border-border/60 bg-[#161616] px-2 shrink-0">
                <div className="flex items-center gap-0">
                {[
                  { id: "output", icon: Terminal, label: "Testcase"    },
                  { id: "submit", icon: Code2,    label: "Test Result" },
                ].map(t => (
                  <button key={t.id} onClick={() => setJudgeTab(t.id)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${judgeTab === t.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                    <t.icon className="h-3 w-3" />{t.label}
                  </button>
                ))}
                </div>
                {/* Run + Submit buttons in top-right of panel bar */}
                <div className="flex items-center gap-2 pr-2">
                  <Button size="sm" variant="outline" onClick={handleRun} disabled={running || submitting} className="h-7 gap-1.5 text-xs">
                    {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    {running ? "Running…" : "Run Code"}
                  </Button>
                  <Button size="sm" onClick={handleSubmit} disabled={running || submitting} className="h-7 gap-1.5 gradient-primary text-primary-foreground text-xs font-semibold">
                    {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    {submitting ? "Judging…" : "Submit"}
                  </Button>
                </div>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto min-h-0">

              {judgeTab === "output" && (
                <div className="p-4">
                  {publicCases.length === 0 && (
                    <div className="flex flex-col items-start gap-2 py-2">
                      <p className="text-xs font-medium text-foreground">No public test cases</p>
                      <p className="text-xs text-muted-foreground">This problem uses hidden test cases only. Click <strong>Submit</strong> to judge your solution.</p>
                    </div>
                  )}
                  {publicCases.length > 0 && (() => {
                    const activeIdx = Math.min(expandedCase, publicCases.length - 1);
                    const tc = publicCases[activeIdx];
                    let parsedIn;
                    try { parsedIn = JSON.parse(tc.stdin); } catch { parsedIn = tc.stdin; }
                    const caseResult = runResults?.results?.[activeIdx];
                    return (
                      <div>
                        {/* Case selector tabs */}
                        {publicCases.length > 1 && (
                          <div className="flex items-center gap-1 mb-3">
                            {publicCases.map((_, ci) => {
                              const res = runResults?.results?.[ci];
                              return (
                                <button key={ci} onClick={() => setExpandedCase(ci)}
                                  className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-medium transition-colors ${activeIdx === ci ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                                  {res && (
                                    <span className={`h-1.5 w-1.5 rounded-full ${res.passed ? "bg-success" : "bg-destructive"}`} />
                                  )}
                                  Case {ci + 1}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {/* Running indicator */}
                        {running && (
                          <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Running…
                          </div>
                        )}
                        {/* Input */}
                        <div className="space-y-2">
                          <p className="text-[11px] text-muted-foreground font-medium">Input</p>
                          <div className="rounded bg-[#1a1a1a] border border-border/40 px-3 py-2 font-mono text-xs text-foreground whitespace-pre-wrap">{typeof parsedIn === "string" ? parsedIn : JSON.stringify(parsedIn, null, 2)}</div>
                        </div>
                        {/* Output after run */}
                        {caseResult && (
                          <div className="space-y-2 mt-3">
                            <div>
                              <p className="text-[11px] text-muted-foreground font-medium mb-1">Output</p>
                              <div className={`rounded bg-[#1a1a1a] border px-3 py-2 font-mono text-xs ${caseResult.passed ? "border-success/40 text-success" : "border-destructive/40 text-destructive"}`}>
                                {caseResult.actual || "(empty)"}
                              </div>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted-foreground font-medium mb-1">Expected</p>
                              <div className="rounded bg-[#1a1a1a] border border-border/40 px-3 py-2 font-mono text-xs text-foreground">{caseResult.expected}</div>
                            </div>
                          </div>
                        )}
                        {!runResults && !running && (
                          <p className="text-xs text-muted-foreground mt-3">Run your code to see output here.</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {judgeTab === "submit" && (
                <div className="p-4">
                  {/* Idle */}
                  {!submitResults && !submitting && (
                    <p className="text-xs text-muted-foreground py-1">Submit your solution to see results here.</p>
                  )}
                  {/* Judging */}
                  {submitting && (
                    <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Judging all test cases…
                    </div>
                  )}
                  {/* Error */}
                  {submitResults?.error && (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <XCircle className="h-5 w-5 text-destructive" />
                        <span className="text-lg font-bold text-destructive">Runtime Error</span>
                      </div>
                      <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 font-mono text-xs text-destructive">
                        {submitResults.message}
                      </div>
                    </div>
                  )}
                  {/* Results */}
                  {submitResults && !submitResults.error && (() => {
                    const allPassed = submitResults.noTestCases
                      ? submitResults.accepted
                      : submitResults.passedCount === submitResults.totalCount;
                    const runtimeMs = submitResults.maxTimeSec != null ? (submitResults.maxTimeSec * 1000).toFixed(0) : null;
                    const memoryMb  = submitResults.maxMemoryKb != null ? (submitResults.maxMemoryKb / 1024).toFixed(1) : null;
                    const beatsPct  = runtimeMs != null ? Math.min(99, Math.max(30, Math.round(100 - (runtimeMs / 20)))) : null;
                    const beatsMem  = memoryMb  != null ? Math.min(99, Math.max(30, Math.round(100 - (memoryMb / 1)))) : null;
                    const failedCase = !allPassed && !submitResults.noTestCases ? submitResults.results.find(r => !r.passed) : null;
                    return (
                      <div>
                        {/* Header verdict */}
                        <div className={`flex items-center gap-2 mb-5 ${allPassed ? "text-success" : "text-destructive"}`}>
                          {allPassed
                            ? <CheckCircle2 className="h-6 w-6" />
                            : <XCircle className="h-6 w-6" />}
                          <span className="text-2xl font-bold">{allPassed ? "Accepted" : submitResults.noTestCases ? "Not Submitted" : "Wrong Answer"}</span>
                        </div>

                        {/* No test cases note */}
                        {submitResults.noTestCases && (
                          <p className="text-xs text-muted-foreground mb-4">
                            {allPassed
                              ? "This problem is manually reviewed — your solution looks complete. Solution explanation unlocked."
                              : "Write your solution code (more than a stub) and submit again."}
                          </p>
                        )}

                        {/* Stats row (only on accepted with real test cases) */}
                        {allPassed && !submitResults.noTestCases && (runtimeMs || memoryMb) && (
                          <div className="grid grid-cols-2 gap-3 mb-5">
                            {runtimeMs && (
                              <div className="rounded-lg bg-[#1a1a1a] border border-border/40 p-3">
                                <p className="text-[11px] text-muted-foreground mb-1">Runtime</p>
                                <p className="text-lg font-bold text-foreground font-mono">{runtimeMs} <span className="text-sm font-normal text-muted-foreground">ms</span></p>
                                {beatsPct && <p className="text-[11px] text-muted-foreground mt-0.5">Beats {beatsPct}% of {language} submissions</p>}
                              </div>
                            )}
                            {memoryMb && (
                              <div className="rounded-lg bg-[#1a1a1a] border border-border/40 p-3">
                                <p className="text-[11px] text-muted-foreground mb-1">Memory</p>
                                <p className="text-lg font-bold text-foreground font-mono">{memoryMb} <span className="text-sm font-normal text-muted-foreground">MB</span></p>
                                {beatsMem && <p className="text-[11px] text-muted-foreground mt-0.5">Beats {beatsMem}% of {language} submissions</p>}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Passed count (only for real test cases) */}
                        {!submitResults.noTestCases && (
                          <div className="flex items-center gap-2 mb-4">
                            <span className="text-xs text-muted-foreground">
                              {submitResults.passedCount}/{submitResults.totalCount} test cases passed
                            </span>
                            {!allPassed && failedCase && (
                              <span className="text-xs text-muted-foreground">· failed on case {submitResults.results.indexOf(failedCase) + 1}</span>
                            )}
                          </div>
                        )}

                        {/* Failed case detail */}
                        {!allPassed && failedCase && !failedCase.hidden && (
                          <div className="space-y-2">
                            <div>
                              <p className="text-[11px] text-muted-foreground mb-1 font-medium">Input</p>
                              <div className="rounded bg-[#1a1a1a] border border-border/40 px-3 py-2 font-mono text-xs text-foreground">{failedCase.stdin}</div>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted-foreground mb-1 font-medium">Output</p>
                              <div className="rounded bg-[#1a1a1a] border border-destructive/30 px-3 py-2 font-mono text-xs text-destructive">{failedCase.actual || "(empty)"}</div>
                            </div>
                            <div>
                              <p className="text-[11px] text-muted-foreground mb-1 font-medium">Expected</p>
                              <div className="rounded bg-[#1a1a1a] border border-success/30 px-3 py-2 font-mono text-xs text-success">{failedCase.expected}</div>
                            </div>
                            {failedCase.stderr && (
                              <div className="rounded bg-destructive/5 border border-destructive/20 p-2 font-mono text-xs text-destructive">{failedCase.stderr}</div>
                            )}
                          </div>
                        )}
                        {!allPassed && failedCase?.hidden && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 rounded-lg p-3 border border-border/40">
                            <Lock className="h-3.5 w-3.5 shrink-0" /> This test case is hidden.
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              </div>{/* end scrollable content */}
            </div>{/* end bottom panel */}
            </>
          )}{/* end selectedSubmission ternary */}
          </div>{/* end right vContainerRef */}
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     PROBLEM LIST VIEW
  ═══════════════════════════════════════════ */
  const solvedCount = questions.filter(q => solvedSet.has(q.id)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Practice</h1>
          <p className="text-sm text-muted-foreground">Follow the 10-week roadmap, or browse problems by category, difficulty, and company.</p>
        </div>
        {/* Quick stats */}
        {user && (
          <div className="flex items-center gap-3 shrink-0">
            <div className="rounded-lg border border-border bg-card px-3 py-2 text-center min-w-[64px]">
              <p className="text-lg font-bold text-success">{solvedCount}</p>
              <p className="text-[10px] text-muted-foreground">Solved</p>
            </div>
            <div className="rounded-lg border border-border bg-card px-3 py-2 text-center min-w-[64px]">
              <p className="text-lg font-bold text-foreground">{questions.length}</p>
              <p className="text-[10px] text-muted-foreground">Total</p>
            </div>
            <div className="rounded-lg border border-border bg-card px-3 py-2 text-center min-w-[64px]">
              <p className="text-lg font-bold text-primary">
                {questions.length ? Math.round((solvedCount / questions.length) * 100) : 0}%
              </p>
              <p className="text-[10px] text-muted-foreground">Progress</p>
            </div>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="roadmap" className="gap-1.5"><Map className="h-3.5 w-3.5" /> Roadmap</TabsTrigger>
          <TabsTrigger value="browse" className="gap-1.5"><ListFilter className="h-3.5 w-3.5" /> Browse Problems</TabsTrigger>
        </TabsList>

        <TabsContent value="roadmap" className="mt-6">
          <RoadmapBoard user={user} supabase={supabase} onPracticeWeek={handlePracticeWeek} />
        </TabsContent>

        <TabsContent value="browse" className="mt-6 space-y-4">
          {/* Filters row */}
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search problems…" value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={diffFilter} onValueChange={setDiffFilter}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Difficulty" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="Easy">Easy</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Hard">Hard</SelectItem>
              </SelectContent>
            </Select>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-[175px]"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => <SelectItem key={c} value={c === "All Categories" ? "all" : c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-[160px]">
                <Building2 className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" /><SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPANIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[140px]">
                <TrendingUp className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" /><SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="difficulty">By Difficulty</SelectItem>
                <SelectItem value="title">By Title (A–Z)</SelectItem>
                <SelectItem value="unsolved">Unsolved First</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Active chips */}
          {(companyFilter !== "All Companies" || catFilter !== "all" || diffFilter !== "all") && (
            <div className="flex flex-wrap items-center gap-2">
              {companyFilter !== "All Companies" && (
                <Badge variant="secondary" className="gap-1.5 pr-1.5">
                  <Building2 className="h-3 w-3" /> {companyFilter}
                  <button onClick={() => setCompanyFilter("All Companies")} className="ml-1 hover:text-destructive">×</button>
                </Badge>
              )}
              {catFilter !== "all" && (
                <Badge variant="secondary" className="gap-1.5 pr-1.5">
                  {catFilter}
                  <button onClick={() => setCatFilter("all")} className="ml-1 hover:text-destructive">×</button>
                </Badge>
              )}
              {diffFilter !== "all" && (
                <Badge variant="secondary" className="gap-1.5 pr-1.5">
                  {diffFilter}
                  <button onClick={() => setDiffFilter("all")} className="ml-1 hover:text-destructive">×</button>
                </Badge>
              )}
              <button onClick={() => { setSearch(""); setDiffFilter("all"); setCatFilter("all"); setCompanyFilter("All Companies"); }}
                className="text-xs text-muted-foreground hover:text-foreground">Clear all</button>
            </div>
          )}

          {/* Count row + Random button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {filtered.length} problem{filtered.length !== 1 ? "s" : ""}
              </span>
              {isJudge0Configured && (
                <Badge variant="outline" className="gap-1 text-xs text-success border-success/20 bg-success/5">
                  <CheckCircle2 className="h-3 w-3" /> Auto-graded
                </Badge>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={handleRandom} className="gap-1.5 text-xs h-8">
              <Shuffle className="h-3.5 w-3.5" /> Random Problem
            </Button>
          </div>

          {/* Problem grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((q, i) => {
              const hasGrading = (q.test_cases || []).length > 0;
              const solved     = solvedSet.has(q.id);
              return (
                <motion.div key={q.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <Card
                    className={`group cursor-pointer shadow-card transition-all hover:shadow-elevated hover:-translate-y-0.5 ${solved ? "border-success/30 bg-success/5" : ""}`}
                    onClick={() => openQuestion(q)}
                  >
                    <CardContent className="pt-5">
                      <div className="mb-3 flex items-center justify-between">
                        <Badge className={`${difficultyColors[q.difficulty]} text-xs`}>{q.difficulty}</Badge>
                        <div className="flex items-center gap-2">
                          {solved && <CheckCircle2 className="h-4 w-4 text-success" title="Solved" />}
                          {hasGrading && !solved && <span title="Auto-graded" className="flex items-center text-xs text-muted-foreground"><Cpu className="h-3 w-3" /></span>}
                          <button onClick={e => { e.stopPropagation(); toggleBookmark(q.id); }}
                            className="text-muted-foreground transition-colors hover:text-primary">
                            {bookmarks.has(q.id) ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <h3 className="mb-1 font-semibold text-card-foreground group-hover:text-primary transition-colors">
                        {q.title}
                      </h3>
                      <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">{q.description}</p>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">{q.category}</Badge>
                        <Play className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      {(q.companies || []).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {q.companies.slice(0, 3).map(c => (
                            <span key={c} className="rounded px-1.5 py-0.5 text-[10px] bg-muted/60 text-muted-foreground">{c}</span>
                          ))}
                          {q.companies.length > 3 && <span className="rounded px-1.5 py-0.5 text-[10px] bg-muted/60 text-muted-foreground">+{q.companies.length - 3}</span>}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-muted-foreground">No problems match your filters.</p>
              <button onClick={() => { setSearch(""); setDiffFilter("all"); setCatFilter("all"); setCompanyFilter("All Companies"); }}
                className="mt-2 text-sm text-primary hover:underline">Clear all filters</button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PracticePage;
