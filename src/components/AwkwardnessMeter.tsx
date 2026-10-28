import { Loader2, Mic, MicOff } from 'lucide-react';
import type { Analysis } from '../ai/llm';
import type { LoadProgress, Status } from '../hooks/useConversationMonitor';

const BANDS = [
  { max: 20, label: 'Natural', text: 'text-green-600', bar: 'bg-green-500' },
  {
    max: 40,
    label: 'Slightly Awkward',
    text: 'text-blue-600',
    bar: 'bg-blue-500',
  },
  { max: 60, label: 'Awkward', text: 'text-yellow-600', bar: 'bg-yellow-500' },
  {
    max: 80,
    label: 'Very Awkward',
    text: 'text-orange-600',
    bar: 'bg-orange-500',
  },
  {
    max: Infinity,
    label: 'Extremely Awkward',
    text: 'text-red-600',
    bar: 'bg-red-500',
  },
];

const BAR_COUNT = 20;

type Props = {
  status: Status;
  error: string | null;
  progress: LoadProgress;
  analysis: Analysis | null;
  transcript: string;
  audioLevel: number;
  onStart: () => void;
  onStop: () => void;
};

export function AwkwardnessMeter({
  status,
  error,
  progress,
  analysis,
  transcript,
  audioLevel,
  onStart,
  onStop,
}: Props) {
  const isListening = status === 'listening';
  const score = analysis?.score ?? 0;
  const band = BANDS.find((b) => score < b.max) ?? BANDS[BANDS.length - 1];

  return (
    <section className="space-y-4 rounded-xl border border-primary/20 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`size-3 rounded-full ${isListening ? 'animate-pulse bg-red-500' : 'bg-muted'}`}
          />
          <h2 className="font-semibold">Conversation Monitor</h2>
        </div>
        <button
          type="button"
          disabled={status === 'loading'}
          onClick={isListening ? onStop : onStart}
          className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 ${
            isListening
              ? 'bg-destructive'
              : 'bg-linear-to-br from-primary to-primary-light'
          }`}
        >
          {status === 'loading' && <Loader2 className="size-4 animate-spin" />}
          {status === 'listening' && <MicOff className="size-4" />}
          {status === 'idle' && <Mic className="size-4" />}
          {status === 'loading'
            ? 'Loading models'
            : isListening
              ? 'Stop'
              : 'Start Monitoring'}
        </button>
      </div>

      {status === 'loading' && (
        <div className="space-y-2 text-xs text-muted-foreground">
          <ProgressRow
            label="Speech recognition (Whisper)"
            value={progress.stt}
          />
          <ProgressRow label="Language model (WebLLM)" value={progress.llm} />
          {progress.text && <p className="truncate">{progress.text}</p>}
          <p>Models are downloaded once and cached by the browser.</p>
        </div>
      )}

      {isListening && (
        <>
          <div className="flex h-8 items-end gap-1">
            {Array.from({ length: BAR_COUNT }, (_, i) => {
              const isActive = (i / BAR_COUNT) * 100 < audioLevel;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-t transition-all duration-100 ${isActive ? 'bg-primary' : 'bg-muted'}`}
                  style={{
                    height: isActive ? `${30 + (i / BAR_COUNT) * 70}%` : '10%',
                  }}
                />
              );
            })}
          </div>

          {analysis?.topic && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="mb-1 text-xs text-muted-foreground">
                Current Topic
              </div>
              <div className="text-sm font-semibold">{analysis.topic}</div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Awkwardness Level</span>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${band.text}`}
              >
                {band.label}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all duration-500 ${band.bar}`}
                style={{ width: `${score}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>0 Natural</span>
              <span className={`text-base font-semibold ${band.text}`}>
                {score}/100
              </span>
              <span>100 Awkward</span>
            </div>
          </div>

          {analysis?.reason && (
            <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              {analysis.reason}
            </p>
          )}

          <div className="rounded-lg bg-primary/5 p-3 text-sm">
            <p className="mb-1 text-xs text-muted-foreground">
              Live Transcript
            </p>
            <p className="italic">
              {transcript ? transcript.slice(-300) : 'Listening...'}
            </p>
          </div>
        </>
      )}

      {error && (
        <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-center text-sm font-medium text-destructive">
          {error}
        </p>
      )}

      {status === 'idle' && !error && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Click "Start Monitoring" to analyze your conversation in real time.
        </p>
      )}
    </section>
  );
}

function ProgressRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between">
        <span>{label}</span>
        <span>{Math.round(value * 100)}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${value * 100}%` }}
        />
      </div>
    </div>
  );
}
