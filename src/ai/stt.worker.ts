import { pipeline, type ProgressInfo } from '@huggingface/transformers';

const MODEL_ID = 'onnx-community/whisper-base';

export type SttRequest =
  | { type: 'load' }
  | { type: 'transcribe'; id: number; audio: Float32Array };
export type SttResponse =
  | { type: 'progress'; progress: number }
  | { type: 'ready' }
  | { type: 'result'; id: number; text: string }
  | { type: 'error'; id?: number; message: string };

type Transcriber = (
  audio: Float32Array
) => Promise<{ text: string } | { text: string }[]>;

let transcriber: Promise<Transcriber> | null = null;
const files = new Map<string, { loaded: number; total: number }>();

const post = (message: SttResponse) => self.postMessage(message);

function onProgress(info: ProgressInfo) {
  if (info.status !== 'progress') return;
  files.set(info.file, { loaded: info.loaded, total: info.total });
  let loaded = 0;
  let total = 0;
  for (const file of files.values()) {
    loaded += file.loaded;
    total += file.total;
  }
  post({ type: 'progress', progress: total ? loaded / total : 0 });
}

function load() {
  transcriber ??= pipeline('automatic-speech-recognition', MODEL_ID, {
    device: 'gpu' in navigator ? 'webgpu' : 'wasm',
    progress_callback: onProgress,
  }) as unknown as Promise<Transcriber>;
  return transcriber;
}

self.onmessage = async ({ data }: MessageEvent<SttRequest>) => {
  try {
    if (data.type === 'load') {
      await load();
      post({ type: 'ready' });
      return;
    }
    const output = await (await load())(data.audio);
    const text = Array.isArray(output)
      ? output.map((chunk) => chunk.text).join(' ')
      : output.text;
    post({ type: 'result', id: data.id, text });
  } catch (error) {
    if (data.type === 'load') transcriber = null;
    post({
      type: 'error',
      id: data.type === 'transcribe' ? data.id : undefined,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
