const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export const isGeminiConfigured = () => Boolean(GEMINI_API_KEY);

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse((fenced ? fenced[1] : text).trim());
}

const clampScore = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

/**
 * Sends the full interview transcript (question + transcribed answer for
 * each turn) to Gemini once at the end of the interview, and asks for a
 * single structured score breakdown. One request per interview keeps this
 * comfortably inside Gemini's free tier instead of scoring per-answer.
 */
export async function evaluateVoiceInterview({ category, qa }) {
  if (!isGeminiConfigured()) {
    return {
      error: true,
      message: "AI scoring is unavailable — set VITE_GEMINI_API_KEY in your .env file to enable it.",
    };
  }

  const transcript = qa
    .map((item, i) => `Q${i + 1}: ${item.question}\nCandidate's spoken answer: ${item.answer?.trim() || "(no answer given)"}`)
    .join("\n\n");

  const prompt = `You are a senior technical interviewer evaluating a candidate's mock interview for a ${category} software engineering interview. The candidate's answers below were transcribed live from speech, so expect some natural speech patterns and minor transcription quirks.

Interview transcript:

${transcript}

Score the candidate's overall performance across the WHOLE interview, each from 0-100:
- technicalScore: correctness and depth of technical knowledge shown
- communicationScore: how clearly and effectively they explained their thinking
- confidenceScore: how decisive and assured the answers sound (infer from wording/hedging/completeness, not audio tone)
- grammarScore: grammatical correctness and fluency of the spoken answers as transcribed

Also write a 3-5 sentence "overallFeedback" with specific, actionable advice referencing the actual answers.

Respond with ONLY valid JSON in exactly this shape, no markdown fences, no extra text:
{"technicalScore": number, "communicationScore": number, "confidenceScore": number, "grammarScore": number, "overallFeedback": string}`;

  try {
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
      }),
    });

    if (!res.ok) {
      console.error("Gemini API error:", res.status, await res.text().catch(() => ""));
      return { error: true, message: "AI scoring failed — please try again." };
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { error: true, message: "AI scoring returned an empty result." };

    const parsed = extractJson(text);

    return {
      error: false,
      technicalScore: clampScore(parsed.technicalScore),
      communicationScore: clampScore(parsed.communicationScore),
      confidenceScore: clampScore(parsed.confidenceScore),
      grammarScore: clampScore(parsed.grammarScore),
      overallFeedback: String(parsed.overallFeedback || "").slice(0, 2000),
    };
  } catch (err) {
    console.error("Gemini evaluation failed:", err);
    return { error: true, message: "AI scoring unavailable — check your network connection." };
  }
}

/**
 * Optional AI layer on top of the local heuristic resume analysis. The ATS
 * score itself stays deterministic/local (instant, free, no API needed) —
 * this just adds a few personalized, human-written-sounding suggestions
 * when a free-tier Gemini key is available. Degrades gracefully without one.
 */
export async function getAIResumeSuggestions({ resumeText, jobDescription }) {
  if (!isGeminiConfigured()) {
    return { error: true, message: "Set VITE_GEMINI_API_KEY in your .env file to enable AI-enhanced suggestions (free tier)." };
  }

  const truncated = resumeText.slice(0, 6000);
  const jdBlock = jobDescription?.trim()
    ? `\n\nTarget job description:\n${jobDescription.trim().slice(0, 2000)}`
    : "";

  const prompt = `You are an expert resume reviewer and ATS specialist. Review this resume${jobDescription?.trim() ? " against the target job description" : ""}.

Resume text:
${truncated}${jdBlock}

Respond with ONLY valid JSON in exactly this shape, no markdown fences, no extra text:
{"resumeTips": [string, string, string], "projectTips": [string, string, string], "summary": string}

- resumeTips: 3 specific, actionable improvements for the resume overall (reference actual content, not generic advice)
- projectTips: 3 specific suggestions to make the projects/experience bullets stronger
- summary: one encouraging 2-sentence overall take`;

  try {
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.5, responseMimeType: "application/json" },
      }),
    });

    if (!res.ok) {
      console.error("Gemini API error:", res.status, await res.text().catch(() => ""));
      return { error: true, message: "AI-enhanced suggestions failed — please try again." };
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { error: true, message: "AI-enhanced suggestions returned an empty result." };

    const parsed = extractJson(text);
    return {
      error: false,
      resumeTips: Array.isArray(parsed.resumeTips) ? parsed.resumeTips.slice(0, 5) : [],
      projectTips: Array.isArray(parsed.projectTips) ? parsed.projectTips.slice(0, 5) : [],
      summary: String(parsed.summary || "").slice(0, 600),
    };
  } catch (err) {
    console.error("Gemini resume suggestions failed:", err);
    return { error: true, message: "AI-enhanced suggestions unavailable — check your network connection." };
  }
}

/**
 * Score a single interview answer with Gemini.
 * Returns { score, feedback } — falls back to word-count heuristic if no key.
 */
export async function scoreInterviewAnswer({ question, answer, category }) {
  // Heuristic fallback (no API key)
  const wordCount = answer.trim().split(/\s+/).length;
  const heuristic = () => {
    if (wordCount < 10)  return { score: 30, feedback: "Too brief. Explain your approach, time complexity, and edge cases." };
    if (wordCount < 30)  return { score: 55, feedback: "Decent start. Add time/space complexity and consider edge cases." };
    if (wordCount < 60)  return { score: 75, feedback: "Good answer! Discuss trade-offs and name specific data structures." };
    return { score: 90, feedback: "Excellent depth and clarity. Strong interview response." };
  };

  if (!isGeminiConfigured()) return heuristic();

  const prompt = `You are a senior software engineer conducting a technical interview. Score this candidate answer.

Category: ${category}
Question: ${question}
Candidate's answer: ${answer.trim() || "(no answer given)"}

Score from 0-100 and give 1-2 sentences of specific, actionable feedback referencing their actual answer.
Respond with ONLY valid JSON: {"score": number, "feedback": string}`;

  try {
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) return heuristic();
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return heuristic();
    const parsed = extractJson(text);
    return {
      score: clampScore(parsed.score),
      feedback: String(parsed.feedback || "").slice(0, 400),
    };
  } catch {
    return heuristic();
  }
}

