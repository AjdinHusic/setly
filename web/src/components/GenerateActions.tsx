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
    <section className="rounded-xl border border-line bg-panel/95 p-3 shadow-[0_-8px_30px_rgba(15,23,32,0.08)] backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">
            Generate
          </span>
          <label className="sr-only" htmlFor="output-provider">
            Output format
          </label>
          <select
            id="output-provider"
            className="input max-w-[14rem] py-1.5 text-sm"
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
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="btn-secondary"
            type="button"
            disabled={busy}
            onClick={onCopy}
          >
            Copy {outputLabel}
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
      </div>
      {(error || message) && (
        <p
          className={`mt-2 text-sm ${error ? "text-danger" : "text-accent"}`}
        >
          {error ?? message}
        </p>
      )}
    </section>
  );
}
