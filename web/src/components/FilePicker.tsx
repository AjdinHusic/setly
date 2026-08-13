import { useState, type FormEvent } from "react";
import { browsePath } from "../api";

interface FilePickerProps {
  path: string;
  loading: boolean;
  onPathChange: (path: string) => void;
  onOpen: (path: string) => void;
}

export function FilePicker({
  path,
  loading,
  onPathChange,
  onOpen,
}: FilePickerProps) {
  const [browsing, setBrowsing] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onOpen(path);
  }

  async function handleBrowse(mode: "file" | "directory") {
    setBrowsing(true);
    setBrowseError(null);
    try {
      const selected = await browsePath(mode);
      if (!selected) return;
      onPathChange(selected);
      onOpen(selected);
    } catch (err) {
      setBrowseError(err instanceof Error ? err.message : String(err));
    } finally {
      setBrowsing(false);
    }
  }

  const busy = loading || browsing;

  return (
    <section className="rounded-xl border border-line bg-panel p-5 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label
            className="mb-1.5 block text-sm font-medium text-ink"
            htmlFor="config-path"
          >
            Open configuration
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="config-path"
              className="input font-mono text-[13px]"
              type="text"
              value={path}
              onChange={(e) => onPathChange(e.target.value)}
              placeholder="/path/to/appsettings.json or project folder"
              spellCheck={false}
              disabled={busy}
            />
            <div className="flex shrink-0 gap-2">
              <button
                className="btn-secondary"
                type="button"
                disabled={busy}
                onClick={() => handleBrowse("file")}
              >
                {browsing ? "Browsing…" : "Browse…"}
              </button>
              <button
                className="btn-secondary"
                type="button"
                disabled={busy}
                title="Select a project folder containing appsettings.json"
                onClick={() => handleBrowse("directory")}
              >
                Folder
              </button>
              <button
                className="btn-primary"
                type="submit"
                disabled={busy || !path.trim()}
              >
                {loading ? "Opening…" : "Open"}
              </button>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">
            Paste a path, or use Browse / Folder to pick via the system dialog.
            Successful opens are saved to Projects.
          </p>
          {browseError && (
            <p className="mt-2 text-sm text-danger">{browseError}</p>
          )}
        </div>
      </form>
    </section>
  );
}

interface PathInfoProps {
  targetPath: string;
  describePath: string | null;
}

export function PathInfo({ targetPath, describePath }: PathInfoProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-line bg-panel shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-ink">Paths</span>
        <span className="text-xs text-muted">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-line px-4 py-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Target
            </div>
            <code className="mt-1 block break-all font-mono text-xs leading-relaxed text-ink">
              {targetPath}
            </code>
          </div>
          {describePath && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Describe
              </div>
              <code className="mt-1 block break-all font-mono text-xs leading-relaxed text-ink">
                {describePath}
              </code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
