import type { SttRequest, SttResponse } from './stt.worker';

const SAMPLE_RATE = 16_000;

let worker: Worker | null = null;
let ready: Promise<void> | null = null;
let progressListener: (progress: number) => void = () => {};
let nextId = 0;
const pending = new Map<
  number,
  { resolve: (text: string) => void; reject: (error: Error) => void }
>();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./stt.worker.ts', import.meta.url), {
    type: 'module',
  });
  worker.onmessage = ({ data }: MessageEvent<SttResponse>) => {
    if (data.type === 'progress') progressListener(data.progress);
    if (
      (data.type === 'result' || data.type === 'error') &&
      data.id !== undefined
    ) {
      const request = pending.get(data.id);
      pending.delete(data.id);
      if (data.type === 'result') request?.resolve(data.text);
      else request?.reject(new Error(data.message));
    }
  };
  return worker;
}

const send = (message: SttRequest) => getWorker().postMessage(message);

export function loadStt(onProgress: (progress: number) => void) {
  progressListener = onProgress;
  ready ??= new Promise<void>((resolve, reject) => {
    const listener = ({ data }: MessageEvent<SttResponse>) => {
      if (data.type === 'ready') resolve();
      else if (data.type === 'error' && data.id === undefined)
        reject(new Error(data.message));
      else return;
      getWorker().removeEventListener('message', listener);
    };
    getWorker().addEventListener('message', listener);
    send({ type: 'load' });
  }).catch((error: unknown) => {
    ready = null;
    throw error;
  });
  return ready;
}

export function transcribe(audio: Float32Array) {
  const id = nextId++;
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    send({ type: 'transcribe', id, audio });
  });
}

let decoder: AudioContext | null = null;

/** Decodes a recorded blob into 16 kHz mono samples, the format Whisper expects. */
export async function decodeAudio(blob: Blob) {
  decoder ??= new AudioContext({ sampleRate: SAMPLE_RATE });
  const buffer = await decoder.decodeAudioData(await blob.arrayBuffer());
  return buffer.getChannelData(0);
}
