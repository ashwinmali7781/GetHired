export const isSpeechSynthesisSupported =
  typeof window !== "undefined" && "speechSynthesis" in window;

/**
 * Speaks text aloud using the browser's built-in Text-to-Speech engine.
 * Calls onEnd when speech finishes (or immediately if unsupported), so
 * callers can chain "speak question -> then listen for answer".
 */
export function speak(text, { onEnd, rate = 1, pitch = 1 } = {}) {
  if (!isSpeechSynthesisSupported) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel(); // stop anything already queued/speaking
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.lang = "en-US";
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utterance);
}

export function cancelSpeech() {
  if (isSpeechSynthesisSupported) window.speechSynthesis.cancel();
}
