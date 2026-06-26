import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  FileUp, FileText, Sparkles, AlertTriangle, CheckCircle2, XCircle,
  Loader2, RotateCcw, Lightbulb, FolderGit2, Mail, Phone, Link2,
  History, TrendingUp, Clock, KeyRound,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from "recharts";
import { extractTextFromPdf } from "@/lib/pdf-extract";
import { analyzeResume } from "@/lib/resume-analyzer";
import { getAIResumeSuggestions, isGeminiConfigured } from "@/lib/gemini";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useSupabase } from "@/hooks/use-supabase";

const BAR_COLORS = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#06b6d4","#f43f5e"];
const scoreColor = (s) => s >= 80 ? "#10b981" : s >= 60 ? "#f59e0b" : "#ef4444";
const scoreLabel = (s) => s >= 80 ? "Strong — ATS-ready" : s >= 60 ? "Good — a few gaps to close" : "Needs work before applying";

function AnalysisSkeleton() {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-48 rounded-2xl"/>
        <Skeleton className="h-48 rounded-2xl"/>
      </div>
      <Skeleton className="h-36 rounded-2xl"/>
      <Skeleton className="h-36 rounded-2xl"/>
    </div>
  );
}

const ResumeAnalyzerPage = () => {
  const { toast }    = useToast();
  const { user }     = useAuth();
  const supabase     = useSupabase();
  const fileInputRef = useRef(null);

  // Past analyses history
  const [pastAnalyses, setPastAnalyses] = useState([]);
  const [showHistory, setShowHistory]   = useState(false);

  // Upload / analysis state
  const [fileName, setFileName]             = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [dragActive, setDragActive]         = useState(false);
  const [extracting, setExtracting]         = useState(false);
  const [result, setResult]                 = useState(null);
  const [resumeText, setResumeText]         = useState("");

  // AI tips state — typed as { resumeTips, projectTips, summary } | null
  const [aiTips, setAiTips]     = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Load history on mount
  useEffect(() => {
    if (!user || !supabase) return;
    supabase
      .from("resume_analyses")
      .select("id, file_name, ats_score, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setPastAnalyses(data || []));
  }, [user, supabase]);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast({ title: "PDF only", description: "Please upload a .pdf resume.", variant: "destructive" });
      return;
    }
    setFileName(file.name);
    setExtracting(true);
    setResult(null);
    setAiTips(null);

    try {
      const text = await extractTextFromPdf(file);
      if (!text || text.length < 30) {
        toast({
          title: "Couldn't read PDF",
          description: "May be a scanned image. Try exporting as PDF from Word or Google Docs.",
          variant: "destructive",
        });
        return;
      }

      setResumeText(text);
      const analysis = analyzeResume(text, jobDescription);
      setResult(analysis);

      // Persist to Supabase history (non-blocking)
      if (user && supabase) {
        supabase
          .from("resume_analyses")
          .insert({
            user_id:          user.id,
            file_name:        file.name,
            ats_score:        analysis.atsScore,
            sections_present: analysis.sectionsPresent ?? [],
            missing_keywords: (analysis.missingKeywords ?? []).slice(0, 8),
            improvements:     (analysis.resumeImprovements ?? []).slice(0, 5),
          })
          .select("id, file_name, ats_score, created_at")
          .single()
          .then(({ data, error }) => {
            if (!error && data) {
              setPastAnalyses((prev) => [data, ...prev].slice(0, 10));
            }
          });
      }
    } catch (err) {
      console.error("[ResumeAnalyzer] extraction failed:", err);
      toast({
        title: "Parse error",
        description: err?.message || "Something went wrong — try another file.",
        variant: "destructive",
      });
    } finally {
      setExtracting(false);
    }
  }, [jobDescription, toast, user, supabase]);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
    handleFile(e.dataTransfer.files?.[0]);
  }, [handleFile]);

  const reset = useCallback(() => {
    setResult(null);
    setFileName("");
    setResumeText("");
    setAiTips(null);
    setJobDescription("");
  }, []);

  const fetchAI = async () => {
    if (!resumeText) return;
    setAiLoading(true);
    try {
      const tips = await getAIResumeSuggestions({ resumeText, jobDescription });
      if (tips.error) {
        toast({ title: "AI unavailable", description: tips.message, variant: "destructive" });
      } else {
        setAiTips(tips);
      }
    } catch {
      toast({ title: "AI unavailable", description: "Check your Gemini API key.", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const score       = result?.atsScore ?? 0;
  const radialData  = [{ name: "Score", value: score, fill: scoreColor(score) }];

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Resume Analyzer</h1>
          <p className="text-muted-foreground text-sm mt-1">Get your ATS score, keyword gaps, and AI-powered improvement tips</p>
        </div>
        {pastAnalyses.length > 0 && (
          <Button variant="outline" size="sm" className="gap-2 rounded-xl h-9 text-xs shrink-0"
            onClick={() => setShowHistory((v) => !v)}>
            <History className="h-3.5 w-3.5"/>
            History ({pastAnalyses.length})
          </Button>
        )}
      </motion.div>

      {/* ── History panel ── */}
      <AnimatePresence>
        {showHistory && pastAnalyses.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary"/> Past Analyses
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pastAnalyses.map((a, i) => (
                  <div key={a.id ?? i}
                    className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{a.file_name || "Resume"}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Clock className="h-3 w-3 text-muted-foreground"/>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(a.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-lg font-black"
                        style={{ color: scoreColor(a.ats_score) }}>
                        {a.ats_score}
                      </span>
                      <span className="text-xs text-muted-foreground">/100</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Upload form (shown when no result yet) ── */}
      {!result && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }} className="space-y-4">

          {/* Job description */}
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary"/> Job Description
                <Badge variant="secondary" className="text-[10px]">Optional but recommended</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job description here to get keyword matching and tailored suggestions…"
                className="min-h-[100px] text-sm resize-none"
                disabled={extracting}
              />
            </CardContent>
          </Card>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            onClick={() => !extracting && fileInputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-200 ${
              dragActive
                ? "border-primary/60 bg-primary/5 scale-[1.01]"
                : "border-border hover:border-primary/40 hover:bg-muted/30"
            } ${extracting ? "pointer-events-none opacity-60" : ""}`}
          >
            <div className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-all ${dragActive ? "gradient-primary" : "bg-muted"}`}>
              {extracting
                ? <Loader2 className="h-7 w-7 animate-spin text-primary"/>
                : <FileUp className={`h-7 w-7 ${dragActive ? "text-white" : "text-muted-foreground"}`}/>
              }
            </div>
            {extracting ? (
              <div>
                <p className="text-sm font-semibold text-foreground">Parsing {fileName}…</p>
                <p className="text-xs text-muted-foreground mt-1">Extracting text from your PDF</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {dragActive ? "Drop your resume here" : "Drop your resume PDF here"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse — PDF only</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
        </motion.div>
      )}

      {/* ── Results ── */}
      <AnimatePresence>
        {result && (
          <motion.div key="results" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} className="space-y-5">

            {/* Score + Contact row */}
            <div className="grid gap-4 sm:grid-cols-2">

              {/* Radial ATS score */}
              <Card className="shadow-card">
                <CardContent className="p-5 flex flex-col items-center gap-3">
                  <div className="relative" style={{ width: 160, height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RadialBarChart innerRadius={50} outerRadius={70} data={radialData}
                        startAngle={90} endAngle={-270}>
                        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false}/>
                        <RadialBar background={{ fill: "hsl(var(--muted))" }}
                          dataKey="value" angleAxisId={0} cornerRadius={8}/>
                      </RadialBarChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-black" style={{ color: scoreColor(score) }}>{score}</span>
                      <span className="text-[10px] text-muted-foreground font-medium">/ 100</span>
                    </div>
                  </div>
                  <div className="text-center">
                    <Badge className="text-xs px-3 py-1"
                      style={{ background: scoreColor(score) + "20", color: scoreColor(score), border: `1px solid ${scoreColor(score)}40` }}>
                      {scoreLabel(score)}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-2">ATS Compatibility Score</p>
                  </div>
                </CardContent>
              </Card>

              {/* Contact detection */}
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Detected Contact Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { icon: Mail,       label: "Email",    found: !!result.hasEmail },
                    { icon: Phone,      label: "Phone",    found: !!result.hasPhone },
                    { icon: Link2,      label: "LinkedIn", found: !!result.hasLink  },
                    { icon: FolderGit2, label: "GitHub",   found: !!result.hasLink  },
                  ].map((f) => (
                    <div key={f.label}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs ${
                        f.found ? "bg-emerald-500/5 border border-emerald-500/15" : "bg-muted/40"
                      }`}>
                      {f.found
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0"/>
                        : <XCircle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0"/>
                      }
                      <f.icon className={`h-3.5 w-3.5 shrink-0 ${f.found ? "text-foreground" : "text-muted-foreground/40"}`}/>
                      <span className={f.found ? "text-foreground font-medium" : "text-muted-foreground"}>{f.label}</span>
                      {f.found && <span className="ml-auto text-emerald-600 dark:text-emerald-400 font-medium">Detected</span>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Section scores bar chart */}
            {result.categoryScores?.length > 0 && (
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Section Scores</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart
                      data={result.categoryScores.map(({ name, score: s }) => ({ name, score: s }))}
                      margin={{ top: 0, right: 0, left: -16, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}/>
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false}/>
                      <Tooltip
                        formatter={(v) => [`${v}/100`, "Score"]}
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                      />
                      <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={48}>
                        {result.categoryScores.map((_, i) => (
                          <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]}/>
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Keywords */}
            {(result.matchedKeywordCount > 0 || result.missingKeywords?.length > 0) && (
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-primary"/> Keywords
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.matchedKeywordCount > 0 && (
                    <div className="flex items-center gap-2 rounded-xl bg-emerald-500/5 border border-emerald-500/15 px-3 py-2.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0"/>
                      <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        {result.matchedKeywordCount} of {result.totalKeywordCount} keywords matched
                      </span>
                    </div>
                  )}
                  {result.missingKeywords?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5"/> Missing keywords ({result.missingKeywords.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {result.missingKeywords.map((k) => (
                          <Badge key={k} variant="outline"
                            className="text-xs border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400">
                            {k}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Improvement suggestions */}
            {result.resumeImprovements?.length > 0 && (
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-amber-500"/> Improvement Suggestions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2.5">
                    {result.resumeImprovements.map((tip, i) => (
                      <li key={i} className="flex gap-2.5 text-sm text-foreground">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-[10px] font-bold text-amber-600">
                          {i + 1}
                        </span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* AI-powered insights (Gemini) */}
            <Card className="shadow-card border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary"/> AI-Powered Insights
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">Gemini</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!isGeminiConfigured() && (
                  <p className="text-xs text-muted-foreground">
                    Add <code className="bg-muted px-1 rounded">VITE_GEMINI_API_KEY</code> to your <code className="bg-muted px-1 rounded">.env</code> to enable AI suggestions.
                  </p>
                )}
                {isGeminiConfigured() && !aiTips && !aiLoading && (
                  <Button onClick={fetchAI} size="sm" className="gradient-primary text-white gap-1.5">
                    <Sparkles className="h-3.5 w-3.5"/> Generate AI Analysis
                  </Button>
                )}
                {aiLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary"/> Analyzing with Gemini…
                  </div>
                )}
                {aiTips && !aiTips.error && (
                  <div className="space-y-4">
                    {aiTips.summary && (
                      <p className="text-sm text-foreground leading-relaxed border-l-2 border-primary/40 pl-3 italic">
                        {aiTips.summary}
                      </p>
                    )}
                    {aiTips.resumeTips?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Resume Tips</p>
                        <ul className="space-y-2">
                          {aiTips.resumeTips.map((t, i) => (
                            <li key={i} className="flex gap-2 text-sm text-foreground">
                              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-primary"/>
                              {t}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {aiTips.projectTips?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Project & Experience Bullets</p>
                        <ul className="space-y-2">
                          {aiTips.projectTips.map((t, i) => (
                            <li key={i} className="flex gap-2 text-sm text-foreground">
                              <Lightbulb className="h-4 w-4 shrink-0 mt-0.5 text-amber-500"/>
                              {t}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <Button onClick={fetchAI} variant="outline" size="sm" className="gap-1.5 text-xs">
                      <RotateCcw className="h-3 w-3"/> Regenerate
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Analyze another */}
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={reset} className="gap-2 rounded-xl">
                <RotateCcw className="h-4 w-4"/> Analyze Another Resume
              </Button>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ResumeAnalyzerPage;
