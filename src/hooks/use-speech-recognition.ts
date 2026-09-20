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

type ExtendedAudioConstraints = MediaTrackConstraints & {
  voiceIsolation?: boolean;
};

type ExtendedSupportedConstraints = MediaTrackSupportedConstraints & {
  voiceIsolation?: boolean;
};

type VoiceFilter = {
  stream: MediaStream;
  close: () => void;
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
    .replace(/\bvin\s*tel\b/gi, "Vintel")
    .replace(/\bvin\s+university\b/gi, "VinUniversity")
    .replace(/\bvin\s*uni\b/gi, "VinUni")
    .replace(/\s+/g, " ")
    .trim();
}

async function createVoiceFilter(inputStream: MediaStream): Promise<VoiceFilter> {
  const context = new AudioContext({ latencyHint: "interactive", sampleRate: 48_000 });
  await context.resume();

  const source = context.createMediaStreamSource(inputStream);
  const highPass = context.createBiquadFilter();
  highPass.type = "highpass";
  highPass.frequency.value = 105;
  highPass.Q.value = 0.7;

  const lowPass = context.createBiquadFilter();
  lowPass.type = "lowpass";
  lowPass.frequency.value = 7_600;
  lowPass.Q.value = 0.7;

  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -32;
  compressor.knee.value = 18;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.006;
  compressor.release.value = 0.18;

  const analyser = context.createAnalyser();
  analyser.fftSize = 2_048;
  analyser.smoothingTimeConstant = 0.35;

  const gate = context.createGain();
  const destination = context.createMediaStreamDestination();
  source.connect(highPass).connect(lowPass).connect(compressor);
  compressor.connect(analyser);
  compressor.connect(gate).connect(destination);

  const waveform = new Float32Array(analyser.fftSize);
  const calibrationEndsAt = performance.now() + 1_800;
  let noiseTotal = 0;
  let noiseSamples = 0;
  let noiseThreshold = 0.018;
  let animationFrame = 0;

  const updateGate = () => {
    analyser.getFloatTimeDomainData(waveform);
    const rms = Math.sqrt(
      waveform.reduce((sum, sample) => sum + sample * sample, 0) / waveform.length,
    );

    if (performance.now() < calibrationEndsAt) {
      noiseTotal += rms;
      noiseSamples += 1;
      noiseThreshold = Math.min(0.075, Math.max(0.014, (noiseTotal / noiseSamples) * 1.65));
      gate.gain.setTargetAtTime(1, context.currentTime, 0.01);
    } else {
      const foregroundSpeech = rms >= noiseThreshold;
      gate.gain.setTargetAtTime(foregroundSpeech ? 1 : 0.16, context.currentTime, foregroundSpeech ? 0.008 : 0.12);
    }

    animationFrame = window.requestAnimationFrame(updateGate);
  };
  updateGate();

  return {
    stream: destination.stream,
    close: () => {
      window.cancelAnimationFrame(animationFrame);
      destination.stream.getTracks().forEach((track) => track.stop());
      source.disconnect();
      highPass.disconnect();
      lowPass.disconnect();
      compressor.disconnect();
      analyser.disconnect();
      gate.disconnect();
      void context.close();
    },
  };
}

export function useSpeechRecognition(language: string) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const voiceFilterRef = useRef<VoiceFilter | null>(null);
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
      const supported = navigator.mediaDevices.getSupportedConstraints() as ExtendedSupportedConstraints;
      const audioConstraints: ExtendedAudioConstraints = {
        echoCancellation: { ideal: true },
        noiseSuppression: { ideal: true },
        autoGainControl: { ideal: true },
        channelCount: { ideal: 1 },
        sampleRate: { ideal: 48_000 },
        sampleSize: { ideal: 16 },
      };
      if (supported.voiceIsolation) audioConstraints.voiceIsolation = true;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });
      streamRef.current = stream;

      let recordingStream = stream;
      try {
        voiceFilterRef.current = await createVoiceFilter(stream);
        recordingStream = voiceFilterRef.current.stream;
      } catch {
        // Browser-level noise suppression is still active if Web Audio processing is unavailable.
      }

      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ];
      const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(recordingStream, mimeType ? { mimeType, audioBitsPerSecond: 96_000 } : undefined);
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
      voiceFilterRef.current?.close();
      voiceFilterRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      return { audio: null, liveTranscript: getTranscript() };
    }

    return new Promise((resolve) => {
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const audio = chunksRef.current.length ? new Blob(chunksRef.current, { type }) : null;
        voiceFilterRef.current?.close();
        voiceFilterRef.current = null;
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
      voiceFilterRef.current?.close();
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
