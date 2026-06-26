import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSupabase } from "@/hooks/use-supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Send, Bot, User, RotateCcw, Mic, ArrowRight, Sparkles, Brain } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { scoreInterviewAnswer, isGeminiConfigured } from "@/lib/gemini";

const QUESTIONS = {
  Arrays: [
    "Explain how you would find the maximum subarray sum. What algorithm would you use and why?",
    "How would you merge two sorted arrays efficiently? Walk me through your approach and complexity.",
    "What's the most efficient way to find duplicates in an array? Discuss the trade-offs between approaches.",
    "How would you find all pairs in an array that sum to a target value?",
  ],
  Trees: [
    "Explain the difference between BFS and DFS. When would you use each in practice?",
    "How would you check if a binary tree is balanced? What's the time and space complexity?",
    "Describe how to find the lowest common ancestor of two nodes in a BST.",
    "How would you serialize and deserialize a binary tree? Walk through your approach.",
  ],
  Graphs: [
    "How would you detect a cycle in a directed graph? Explain your algorithm.",
    "Describe Dijkstra's algorithm, its time complexity, and when it breaks down.",
    "How would you find the shortest path in an unweighted graph? Walk through the steps.",
    "Explain topological sorting and give a real-world use case.",
  ],
  "Dynamic Programming": [
    "Explain overlapping subproblems with a concrete example from your experience.",
    "How would you solve the 0/1 knapsack problem? Walk through your DP table.",
    "Describe the difference between top-down memoization and bottom-up tabulation. Which do you prefer?",
    "How would you find the longest common subsequence of two strings? What's the complexity?",
  ],
  "System Design": [
    "How would you design a URL shortening service like bit.ly? Walk through your architecture.",
    "How would you design a rate limiter? What data structures and strategies would you use?",
    "Describe how you'd design a notification system that can send millions of messages per day.",
    "How would you design a cache system? Discuss eviction policies and trade-offs.",
  ],
  Behavioral: [
    "Tell me about a time you disagreed with a teammate on a technical decision. What happened?",
    "Describe the most challenging bug you've ever debugged. How did you approach it?",
    "Tell me about a time you had to learn a new technology quickly under pressure.",
    "Describe a project you're most proud of. What was your specific contribution and impact?",
  ],
};

const CATEGORIES = Object.keys(QUESTIONS);

const scoreColor = (s) => s >= 80 ? "text-emerald-500" : s >= 60 ? "text-amber-500" : "text-red-400";
const scoreBg    = (s) => s >= 80 ? "bg-emerald-500/10 border-emerald-500/20" : s >= 60 ? "bg-amber-500/10 border-amber-500/20" : "bg-red-400/10 border-red-400/20";

