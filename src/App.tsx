import { Languages } from 'lucide-react';
import { useState } from 'react';
import { LANGUAGES, type Language } from './ai/llm';
import { AwkwardnessMeter } from './components/AwkwardnessMeter';
import { SuggestionCard } from './components/SuggestionCard';
import { useConversationMonitor } from './hooks/useConversationMonitor';

export function App() {
  const [language, setLanguage] = useState<Language | null>(null);
  const monitor = useConversationMonitor(language);

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 p-4 py-10">
      <header className="mb-8 text-center">
        <h1 className="mb-2 bg-linear-to-br from-primary to-primary-light bg-clip-text text-4xl font-bold text-transparent">
          Social Compass
        </h1>
        <p className="text-muted-foreground">
          Your intelligent companion that helps you navigate conversations with
          confidence. Everything runs locally in your browser.
        </p>
      </header>

      <section className="flex items-center gap-3 rounded-xl border bg-white p-4 shadow-sm">
        <Languages className="size-5 text-muted-foreground" />
        <div className="flex-1">
          <label htmlFor="translation" className="text-sm font-medium">
            Real-time Translation
          </label>
          <p className="text-xs text-muted-foreground">
            Translate the conversation as it happens
          </p>
        </div>
        <select
          id="translation"
          value={language ?? 'off'}
          onChange={(event) =>
            setLanguage(
              event.target.value === 'off'
                ? null
                : (event.target.value as Language)
            )
          }
          className="w-40 rounded-md border bg-white px-2 py-1.5 text-sm"
        >
          <option value="off">Off</option>
          {Object.entries(LANGUAGES).map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
      </section>

      <AwkwardnessMeter
        status={monitor.status}
        error={monitor.error}
        progress={monitor.progress}
        analysis={monitor.analysis}
        transcript={monitor.transcript}
        audioLevel={monitor.audioLevel}
        onStart={monitor.start}
        onStop={monitor.stop}
      />

      {language && monitor.status === 'listening' && (
        <section className="rounded-xl border border-primary/20 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Languages className="size-5 text-primary" />
            <h2 className="font-semibold">
              Translation ({LANGUAGES[language]})
            </h2>
          </div>
          <p className="rounded-lg bg-primary/5 p-3 text-sm">
            {monitor.translation || (
              <span className="text-muted-foreground italic">
                Waiting for transcript...
              </span>
            )}
          </p>
        </section>
      )}

      {monitor.suggestion && (
        <SuggestionCard
          suggestion={monitor.suggestion}
          onDismiss={monitor.dismissSuggestion}
        />
      )}
    </main>
  );
}
