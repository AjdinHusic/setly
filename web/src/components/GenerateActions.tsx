import type { ProviderId, ProviderInfo } from "../api";

interface GenerateActionsProps {
  busy: boolean;
  providers: ProviderInfo[];
  sourceProviderId: ProviderId;
  outputProviderId: ProviderId;
  onOutputProviderChange: (id: ProviderId) => void;
  onOverwrite: () => void;
  onCopy: () => void;
  onWriteFile: () => void;
  message: string | null;
  error: string | null;
  targetLabel?: string;
}

export function GenerateActions({
  busy,
  providers,
  sourceProviderId,
  outputProviderId,
  onOutputProviderChange,
  onOverwrite,
  onCopy,
  onWriteFile,
  message,
  error,
  targetLabel = "config file",
}: GenerateActionsProps) {
  const isNativeOutput = outputProviderId === sourceProviderId;
  const outputLabel =
    providers.find((p) => p.id === outputProviderId)?.label ?? outputProviderId;

  return (
    <section className="rounded-xl border border-line bg-panel p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-ink">Generate</h2>

      <div className="mb-4">
        <label
          className="mb-1.5 block text-xs font-medium text-muted"
          htmlFor="output-provider"
        >
          Output format
        </label>
        <select
          id="output-provider"
          className="input max-w-xs text-sm"
          value={outputProviderId}
          disabled={busy || providers.length === 0}
          onChange={(e) =>
            onOutputProviderChange(e.target.value as ProviderId)
          }
        >
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label}
              {provider.id === sourceProviderId ? " (native)" : ""}
              {` — ${provider.patterns.join(", ")}`}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-muted">
          Export values as JSON or DotEnv (and more later). Nested JSON keys
          become <code className="font-mono">Section__Key</code> in .env.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="btn-secondary"
          type="button"
          disabled={busy}
          onClick={onCopy}
        >
          Copy {outputLabel} to clipboard
        </button>
        <button
          className="btn-secondary"
          type="button"
          disabled={busy}
          onClick={onWriteFile}
        >
          Write to file…
        </button>
        {isNativeOutput && (
          <button
            className="btn-primary"
            type="button"
            disabled={busy}
            onClick={onOverwrite}
          >
            Overwrite {targetLabel}
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">
        Preview follows the selected output format. Write to file opens a save
        dialog; overwrite only updates the opened file in its native format.
      </p>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      {message && <p className="mt-3 text-sm text-accent">{message}</p>}
    </section>
  );
}
