import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSupabase } from "@/hooks/use-supabase";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { speak, cancelSpeech, isSpeechSynthesisSupported } from "@/lib/speech-synthesis";
import { evaluateVoiceInterview, isGeminiConfigured } from "@/lib/gemini";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer,
} from "recharts";
import { Mic, MicOff, Volume2, Loader2, RotateCcw, AlertTriangle, Sparkles, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const QUESTION_BANK = {
  Technical: [
    "Walk me through how you would design a URL shortening service like bit.ly.",
    "What's the difference between SQL and NoSQL databases, and when would you choose one over the other?",
    "Explain how a hash table works and what makes a good hash function.",
    "What is the difference between processes and threads?",
    "How would you debug a production issue where an API endpoint suddenly became slow?",
    "Explain Big O notation and why it matters when discussing solutions in interviews.",
    "What makes a REST API well-designed?",
    "Describe the difference between synchronous and asynchronous programming.",
  ],
  Behavioral: [
    "Tell me about a time you disagreed with a teammate. How did you handle it?",
    "Describe a project you're most proud of and why.",
    "Tell me about a time you failed at something. What did you learn?",
    "How do you prioritize tasks when you have multiple deadlines?",
    "Describe a situation where you had to learn a new technology quickly.",
    "Tell me about a time you received critical feedback. How did you respond?",
    "Why do you want to work in software engineering?",
    "Where do you see yourself in five years?",
  ],
};

const QUESTIONS_PER_INTERVIEW = 5;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuestionSet(category) {
  if (category === "Mixed") {
    const tech = shuffle(QUESTION_BANK.Technical).slice(0, 3);
    const beh = shuffle(QUESTION_BANK.Behavioral).slice(0, 2);
    return shuffle([...tech, ...beh]);
  }
  return shuffle(QUESTION_BANK[category]).slice(0, QUESTIONS_PER_INTERVIEW);
}

const SCORE_FIELDS = [
  { key: "technicalScore", label: "Technical" },
  { key: "communicationScore", label: "Communication" },
  { key: "confidenceScore", label: "Confidence" },
  { key: "grammarScore", label: "Grammar" },
];

const VoiceInterviewPage = () => {
  const { user } = useAuth();
  const supabase = useSupabase();
  const { toast } = useToast();
  const recognition = useSpeechRecognition();

  const [category, setCategory] = useState("Mixed");
  const [phase, setPhase] = useState("setup"); // setup | interview | evaluating | results
  const [questions, setQuestions] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [aiState, setAiState] = useState("idle"); // speaking | idle (ready to answer)
  const [qa, setQa] = useState([]);
  const [result, setResult] = useState(null); // { technicalScore, ... } or { error, message }
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    if (!user) return;
    supabase
      .from("voice_interview_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => {
        setHistory(data || []);
        setLoadingHistory(false);
      });
  }, [user, supabase]);

  useEffect(() => cancelSpeech, []); // stop any speech if the user navigates away

  useEffect(() => {
    if (recognition.error === "not-allowed") {
      toast({
        title: "Microphone blocked",
        description: "Please allow microphone access in your browser to answer out loud.",
        variant: "destructive",
      });
    }
  }, [recognition.error]); // eslint-disable-line react-hooks/exhaustive-deps

  const askQuestion = (index, questionSet) => {
    setAiState("speaking");
    recognition.reset();
    speak(questionSet[index], {
      onEnd: () => {
        if (phaseRef.current === "interview") setAiState("idle");
      },
    });
  };

  const startInterview = () => {
    const set = buildQuestionSet(category);
    setQuestions(set);
    setQa([]);
    setQIndex(0);
    setResult(null);
    setPhase("interview");
    askQuestion(0, set);
  };

  const startAnswering = () => {
    recognition.reset();
    recognition.start();
    setAiState("listening");
  };

  const finishAnswer = async () => {
    recognition.stop();
    const answer = recognition.transcript.trim();
    const nextQa = [...qa, { question: questions[qIndex], answer }];
    setQa(nextQa);

    const nextIndex = qIndex + 1;
    if (nextIndex < questions.length) {
      setQIndex(nextIndex);
      askQuestion(nextIndex, questions);
    } else {
      setPhase("evaluating");
      const evalResult = await evaluateVoiceInterview({ category, qa: nextQa });
      setResult(evalResult);

      if (!evalResult.error && user) {
        const overall = Math.round(
          (evalResult.technicalScore + evalResult.communicationScore + evalResult.confidenceScore + evalResult.grammarScore) / 4
        );
        const { data, error } = await supabase
          .from("voice_interview_sessions")
          .insert({
            user_id: user.id,
            category,
            technical_score: evalResult.technicalScore,
            communication_score: evalResult.communicationScore,
            confidence_score: evalResult.confidenceScore,
            grammar_score: evalResult.grammarScore,
            overall_score: overall,
            feedback: evalResult.overallFeedback,
            transcript: nextQa,
          })
          .select()
          .single();
        if (!error) setHistory((prev) => [data, ...prev].slice(0, 5));
      }
      setPhase("results");
    }
  };

  const reset = () => {
    cancelSpeech();
    recognition.stop();
    setPhase("setup");
    setResult(null);
  };

  /* ───────────── SETUP ───────────── */
  if (phase === "setup") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-3xl font-bold text-foreground">AI Voice Interview</h1>
            <Badge className="gradient-primary border-0 text-primary-foreground">New</Badge>
          </div>
          <p className="text-muted-foreground">Speak your answers out loud — get scored on technical depth, communication, confidence & grammar</p>
        </div>

        {!recognition.supported && (
          <Card className="border-destructive/30 bg-destructive/5 shadow-card">
            <CardContent className="flex items-start gap-3 pt-6 text-sm">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <p className="text-card-foreground">
                Voice input isn't supported in this browser. Please use <strong>Chrome</strong> or <strong>Edge</strong> on desktop or Android.
              </p>
            </CardContent>
          </Card>
        )}

        {!isGeminiConfigured() && (
          <Card className="border-amber-500/30 bg-amber-500/5 shadow-card">
            <CardContent className="flex items-start gap-3 pt-6 text-sm">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <p className="text-card-foreground">
                AI scoring isn't configured yet — set <code className="rounded bg-muted px-1 py-0.5">VITE_GEMINI_API_KEY</code> in your <code className="rounded bg-muted px-1 py-0.5">.env</code> file. You can still practice, but won't get scored.
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-card">
          <CardContent className="space-y-6 pt-6">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl gradient-primary">
              <Mic className="h-10 w-10 text-primary-foreground" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-card-foreground">Ready to practice out loud?</h2>
              <p className="text-muted-foreground">{QUESTIONS_PER_INTERVIEW} questions · the AI will ask, you answer with your mic</p>
            </div>
            <div className="space-y-3">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mixed">Mixed (Technical + Behavioral)</SelectItem>
                  <SelectItem value="Technical">Technical</SelectItem>
                  <SelectItem value="Behavioral">Behavioral</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={startInterview}
                disabled={!recognition.supported}
                className="w-full gradient-primary text-primary-foreground"
                size="lg"
              >
                <Mic className="mr-2 h-4 w-4" /> Start Voice Interview
              </Button>
            </div>
          </CardContent>
        </Card>

        {!loadingHistory && history.length > 0 && (
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Recent Attempts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5 text-sm">
                  <div>
                    <span className="font-medium text-card-foreground">{h.category}</span>
                    <span className="ml-2 text-muted-foreground">{new Date(h.created_at).toLocaleDateString()}</span>
                  </div>
                  <Badge variant="secondary" className="font-mono">{h.overall_score}/100</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  /* ───────────── INTERVIEW (asking / listening) ───────────── */
  if (phase === "interview") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Voice Interview</h1>
            <Badge variant="outline">{category}</Badge>
          </div>
          <span className="text-sm text-muted-foreground">Question {qIndex + 1} of {questions.length}</span>
        </div>
        <Progress value={((qIndex + (aiState === "listening" ? 0.5 : 0)) / questions.length) * 100} />

        <Card className="shadow-card">
          <CardContent className="space-y-6 pt-6">
            {/* AI speaking / listening indicator */}
            <div className="flex flex-col items-center gap-3">
              <motion.div
                animate={aiState === "speaking" ? { scale: [1, 1.08, 1] } : aiState === "listening" ? { scale: [1, 1.04, 1] } : {}}
                transition={{ repeat: Infinity, duration: 1.2 }}
                className={`flex h-20 w-20 items-center justify-center rounded-full ${
                  aiState === "listening" ? "bg-red-500/15 text-red-500" : "gradient-primary text-primary-foreground"
                }`}
              >
                {aiState === "speaking" && <Volume2 className="h-9 w-9" />}
                {aiState === "listening" && <Mic className="h-9 w-9" />}
                {aiState === "idle" && <Mic className="h-9 w-9" />}
              </motion.div>
              <p className="text-sm font-medium text-muted-foreground">
                {aiState === "speaking" && (isSpeechSynthesisSupported ? "AI is asking..." : "Read the question below")}
                {aiState === "idle" && "Tap the mic when you're ready to answer"}
                {aiState === "listening" && "Listening... tap Done when finished"}
              </p>
            </div>

            <div className="rounded-xl bg-muted/50 p-4 text-center">
              <p className="text-lg font-medium text-card-foreground">{questions[qIndex]}</p>
            </div>

            {(aiState === "listening" || recognition.transcript) && (
              <div className="min-h-[60px] rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
                {recognition.transcript || recognition.interimTranscript || "Start speaking..."}
                {recognition.interimTranscript && (
                  <span className="opacity-60"> {recognition.interimTranscript}</span>
                )}
              </div>
            )}

            <div className="flex justify-center">
              {aiState === "idle" && (
                <Button onClick={startAnswering} size="lg" className="gradient-primary text-primary-foreground">
                  <Mic className="mr-2 h-4 w-4" /> Start Answering
                </Button>
              )}
              {aiState === "listening" && (
                <Button onClick={finishAnswer} size="lg" variant="destructive">
                  <MicOff className="mr-2 h-4 w-4" /> Done — Next Question
                </Button>
              )}
              {aiState === "speaking" && (
                <Button disabled size="lg" variant="outline">
                  <Volume2 className="mr-2 h-4 w-4 animate-pulse" /> Speaking...
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ───────────── EVALUATING ───────────── */
  if (phase === "evaluating") {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-4 py-24 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Analyzing your interview...</h2>
        <p className="text-sm text-muted-foreground">Scoring technical depth, communication, confidence & grammar</p>
      </div>
    );
  }

  /* ───────────── RESULTS ───────────── */
  if (phase === "results") {
    if (result?.error) {
      return (
        <div className="mx-auto max-w-xl space-y-6 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
          <h2 className="text-xl font-semibold text-foreground">Couldn't score this interview</h2>
          <p className="text-muted-foreground">{result.message}</p>
          <Button onClick={reset} className="gradient-primary text-primary-foreground">
            <RotateCcw className="mr-2 h-4 w-4" /> Try Again
          </Button>
        </div>
      );
    }

    const overall = Math.round(
      (result.technicalScore + result.communicationScore + result.confidenceScore + result.grammarScore) / 4
    );
    const radarData = SCORE_FIELDS.map((f) => ({ metric: f.label, score: result[f.key] }));

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary">
            <Sparkles className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Interview Complete!</h1>
          <p className="text-muted-foreground">Overall Score</p>
          <p className="text-5xl font-bold text-primary">{overall}<span className="text-2xl text-muted-foreground">/100</span></p>
        </div>

        <Card className="shadow-card">
          <CardContent className="pt-6">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.35} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-2 space-y-4">
              {SCORE_FIELDS.map((f) => (
                <div key={f.key}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-card-foreground">{f.label}</span>
                    <span className="text-muted-foreground">{result[f.key]}/100</span>
                  </div>
                  <Progress value={result[f.key]} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-card-foreground">{result.overallFeedback}</p>
          </CardContent>
        </Card>

        <details className="group rounded-xl border border-border">
          <summary className="flex cursor-pointer list-none items-center justify-between p-4 text-sm font-medium text-card-foreground">
            View full transcript
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-4 border-t border-border p-4">
            {qa.map((item, i) => (
              <div key={i} className="text-sm">
                <p className="font-medium text-card-foreground">Q{i + 1}: {item.question}</p>
                <p className="mt-1 text-muted-foreground">{item.answer || "(no answer given)"}</p>
              </div>
            ))}
          </div>
        </details>

        <div className="flex gap-3">
          <Button onClick={reset} className="flex-1 gradient-primary text-primary-foreground" size="lg">
            <RotateCcw className="mr-2 h-4 w-4" /> Try Again
          </Button>
          <Link to="/dashboard" className="flex-1">
            <Button variant="outline" className="w-full" size="lg">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return null;
};

export default VoiceInterviewPage;
