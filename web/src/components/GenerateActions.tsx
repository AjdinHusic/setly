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

function IconCopy({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconSave({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

function IconOverwrite({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
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
    <section className="border-t border-white/10 bg-[#15202b] text-white shadow-[0_-10px_40px_rgba(15,23,32,0.35)]">
      <div className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">
            Generate
          </span>
          <label className="sr-only" htmlFor="output-provider">
            Output format
          </label>
          <select
            id="output-provider"
            className="rounded-md border border-white/15 bg-white/10 px-2 py-1 text-xs text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent/40"
            value={outputProviderId}
            disabled={busy || providers.length === 0}
            onChange={(e) =>
              onOutputProviderChange(e.target.value as ProviderId)
            }
          >
            {providers.map((provider) => (
              <option
                key={provider.id}
                value={provider.id}
                className="bg-[#15202b] text-ink"
              >
                {provider.label}
                {provider.id === sourceProviderId ? " (native)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={busy}
            onClick={onCopy}
          >
            <IconCopy />
            Copy {outputLabel}
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={busy}
            onClick={onWriteFile}
          >
            <IconSave />
            Write file
          </button>
          {isNativeOutput && (
            <button
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={busy}
              onClick={onOverwrite}
            >
              <IconOverwrite />
              Overwrite {targetLabel}
            </button>
          )}
        </div>
      </div>
      {(error || message) && (
        <p
          className={`border-t border-white/10 px-3 py-1.5 text-xs sm:px-4 ${
            error ? "bg-danger/20 text-red-200" : "bg-accent/20 text-teal-100"
          }`}
        >
          {error ?? message}
        </p>
      )}
    </section>
  );
}
