/**
 * Generates a 2-week weak-topic recovery plan using the Gemini API (free tier).
 * Same key used elsewhere in the app (Voice Interview scoring, Resume AI tips).
 * Set VITE_GEMINI_API_KEY in your .env to enable it (free at aistudio.google.com).
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function getWeakTopicRecoveryPlan(topicScores) {
  if (!GEMINI_API_KEY) {
    return "Set VITE_GEMINI_API_KEY in your .env file (free at aistudio.google.com/app/apikey) to get a personalised 2-week recovery plan.";
  }

  const summary = topicScores
    .map((t) => `${t.title}: ${t.mastery}% mastery (${t.solved}/${t.total} milestones)`)
    .join("\n");
  const weakest = topicScores.slice(0, 2).map((t) => t.title).join(" and ");

  const prompt =
    `A coding-interview candidate is following a 10-week DSA roadmap. ` +
    `Here is their current mastery per topic, weakest first:\n\n${summary}\n\n` +
    `Their weakest areas are ${weakest}. Write a focused 2-week recovery plan ` +
    `to shore those up before moving on. Structure it as "Week 1" and "Week 2", ` +
    `each with 4-5 short bullet days naming concrete problem types/patterns to drill ` +
    `(not full LeetCode-style problem statements — just the pattern/technique and why it matters). ` +
    `End with one sentence of encouragement. Keep the whole thing under 280 words, plain text, no markdown headers.`;

  try {
    const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 512 },
      }),
    });
    if (!res.ok) {
      return "Could not generate a recovery plan — please try again in a moment.";
    }
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "Could not generate a recovery plan.";
  } catch {
    return "Recovery plan unavailable — check your network connection.";
  }
}
