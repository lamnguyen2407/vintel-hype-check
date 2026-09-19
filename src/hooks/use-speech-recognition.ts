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

type SpeechErrorEventLike = Event & {
  error: string;
};

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

const errorMessages: Record<string, string> = {
  "not-allowed": "Trình duyệt chưa được cấp quyền microphone.",
  "audio-capture": "Không tìm thấy microphone khả dụng.",
  network: "Dịch vụ nhận diện giọng nói đang mất kết nối.",
  "no-speech": "Chưa nghe thấy giọng nói. Bạn vẫn có thể nhập tay.",
  aborted: "Đã dừng ghi âm.",
};

export function useSpeechRecognition(language: string) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");
  const interimRef = useRef("");
  const [listening, setListening] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    finalRef.current = "";
    interimRef.current = "";
    setFinalTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // The browser throws when stop() is called after it has already ended.
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const speechWindow = window as SpeechWindow;
    const SpeechRecognition =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Browser này chưa hỗ trợ nhận diện giọng nói. Hãy dùng Chrome hoặc nhập tay.");
      return false;
    }

    reset();
    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

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
        finalRef.current = `${finalRef.current} ${newFinal}`.replace(/\s+/g, " ").trim();
        setFinalTranscript(finalRef.current);
      }
      interimRef.current = newInterim.trim();
      setInterimTranscript(interimRef.current);
    };

    recognition.onerror = (event) => {
      if (event.error !== "aborted") {
        setError(errorMessages[event.error] ?? `Lỗi microphone: ${event.error}`);
      }
      setListening(false);
    };

    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;

    try {
      recognition.start();
      setListening(true);
      return true;
    } catch {
      setError("Không thể khởi động microphone. Hãy thử lại hoặc nhập tay.");
      setListening(false);
      return false;
    }
  }, [language, reset]);

  const getTranscript = useCallback(
    () => `${finalRef.current} ${interimRef.current}`.replace(/\s+/g, " ").trim(),
    [],
  );

  useEffect(() => {
    return () => recognitionRef.current?.abort();
  }, []);

  const speechWindow =
    typeof window === "undefined" ? null : (window as SpeechWindow);
  const supported = Boolean(
    speechWindow?.SpeechRecognition ?? speechWindow?.webkitSpeechRecognition,
  );

  return {
    supported,
    listening,
    finalTranscript,
    interimTranscript,
    transcript: `${finalTranscript} ${interimTranscript}`.replace(/\s+/g, " ").trim(),
    error,
    start,
    stop,
    reset,
    getTranscript,
  };
}
