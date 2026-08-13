import { useEffect, useId, useState } from "react";

interface PathsInfoButtonProps {
  targetPath: string;
  describePath: string | null;
}

/** Compact info control that opens a modal with target / describe paths. */
export function PathsInfoButton({
  targetPath,
  describePath,
}: PathsInfoButtonProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="inline-flex size-8 items-center justify-center rounded-full border border-line bg-panel text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
        aria-label="Show file paths"
        title="Paths"
        onClick={() => setOpen(true)}
      >
        i
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="w-full max-w-lg rounded-xl border border-line bg-panel p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 id={titleId} className="text-base font-semibold text-ink">
                Paths
              </h3>
              <button
                type="button"
                className="btn-ghost text-sm"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Target
                </div>
                <code className="mt-1 block break-all rounded-lg bg-panel-2 px-3 py-2 font-mono text-xs leading-relaxed text-ink">
                  {targetPath}
                </code>
              </div>
              {describePath && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Describe
                  </div>
                  <code className="mt-1 block break-all rounded-lg bg-panel-2 px-3 py-2 font-mono text-xs leading-relaxed text-ink">
                    {describePath}
                  </code>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
