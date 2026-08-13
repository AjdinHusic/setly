interface GenerateActionsProps {
  busy: boolean;
  onOverwrite: () => void;
  onCopy: () => void;
  message: string | null;
  error: string | null;
  targetLabel?: string;
}

export function GenerateActions({
  busy,
  onOverwrite,
  onCopy,
  message,
  error,
  targetLabel = "config file",
}: GenerateActionsProps) {
  return (
    <section className="rounded-xl border border-line bg-panel p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-ink">Generate</h2>
      <div className="flex flex-wrap gap-2">
        <button
          className="btn-primary"
          type="button"
          disabled={busy}
          onClick={onOverwrite}
        >
          Overwrite {targetLabel}
        </button>
        <button
          className="btn-secondary"
          type="button"
          disabled={busy}
          onClick={onCopy}
        >
          Copy to clipboard
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        Use the Preview tab to inspect the generated output before writing.
      </p>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      {message && <p className="mt-3 text-sm text-accent">{message}</p>}
    </section>
  );
}
