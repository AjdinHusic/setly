import { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { browsePath, listProviders, scanProject, type ProviderInfo } from "../api";
import type { AppOutletContext } from "../components/AppLayout";
import { configHref, projectHref, upsertScannedProject } from "../util";

export function HomePage() {
  const [pathInput, setPathInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [bootstrapping, setBootstrapping] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshProjects } = useOutletContext<AppOutletContext>();

  useEffect(() => {
    listProviders()
      .then((r) => setProviders(r.providers))
      .catch(() => setProviders([]));
  }, []);

  useEffect(() => {
    const scanPath = searchParams.get("scan");
    if (!scanPath) return;

    const openPath = searchParams.get("open");
    let cancelled = false;
    setBootstrapping(true);
    setError(null);

    (async () => {
      try {
        const scanned = await scanProject(scanPath);
        if (cancelled) return;
        const projects = upsertScannedProject(scanned);
        refreshProjects();
        const project = projects.find((p) => p.rootPath === scanned.rootPath);
        if (cancelled) return;
        if (openPath) {
          navigate(configHref(openPath), { replace: true });
        } else if (project) {
          navigate(projectHref(project.id), { replace: true });
        } else {
          navigate("/", { replace: true });
        }
      } catch (err) {
        if (cancelled) return;
        navigate("/", { replace: true });
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, navigate, refreshProjects]);

  async function handleAddProject(path: string) {
    setLoading(true);
    setError(null);
    try {
      const scanned = await scanProject(path);
      const projects = upsertScannedProject(scanned);
      refreshProjects();
      const project = projects.find((p) => p.rootPath === scanned.rootPath);
      if (project) {
        navigate(projectHref(project.id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleBrowse(mode: "file" | "directory") {
    setBrowsing(true);
    setError(null);
    try {
      const selected = await browsePath(mode);
      if (!selected) return;
      setPathInput(selected);
      await handleAddProject(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBrowsing(false);
    }
  }

  const busy = loading || browsing || bootstrapping;

  if (bootstrapping) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8 text-sm text-muted">
        Scanning path from CLI…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 pb-16">
      <header className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          setly
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
          Set app config with clarity
        </h2>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted">
          Add a project folder. Setly scans for supported config files, lets you
          describe fields, fill values safely, and generate updated configs.
        </p>
      </header>

      <div className="space-y-4">
        <section className="rounded-xl border border-line bg-panel p-5 shadow-sm">
          <label
            className="mb-1.5 block text-sm font-medium text-ink"
            htmlFor="project-path"
          >
            Add project
          </label>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              void handleAddProject(pathInput);
            }}
          >
            <input
              id="project-path"
              className="input font-mono text-[13px]"
              type="text"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              placeholder="/path/to/project folder"
              spellCheck={false}
              disabled={busy}
            />
            <div className="flex shrink-0 gap-2">
              <button
                className="btn-secondary"
                type="button"
                disabled={busy}
                onClick={() => handleBrowse("directory")}
              >
                {browsing ? "Browsing…" : "Browse folder"}
              </button>
              <button
                className="btn-secondary"
                type="button"
                disabled={busy}
                title="Pick a known config file; its parent folder becomes the project root"
                onClick={() => handleBrowse("file")}
              >
                Browse file
              </button>
              <button
                className="btn-primary"
                type="submit"
                disabled={busy || !pathInput.trim()}
              >
                {loading ? "Scanning…" : "Scan"}
              </button>
            </div>
          </form>
          <p className="mt-2 text-xs text-muted">
            Scans the folder (and subfolders) for known config filenames from
            each provider.
          </p>
          {error && (
            <p className="mt-3 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-line bg-panel p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-ink">Supported providers</h3>
          <p className="mt-1 text-xs text-muted">
            Each provider knows how to discover, read, and write its config
            format.
          </p>
          <ul className="mt-4 space-y-3">
            {providers.length === 0 ? (
              <li className="text-sm text-muted">Loading providers…</li>
            ) : (
              providers.map((provider) => (
                <li
                  key={provider.id}
                  className="rounded-lg border border-line bg-panel-2/50 px-3 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink">
                      {provider.label}
                    </span>
                    <span className="rounded-md bg-panel px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted">
                      {provider.id}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-muted">
                    {provider.description}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {provider.patterns.map((pattern) => (
                      <code
                        key={pattern}
                        className="rounded bg-panel px-1.5 py-0.5 font-mono text-[11px] text-ink"
                      >
                        {pattern}
                      </code>
                    ))}
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
