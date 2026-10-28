import { DoorOpen, Lightbulb, X } from 'lucide-react';
import type { Suggestion } from '../hooks/useConversationMonitor';

type Props = { suggestion: Suggestion; onDismiss: () => void };

export function SuggestionCard({ suggestion, onDismiss }: Props) {
  const isExcuse = suggestion.kind === 'excuse';
  const Icon = isExcuse ? DoorOpen : Lightbulb;

  return (
    <section
      className={`relative rounded-xl border p-4 shadow-sm ${
        isExcuse
          ? 'border-accent/30 bg-accent/5'
          : 'border-primary/20 bg-primary/5'
      }`}
    >
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="absolute top-2 right-2 rounded p-1 text-muted-foreground hover:bg-muted"
      >
        <X className="size-4" />
      </button>
      <div className="flex items-start gap-3">
        <div
          className={`rounded-full p-2 ${isExcuse ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'}`}
        >
          <Icon className="size-5" />
        </div>
        <div className="flex-1">
          <h3 className="mb-2 text-sm font-semibold">
            {isExcuse ? 'Time to go:' : 'Try asking:'}
          </h3>
          <p className="rounded-md border border-border/50 bg-white/50 p-3 text-sm text-muted-foreground">
            "{suggestion.text}"
          </p>
        </div>
      </div>
    </section>
  );
}
