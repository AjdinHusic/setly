import type { ProviderId, ProviderInfo } from "../api";
import type { KeyCasing } from "../nesting";
import { KEY_CASING_OPTIONS } from "../nesting";
import { SeparatorSelect } from "./SeparatorSelect";

export interface PendingChanges {
  total: number;
  descriptions: number;
  values: number;
}

interface GenerateActionsProps {
  busy: boolean;
  providers: ProviderInfo[];
  sourceProviderId: ProviderId;
  outputProviderId: ProviderId;
  onOutputProviderChange: (id: ProviderId) => void;
  outputSeparator: string;
  onOutputSeparatorChange: (value: string) => void;
  outputCasing: KeyCasing;
  onOutputCasingChange: (value: KeyCasing) => void;
  onOverwrite: () => void;
  onCopy: () => void;
  onWriteFile: () => void;
  onPreview: () => void;
  message: string | null;
  error: string | null;
  targetLabel?: string;
  pending?: PendingChanges | null;
  onCancelPending?: () => void;
  onSavePending?: () => void;
  saveBusy?: boolean;
}

function IconCopy() {
  return (
    <svg
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

function IconSave() {
  return (
    <svg
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

function IconOverwrite() {
  return (
    <svg
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

function IconPreview() {
  return (
    <svg
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
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function pendingKindsLabel(pending: PendingChanges): string {
  const parts: string[] = [];
  if (pending.descriptions > 0) parts.push("descriptions");
  if (pending.values > 0) parts.push("values");
  if (parts.length === 0) return "";
  if (parts.length === 2) return "descriptions and values";
  return parts[0]!;
}

export function GenerateActions({
  busy,
  providers,
  sourceProviderId,
  outputProviderId,
  onOutputProviderChange,
  outputSeparator,
  onOutputSeparatorChange,
  outputCasing,
  onOutputCasingChange,
  onOverwrite,
  onCopy,
  onWriteFile,
  onPreview,
  message,
  error,
  targetLabel = "config file",
  pending,
  onCancelPending,
  onSavePending,
  saveBusy,
}: GenerateActionsProps) {
  const isNativeOutput = outputProviderId === sourceProviderId;
  const outputLabel =
    providers.find((p) => p.id === outputProviderId)?.label ?? outputProviderId;
  const showSeparator = outputProviderId === "dotenv";

  const chip =
    "inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50";
  const selectClass =
    "rounded-md border border-white/15 bg-white/10 px-2 py-1 text-xs text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent/40";

  const hasPending = pending != null && pending.total > 0;

  return (
    <section className="border-t border-white/10 bg-[#15202b] text-white shadow-[0_-10px_40px_rgba(15,23,32,0.35)]">
      {hasPending ? (
        <div className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4">
          <p className="min-w-0 text-sm text-white/90">
            <span className="font-semibold tabular-nums text-white">
              {pending.total} {pending.total === 1 ? "change" : "changes"}
            </span>
            <span className="text-white/60">
              {" "}
              · {pendingKindsLabel(pending)}
            </span>
            {pending.descriptions > 0 && pending.values > 0 && (
              <span className="ml-2 hidden text-[11px] text-white/45 sm:inline">
                ({pending.descriptions} describe
                {pending.descriptions === 1 ? "" : "s"}, {pending.values} value
                {pending.values === 1 ? "" : "s"})
              </span>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className={chip}
              disabled={saveBusy}
              onClick={onCancelPending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={saveBusy}
              onClick={onSavePending}
            >
              <IconSave />
              {saveBusy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : (
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
              className={selectClass}
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

            {showSeparator && (
              <>
                <label
                  className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/45"
                  htmlFor="output-separator"
                >
                  Separator
                </label>
                <SeparatorSelect
                  id="output-separator"
                  tone="dark"
                  value={outputSeparator}
                  disabled={busy}
                  onChange={onOutputSeparatorChange}
                />
              </>
            )}

            <label
              className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/45"
              htmlFor="output-casing"
            >
              Casing
            </label>
            <select
              id="output-casing"
              className={selectClass}
              value={outputCasing}
              disabled={busy}
              onChange={(e) =>
                onOutputCasingChange(e.target.value as KeyCasing)
              }
            >
              {KEY_CASING_OPTIONS.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  className="bg-[#15202b] text-ink"
                >
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              className={chip}
              type="button"
              disabled={busy}
              onClick={onPreview}
            >
              <IconPreview />
              Preview
            </button>
            <button
              className={chip}
              type="button"
              disabled={busy}
              onClick={onCopy}
            >
              <IconCopy />
              Copy {outputLabel}
            </button>
            <button
              className={chip}
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
      )}
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
