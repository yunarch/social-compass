import { useCallback, useEffect, useRef, useState } from 'react';
import {
  analyzeAwkwardness,
  generateExcuse,
  loadLlm,
  suggestQuestion,
  translate,
  type Analysis,
  type Language,
} from '../ai/llm';
import { decodeAudio, loadStt, transcribe } from '../ai/stt';
import { speak, stopSpeaking, type SpeechKind } from '../ai/tts';

const CHUNK_MS = 5_000;
const SILENCE_RMS = 0.01;
const MIN_ANALYSIS_CHARS = 50;
const ANALYSIS_WINDOW_CHARS = 1_000;
const SUGGESTION_SCORE = 50;
const EXCUSE_SCORE = 80;

export type Status = 'idle' | 'loading' | 'listening';
export type Suggestion = { text: string; kind: SpeechKind };
export type LoadProgress = { stt: number; llm: number; text: string };
export type Translation = { language: Language; text: string };

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

function rms(samples: Float32Array) {
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}

// Whisper emits markers like "[BLANK_AUDIO]" or "(music)" for non-speech.
const cleanTranscript = (text: string) =>
  text.replace(/\[[^\]]*\]|\([^)]*\)/g, '').trim();

export function useConversationMonitor(language: Language | null) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<LoadProgress>({
    stt: 0,
    llm: 0,
    text: '',
  });
  const [transcript, setTranscript] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [translation, setTranslation] = useState<Translation | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);

  const languageRef = useRef(language);
  const sessionRef = useRef(0);
  const transcriptRef = useRef('');
  const lastSuggestionScoreRef = useRef(0);
  const hasExcuseRef = useRef(false);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const stopCaptureRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  const respondToScore = useCallback(async (score: number) => {
    const text = transcriptRef.current;
    if (score >= EXCUSE_SCORE && !hasExcuseRef.current) {
      hasExcuseRef.current = true;
      const excuse = await generateExcuse(text.slice(-200), score);
      setSuggestion({ text: excuse, kind: 'excuse' });
      speak(excuse, 'excuse');
      return;
    }
    if (
      score >= SUGGESTION_SCORE &&
      score < EXCUSE_SCORE &&
      !hasExcuseRef.current &&
      Math.abs(score - lastSuggestionScoreRef.current) > 10
    ) {
      lastSuggestionScoreRef.current = score;
      const question = await suggestQuestion(text.slice(-500), score);
      setSuggestion({ text: question, kind: 'question' });
      speak(question, 'question');
    }
  }, []);

  const processChunk = useCallback(
    async (blob: Blob, session: number) => {
      const audio = await decodeAudio(blob);
      if (rms(audio) < SILENCE_RMS) return;
      const text = cleanTranscript(await transcribe(audio));
      if (!text || session !== sessionRef.current) return;

      transcriptRef.current = `${transcriptRef.current} ${text}`.trim();
      setTranscript(transcriptRef.current);

      if (transcriptRef.current.length >= MIN_ANALYSIS_CHARS) {
        const result = await analyzeAwkwardness(
          transcriptRef.current.slice(-ANALYSIS_WINDOW_CHARS)
        );
        if (session !== sessionRef.current) return;
        setAnalysis(result);
        await respondToScore(result.score);
      }

      const target = languageRef.current;
      if (target) {
        const translated = await translate(text, target);
        setTranslation((previous) =>
          previous?.language === target
            ? { language: target, text: `${previous.text} ${translated}` }
            : { language: target, text: translated }
        );
      }
    },
    [respondToScore]
  );

  const startCapture = useCallback(
    (stream: MediaStream, session: number) => {
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
      const levels = new Uint8Array(analyser.frequencyBinCount);
      let frame = 0;
      const tick = () => {
        analyser.getByteFrequencyData(levels);
        const average =
          levels.reduce((sum, level) => sum + level, 0) / levels.length;
        setAudioLevel(Math.min(100, (average / 128) * 100));
        frame = requestAnimationFrame(tick);
      };
      tick();

      // Each segment gets its own recorder so every blob is a standalone, decodable file.
      let active = true;
      let recorder: MediaRecorder;
      let timer: ReturnType<typeof setTimeout>;
      const recordSegment = () => {
        const segment = new MediaRecorder(stream);
        const parts: Blob[] = [];
        segment.ondataavailable = (event) => parts.push(event.data);
        segment.onstop = () => {
          const blob = new Blob(parts, { type: segment.mimeType });
          queueRef.current = queueRef.current
            .then(() => processChunk(blob, session))
            .catch((processError: unknown) =>
              setError(errorMessage(processError))
            );
          if (active) recordSegment();
        };
        segment.start();
        recorder = segment;
        timer = setTimeout(() => segment.stop(), CHUNK_MS);
      };
      recordSegment();

      return () => {
        active = false;
        clearTimeout(timer);
        if (recorder.state !== 'inactive') recorder.stop();
        cancelAnimationFrame(frame);
        for (const track of stream.getTracks()) track.stop();
        void context.close();
        setAudioLevel(0);
      };
    },
    [processChunk]
  );

  const start = useCallback(async () => {
    setError(null);
    if (!('gpu' in navigator)) {
      setError(
        'WebGPU is not available. Use a recent Chrome or Edge on a device with a GPU.'
      );
      return;
    }
    setStatus('loading');
    try {
      await Promise.all([
        loadStt((stt) => setProgress((previous) => ({ ...previous, stt }))),
        loadLlm((llm, text) =>
          setProgress((previous) => ({ ...previous, llm, text }))
        ),
      ]);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const session = ++sessionRef.current;
      transcriptRef.current = '';
      lastSuggestionScoreRef.current = 0;
      hasExcuseRef.current = false;
      setTranscript('');
      setAnalysis(null);
      setSuggestion(null);
      setTranslation(null);
      stopCaptureRef.current = startCapture(stream, session);
      setStatus('listening');
    } catch (startError) {
      setError(errorMessage(startError));
      setStatus('idle');
    }
  }, [startCapture]);

  const stop = useCallback(() => {
    stopCaptureRef.current?.();
    stopCaptureRef.current = null;
    setStatus('idle');
  }, []);

  const dismissSuggestion = useCallback(() => {
    stopSpeaking();
    setSuggestion(null);
  }, []);

  useEffect(() => () => stopCaptureRef.current?.(), []);

  return {
    status,
    error,
    progress,
    transcript,
    analysis,
    suggestion,
    translation: translation?.language === language ? translation.text : '',
    audioLevel,
    start,
    stop,
    dismissSuggestion,
  };
}
