import {
  CreateWebWorkerMLCEngine,
  type MLCEngineInterface,
} from '@mlc-ai/web-llm';
import {
  ANALYZE_SYSTEM_PROMPT,
  analyzeUserPrompt,
  EXCUSE_SYSTEM_PROMPT,
  excuseUserPrompt,
  FALLBACK_SUGGESTION,
  SUGGESTION_SYSTEM_PROMPT,
  suggestionUserPrompt,
  translateSystemPrompt,
} from './prompts';

const MODEL_ID = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';

export const LANGUAGES = { es: 'Spanish', no: 'Norwegian' } as const;
export type Language = keyof typeof LANGUAGES;

export type Analysis = { score: number; reason: string; topic: string };

let enginePromise: Promise<MLCEngineInterface> | null = null;
// The engine handles one generation at a time.
let queue: Promise<unknown> = Promise.resolve();

export function loadLlm(onProgress: (progress: number, text: string) => void) {
  enginePromise ??= CreateWebWorkerMLCEngine(
    new Worker(new URL('./llm.worker.ts', import.meta.url), { type: 'module' }),
    MODEL_ID,
    {
      initProgressCallback: (report) =>
        onProgress(report.progress, report.text),
    }
  ).catch((error: unknown) => {
    enginePromise = null;
    throw error;
  });
  return enginePromise;
}

function complete(
  system: string,
  user: string,
  options: { temperature?: number; max_tokens?: number } = {}
) {
  const engine =
    enginePromise ??
    Promise.reject(new Error('The language model is not loaded'));
  const run = queue.then(async () => {
    const reply = await (
      await engine
    ).chat.completions.create({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      ...options,
    });
    return reply.choices[0]?.message.content?.trim() ?? '';
  });
  queue = run.catch(() => undefined);
  return run;
}

function parseJson(content: string): unknown {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

export async function analyzeAwkwardness(text: string): Promise<Analysis> {
  const parsed = parseJson(
    await complete(ANALYZE_SYSTEM_PROMPT, analyzeUserPrompt(text), {
      max_tokens: 200,
    })
  ) as Partial<Analysis> | null;
  const score = Number(parsed?.score);
  if (!parsed || Number.isNaN(score))
    throw new Error('Could not parse the awkwardness analysis');
  return {
    score: Math.round(Math.min(100, Math.max(0, score))),
    reason: String(parsed.reason ?? ''),
    topic: String(parsed.topic ?? ''),
  };
}

export async function suggestQuestion(transcript: string, score: number) {
  const parsed = parseJson(
    await complete(
      SUGGESTION_SYSTEM_PROMPT,
      suggestionUserPrompt(transcript, score),
      { temperature: 0.8 }
    )
  ) as { suggestions?: unknown[] } | null;
  const suggestion = parsed?.suggestions?.[0];
  return typeof suggestion === 'string' && suggestion
    ? suggestion
    : FALLBACK_SUGGESTION;
}

export async function generateExcuse(transcript: string, score: number) {
  const excuse = await complete(
    EXCUSE_SYSTEM_PROMPT,
    excuseUserPrompt(transcript, score)
  );
  return excuse.replace(/^["“”']+|["“”']+$/g, '').trim();
}

export function translate(text: string, language: Language) {
  return complete(translateSystemPrompt(LANGUAGES[language]), text);
}