const InterviewPage = () => {
  const { user } = useAuth();
  const supabase = useSupabase();
  const [category, setCategory]       = useState("Arrays");
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState("");
  const [questionIdx, setQuestionIdx] = useState(0);
  const [scores, setScores]           = useState([]);
  const [isStarted, setIsStarted]     = useState(false);
  const [isFinished, setIsFinished]   = useState(false);
  const [isTyping, setIsTyping]       = useState(false);
  const [usingAI, setUsingAI]         = useState(isGeminiConfigured());
  const messagesEndRef = useRef(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const qs = QUESTIONS[category];

  const startInterview = () => {
    setMessages([{
      role: "ai",
      content: `Welcome to your **${category}** mock interview! I'll ask ${qs.length} questions and give you ${usingAI ? "AI-powered" : "instant"} feedback after each answer.\n\n**Question 1 of ${qs.length}:** ${qs[0]}`,
    }]);
    setQuestionIdx(0); setScores([]); setIsStarted(true); setIsFinished(false);
  };

  const handleSend = async () => {
    if (!input.trim() || isFinished || isTyping) return;
    const answer = input.trim();
    setMessages(prev => [...prev, { role: "user", content: answer }]);
    setInput("");
    setIsTyping(true);

    const { score, feedback } = await scoreInterviewAnswer({ question: qs[questionIdx], answer, category });
    const newScores = [...scores, score];
    setScores(newScores);
    const nextIdx = questionIdx + 1;
    const isLast  = nextIdx >= qs.length;

    let aiResponse;
    if (isLast) {
      const avg = Math.round(newScores.reduce((a, b) => a + b, 0) / newScores.length);
      aiResponse = `**Feedback on your last answer:** ${feedback} **(${score}/100)**\n\n---\n\n🎉 **Interview Complete!**\n\nYour overall score: **${avg}/100** across ${qs.length} questions.\n\n${
        avg >= 80 ? "Outstanding performance — you're well prepared for technical interviews!" :
        avg >= 60 ? "Good effort! Work on going deeper into complexity analysis and edge cases." :
        "Keep practicing — focus on explaining your reasoning step-by-step. Consistency is everything."
      }`;
      setIsFinished(true);
      if (user) {
        await supabase.from("interview_sessions").insert({
          user_id: user.id, score: avg, total_questions: qs.length,
          feedback: `${category} — ${avg}%`,
        });
      }
    } else {
      aiResponse = `**Feedback:** ${feedback} **(${score}/100)**\n\n**Question ${nextIdx + 1} of ${qs.length}:** ${qs[nextIdx]}`;
      setQuestionIdx(nextIdx);
    }

    setMessages(prev => [...prev, { role: "ai", content: aiResponse }]);
    setIsTyping(false);
  };

  if (!isStarted) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 pb-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">AI Mock Interview</h1>
          <p className="text-muted-foreground text-sm mt-1">Practice technical interview questions with instant AI feedback on every answer</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="shadow-card overflow-hidden">
            <div className="h-1.5 w-full gradient-primary"/>
            <CardContent className="space-y-6 pt-8 pb-8">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary shadow-elevated">
                  <MessageSquare className="h-8 w-8 text-white"/>
                </div>
                <div>
                  <h2 className="text-xl font-bold">Ready to practice?</h2>
                  <p className="text-sm text-muted-foreground mt-1">Select a topic and get {isGeminiConfigured() ? "AI-powered" : "instant"} feedback on every answer</p>
                </div>
              </div>

              {isGeminiConfigured() && (
                <div className="flex items-center justify-center gap-2 rounded-xl bg-primary/5 border border-primary/15 px-4 py-2.5 max-w-xs mx-auto">
                  <Brain className="h-4 w-4 text-primary shrink-0"/>
                  <p className="text-xs text-primary font-medium">Gemini AI scoring enabled — real feedback on your answers</p>
                </div>
              )}

              <div className="space-y-3 max-w-xs mx-auto w-full">
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button onClick={startInterview} className="w-full h-11 gradient-primary text-white font-semibold rounded-xl shadow-sm gap-2">
                  <Sparkles className="h-4 w-4"/> Start Interview
                </Button>
              </div>

              {/* Topic preview */}
              <div className="max-w-xs mx-auto w-full">
                <p className="text-xs text-muted-foreground font-medium mb-2 text-center">Sample questions for {category}</p>
                <ul className="space-y-1.5">
                  {QUESTIONS[category].slice(0, 2).map((q, i) => (
                    <li key={i} className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 leading-relaxed">
                      {q}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <Link to="/voice-interview">
            <Card className="cursor-pointer shadow-card card-hover">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl gradient-accent">
                  <Mic className="h-5 w-5 text-white"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold flex items-center gap-2 text-sm">
                    Try Voice Interview
                    <Badge className="gradient-primary border-0 text-white text-[10px]">New</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">Speak your answers and get AI-scored on delivery, clarity & depth</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground"/>
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      </div>
    );
  }

  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const progress = Math.round((questionIdx / qs.length) * 100);

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold">Mock Interview</h1>
          <Badge variant="outline" className="text-xs">{category}</Badge>
          {isGeminiConfigured() && <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] gap-1"><Brain className="h-2.5 w-2.5"/>AI</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {scores.length > 0 && <span className={`text-xs font-mono font-semibold ${scoreColor(avg)}`}>{avg}/100</span>}
          <Button variant="outline" size="sm" onClick={startInterview} className="gap-1.5 rounded-xl h-8 text-xs">
            <RotateCcw className="h-3.5 w-3.5"/> Restart
          </Button>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Question {Math.min(questionIdx + 1, qs.length)} of {qs.length}</span>
          <span>{progress}% complete</span>
        </div>
        <Progress value={progress} className="h-1.5"/>
      </div>

      {/* Score row */}
      {scores.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {scores.map((s, i) => (
            <div key={i} className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold ${scoreBg(s)} ${scoreColor(s)}`}>
              Q{i + 1}: {s}/100
            </div>
          ))}
        </div>
      )}

      {/* Chat */}
      <Card className="shadow-card">
        <CardContent className="p-4">
          <div className="max-h-[52vh] min-h-[200px] space-y-4 overflow-y-auto pr-2">
            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${msg.role === "ai" ? "gradient-primary" : "bg-secondary"}`}>
                    {msg.role === "ai" ? <Bot className="h-4 w-4 text-white"/> : <User className="h-4 w-4 text-secondary-foreground"/>}
                  </div>
                  <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "ai" ? "bg-muted text-foreground" : "gradient-primary text-white"
                  }`}>{msg.content}</div>
                </motion.div>
              ))}
              {isTyping && (
                <motion.div key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full gradient-primary">
                    <Bot className="h-4 w-4 text-white"/>
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}/>
                    ))}
                    {isGeminiConfigured() && <span className="text-xs text-muted-foreground ml-1">AI scoring…</span>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef}/>
          </div>
        </CardContent>
      </Card>

      {/* Input */}
      {!isFinished && (
        <div className="flex gap-2 items-end">
          <Textarea value={input} onChange={e => setInput(e.target.value)}
            placeholder="Type your answer… (Shift+Enter for new line)"
            className="min-h-[80px] resize-none rounded-xl text-sm flex-1"
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            disabled={isTyping}/>
          <Button onClick={handleSend} size="icon" disabled={!input.trim() || isTyping}
            className="h-10 w-10 gradient-primary text-white rounded-xl shrink-0 shadow-sm self-end">
            <Send className="h-4 w-4"/>
          </Button>
        </div>
      )}
      {isFinished && (
        <div className="flex justify-center pt-2">
          <Button onClick={startInterview} className="gradient-primary text-white gap-2 rounded-xl">
            <RotateCcw className="h-4 w-4"/> Start New Interview
          </Button>
        </div>
      )}
    </div>
  );
};

export default InterviewPage;