/**
 * AI Code Reviewer — reviews the user's solution for a specific problem.
 * Returns structured feedback: bugs, improvements, complexity, style.
 */
export async function reviewCode({ code, language, questionTitle, questionDescription }) {
  const heuristic = () => ({
    error: false,
    overall: "Add your VITE_GEMINI_API_KEY to get AI-powered code reviews.",
    timeComplexity: "—",
    spaceComplexity: "—",
    bugs: [],
    improvements: ["Enable Gemini AI to get personalized feedback on your code."],
    style: [],
  });

  if (!isGeminiConfigured()) return heuristic();
  if (!code || code.trim().length < 20) return {
    error: true, message: "Write some code first before requesting a review."
  };

  const prompt = `You are a senior software engineer doing a thorough code review. The candidate solved the following problem:

Problem: ${questionTitle}
${questionDescription ? `Description: ${questionDescription.slice(0, 500)}` : ""}

Their ${language} solution:
\`\`\`${language}
${code.slice(0, 3000)}
\`\`\`

Review their code and respond with ONLY valid JSON in exactly this shape, no markdown fences:
{
  "overall": "2-3 sentence overall assessment",
  "timeComplexity": "O(...) with brief explanation",
  "spaceComplexity": "O(...) with brief explanation",
  "bugs": ["specific bug or edge case issue if any — empty array if none"],
  "improvements": ["specific actionable improvement 1", "improvement 2", "improvement 3"],
  "style": ["code style or readability suggestion if any — empty array if none"]
}

Be specific and reference the actual code. If the solution is correct and efficient, say so clearly.`;

  try {
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) return { error: true, message: "AI review failed — try again." };
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { error: true, message: "Empty response from AI." };
    const parsed = extractJson(text);
    return {
      error: false,
      overall:         String(parsed.overall || "").slice(0, 600),
      timeComplexity:  String(parsed.timeComplexity || "—").slice(0, 100),
      spaceComplexity: String(parsed.spaceComplexity || "—").slice(0, 100),
      bugs:            Array.isArray(parsed.bugs)         ? parsed.bugs.slice(0, 5)         : [],
      improvements:    Array.isArray(parsed.improvements) ? parsed.improvements.slice(0, 5) : [],
      style:           Array.isArray(parsed.style)        ? parsed.style.slice(0, 3)        : [],
    };
  } catch (err) {
    console.error("[reviewCode] failed:", err);
    return { error: true, message: "AI review unavailable — check your connection." };
  }
}

/**
 * AI Progressive Hint Generator
 * Returns a single hint at the given level (1=vague, 2=approach, 3=specific, 4=near-solution)
 * Never reveals the actual code solution.
 */
export async function getAIHint({ questionTitle, questionDescription, code, language, hintLevel, previousHints = [] }) {
  const LEVEL_DESCRIPTIONS = {
    1: "a very vague conceptual nudge — just the category of algorithm or data structure to think about, nothing specific",
    2: "the high-level approach — what strategy to use, without any implementation details",
    3: "a specific implementation insight — mention a key step or condition to handle, but no code",
    4: "a near-solution hint — describe the core logic in plain English very specifically, still no actual code",
  };

  if (!isGeminiConfigured()) {
    const fallbacks = {
      1: "Think about which data structure would give you the best lookup time for this problem.",
      2: "Consider breaking the problem into smaller subproblems. What's the base case?",
      3: "Think carefully about edge cases — what happens with empty input or duplicate values?",
      4: "You're close. Focus on the order of operations and make sure you're updating state at the right time.",
    };
    return { hint: fallbacks[hintLevel] || fallbacks[1], level: hintLevel };
  }

  const previousHintsText = previousHints.length > 0
    ? `Previous hints already given (do NOT repeat these ideas):\n${previousHints.map((h, i) => `${i + 1}. ${h}`).join("\n")}\n\n`
    : "";

  const codeContext = code && code.trim().length > 30
    ? `The candidate's current code:\n\`\`\`${language}\n${code.slice(0, 1500)}\n\`\`\`\n\n`
    : "";

  const prompt = `You are a patient coding mentor giving a progressive hint for a LeetCode-style problem. Never reveal the solution code.

Problem: ${questionTitle}
${questionDescription ? `Description: ${questionDescription.slice(0, 600)}` : ""}

${previousHintsText}${codeContext}Give hint level ${hintLevel}/4: ${LEVEL_DESCRIPTIONS[hintLevel]}.

Rules:
- Maximum 2 sentences
- Do NOT write any code
- Do NOT say "the solution is..." or give away the answer
- Be Socratic — guide thinking, don't solve
- Reference their current code if provided

Respond with ONLY the hint text, no preamble, no JSON.`;

  try {
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 120 },
      }),
    });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    const hint = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!hint) throw new Error("Empty response");
    return { hint, level: hintLevel };
  } catch (err) {
    console.error("[getAIHint] failed:", err);
    return { hint: "Think about the time complexity of your current approach — is there a way to reduce it?", level: hintLevel };
  }
}
