import { useEffect, useRef, useState, useCallback } from "react";

const SpeechRecognitionImpl =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export const isSpeechRecognitionSupported = Boolean(SpeechRecognitionImpl);

/**
 * Wraps the browser's Web Speech API (SpeechRecognition) for live
 * microphone-to-text transcription. Transcript persists across multiple
 * start()/stop() cycles (e.g. if the browser auto-stops on a silence
 * timeout) — call reset() explicitly when starting a brand new answer.
 */
export function useSpeechRecognition() {
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef("");

  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!SpeechRecognitionImpl) return;

    const recognition = new SpeechRecognitionImpl();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += text + " ";
        } else {
          interim += text;
        }
      }
      setTranscript(finalTranscriptRef.current.trim());
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      // "no-speech" / "aborted" fire often and aren't real failures worth surfacing
      if (event.error !== "no-speech" && event.error !== "aborted") {
        setError(event.error);
      }
      setListening(false);
    };

    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.stop();
      } catch {
        // already stopped — ignore
      }
    };
  }, []);

  const start = useCallback(() => {
    if (!recognitionRef.current || listening) return;
    setError(null);
    setInterimTranscript("");
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch (err) {
      setError(err.message);
    }
  }, [listening]);

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      // ignore
    }
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    finalTranscriptRef.current = "";
    setTranscript("");
    setInterimTranscript("");
  }, []);

  return {
    supported: isSpeechRecognitionSupported,
    listening,
    transcript,
    interimTranscript,
    error,
    start,
    stop,
    reset,
  };
}
