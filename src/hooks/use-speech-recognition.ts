"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechEventLike = Event & {
  resultIndex: number;
  results: ArrayLike<SpeechResultLike>;
};

type SpeechErrorEventLike = Event & { error: string };

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechEventLike) => void) | null;
  onerror: ((event: SpeechErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

export type SpeechCapture = {
  audio: Blob | null;
  liveTranscript: string;
};

const errorMessages: Record<string, string> = {
  "not-allowed": "Microphone access has not been granted.",
  "audio-capture": "No available microphone was found.",
  network: "The live subtitle service lost its connection.",
  "no-speech": "No speech was detected. You can still type the answer manually.",
  aborted: "Recording stopped.",
};

function normalizeLiveVocabulary(text: string) {
  return text
    .replace(/\b(?:vin|vint|vent)\s+intelligence\b/gi, "Vintelligence")
    .replace(/\bvintellig(?:ence|ience|ents)\b/gi, "Vintelligence")
    .replace(/\bintelligience\b/gi, "Vintelligence")
    .replace(/\bintelligence\s+(club|clb)\b/gi, "Vintelligence $1")
    .replace(/\bvin\s+university\b/gi, "VinUniversity")
    .replace(/\bvin\s*uni\b/gi, "VinUni")
    .replace(/\s+/g, " ")
    .trim();
}

export function useSpeechRecognition(language: string) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const finalRef = useRef("");
  const interimRef = useRef("");
  const [listening, setListening] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const getTranscript = useCallback(
    () => normalizeLiveVocabulary(`${finalRef.current} ${interimRef.current}`),
    [],
  );

  const reset = useCallback(() => {
    finalRef.current = "";
    interimRef.current = "";
    chunksRef.current = [];
    setFinalTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  const startLiveSubtitles = useCallback(() => {
    const speechWindow = window as SpeechWindow;
    const SpeechRecognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    recognition.onresult = (event) => {
      let newFinal = "";
      let newInterim = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) newFinal += `${transcript} `;
        else newInterim += transcript;
      }

      if (newFinal) {
        finalRef.current = normalizeLiveVocabulary(`${finalRef.current} ${newFinal}`);
        setFinalTranscript(finalRef.current);
      }
      interimRef.current = normalizeLiveVocabulary(newInterim);
      setInterimTranscript(interimRef.current);
    };

    recognition.onerror = (event) => {
      if (event.error !== "aborted" && event.error !== "no-speech") {
        setError(errorMessages[event.error] ?? `Live subtitle error: ${event.error}`);
      }
    };
    recognition.onend = () => undefined;
    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      // Advanced recording continues even if browser subtitles cannot start.
    }
  }, [language]);

  const start = useCallback(async () => {
    reset();
    let captured = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48_000,
        },
      });
      streamRef.current = stream;

      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ];
      const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 96_000 } : undefined);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorderRef.current = recorder;
      recorder.start(250);
      captured = true;
    } catch {
      setError("Noise-filtered recording could not start. Live subtitles or manual typing will be used instead.");
    }

    startLiveSubtitles();
    setListening(true);
    return captured;
  }, [reset, startLiveSubtitles]);

  const stop = useCallback(async (): Promise<SpeechCapture> => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // Some browsers throw after recognition has already ended.
    }
    recognitionRef.current = null;
    setListening(false);

    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      return { audio: null, liveTranscript: getTranscript() };
    }

    return new Promise((resolve) => {
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const audio = chunksRef.current.length ? new Blob(chunksRef.current, { type }) : null;
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        resolve({ audio, liveTranscript: getTranscript() });
      };
      recorder.stop();
    });
  }, [getTranscript]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const speechWindow = typeof window === "undefined" ? null : (window as SpeechWindow);
  const liveSupported = Boolean(
    speechWindow?.SpeechRecognition ?? speechWindow?.webkitSpeechRecognition,
  );
  const recordingSupported =
    typeof window !== "undefined" &&
    "mediaDevices" in navigator &&
    "MediaRecorder" in window;

  return {
    supported: liveSupported || recordingSupported,
    liveSupported,
    recordingSupported,
    listening,
    transcript: normalizeLiveVocabulary(`${finalTranscript} ${interimTranscript}`),
    error,
    start,
    stop,
    reset,
    getTranscript,
  };
}
