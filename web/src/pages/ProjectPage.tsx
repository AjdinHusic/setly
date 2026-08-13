import { useMemo, useState } from "react";
import { Link, useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { scanProject } from "../api";
import type { AppOutletContext } from "../components/AppLayout";
import {
  combineHref,
  configHref,
  createCombinedView,
  getProjectById,
  removeCombinedView,
  touchProject,
  updateProjectLabel,
  upsertScannedProject,
} from "../util";

export function ProjectPage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("id") ?? "";
  const { refreshProjects, projects } = useOutletContext<AppOutletContext>();
  const navigate = useNavigate();

  const project = useMemo(
    () => projects.find((p) => p.id === projectId) ?? getProjectById(projectId),
    [projects, projectId],
  );

  const [labelDraft, setLabelDraft] = useState(project?.label ?? "");
  const [editing, setEditing] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [combineMode, setCombineMode] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [dominantPath, setDominantPath] = useState("");
  const [combineLabel, setCombineLabel] = useState("Combined view");

  if (!projectId || !project) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8 space-y-3">
        <p className="text-sm text-danger">Project not found.</p>
        <Link to="/" className="text-sm text-accent">
          Back to home
        </Link>
      </div>
    );
  }

  function startEdit() {
    setLabelDraft(project!.label);
    setEditing(true);
  }

  function saveLabel() {
    updateProjectLabel(project!.id, labelDraft);
    refreshProjects();
    setEditing(false);
    setInfo("Project label updated.");
  }

  async function handleRescan() {
    setRescanning(true);
    setError(null);
    setInfo(null);
    try {
      const scanned = await scanProject(project!.rootPath);
      upsertScannedProject({
        rootPath: scanned.rootPath,
        label: project!.label,
        configs: scanned.configs,
      });
      touchProject(project!.id);
      refreshProjects();
      setInfo(`Found ${scanned.configs.length} config file(s).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRescanning(false);
    }
  }

  function toggleSelect(path: string) {
    setSelectedPaths((prev) => {
      const next = prev.includes(path)
        ? prev.filter((p) => p !== path)
        : [...prev, path];
      if (!next.includes(dominantPath)) {
        setDominantPath(next[0] ?? "");
      }
      return next;
    });
  }

  function createCombine() {
    if (selectedPaths.length < 2) {
      setError("Select at least two config files to combine.");
      return;
    }
    const dominant = dominantPath || selectedPaths[0]!;
    const created = createCombinedView(project!.id, {
      label: combineLabel,
      sourcePaths: selectedPaths,
      dominantPath: dominant,
    });
    refreshProjects();
    setCombineMode(false);
    setSelectedPaths([]);
    navigate(combineHref(project!.id, created.id));
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 pb-16">
      <header className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          Project
        </p>
        {editing ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              className="input max-w-md"
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              autoFocus
            />
            <button type="button" className="btn-primary" onClick={saveLabel}>
              Save
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight text-ink">
              {project.label}
            </h2>
            <button type="button" className="btn-ghost text-xs" onClick={startEdit}>
              Edit label
            </button>
          </div>
        )}
        <p className="mt-2 font-mono text-xs text-muted break-all">
          {project.rootPath}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-panel-2 px-2 py-1 text-xs font-semibold text-muted">
            {project.configs.length} config
            {project.configs.length === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            className="btn-secondary"
            disabled={rescanning}
            onClick={() => void handleRescan()}
          >
            {rescanning ? "Rescanning…" : "Rescan folder"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={project.configs.length < 2}
            onClick={() => {
              setCombineMode((v) => !v);
              setError(null);
              setSelectedPaths([]);
              setDominantPath("");
              setCombineLabel("Combined view");
            }}
          >
            {combineMode ? "Cancel combine" : "Combine configs"}
          </button>
        </div>
      </header>

      {error && (
        <p className="mb-4 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {info && !error && (
        <p className="mb-4 rounded-lg border border-accent/20 bg-accent-soft px-3 py-2 text-sm text-accent">
          {info}
        </p>
      )}

      {combineMode && (
        <section className="mb-6 rounded-xl border border-accent/30 bg-accent-soft/30 p-4">
          <h3 className="text-sm font-semibold text-ink">New combined view</h3>
          <p className="mt-1 text-xs text-muted">
            Select two or more configs, pick a dominant file (wins on conflicts),
            then open the virtual merged form.
          </p>
          <label className="mt-3 block text-xs font-medium text-muted">
            Label
            <input
              className="input mt-1"
              value={combineLabel}
              onChange={(e) => setCombineLabel(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn-primary mt-3"
            disabled={selectedPaths.length < 2}
            onClick={createCombine}
          >
            Create & open
          </button>
        </section>
      )}

      {(project.combines?.length ?? 0) > 0 && (
        <section className="mb-6 rounded-xl border border-line bg-panel shadow-sm">
          <div className="border-b border-line px-5 py-3">
            <h3 className="text-sm font-semibold text-ink">Combined views</h3>
          </div>
          <ul className="divide-y divide-line">
            {project.combines!.map((view) => (
              <li
                key={view.id}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => navigate(combineHref(project.id, view.id))}
                >
                  <div className="text-[15px] font-semibold text-ink">
                    {view.label}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {view.sourcePaths.length} sources · dominant{" "}
                    {view.dominantPath.split(/[/\\]/).pop()}
                  </div>
                </button>
                <button
                  type="button"
                  className="btn-ghost text-[11px] text-danger"
                  onClick={() => {
                    removeCombinedView(project.id, view.id);
                    refreshProjects();
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-line bg-panel shadow-sm">
        <div className="border-b border-line px-5 py-3">
          <h3 className="text-sm font-semibold text-ink">Config files</h3>
        </div>
        {project.configs.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">
            No configs discovered. Try rescanning.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {project.configs.map((config) => (
              <li key={config.path}>
                {combineMode ? (
                  <div className="flex w-full items-start gap-3 px-5 py-4">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 rounded border-line text-accent"
                      checked={selectedPaths.includes(config.path)}
                      onChange={() => toggleSelect(config.path)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-semibold text-ink">
                        {config.displayName}
                      </div>
                      <div className="mt-1 font-mono text-xs text-muted break-all">
                        {config.relativePath}
                      </div>
                      {selectedPaths.includes(config.path) && (
                        <label className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-muted">
                          <input
                            type="radio"
                            name="new-dominant"
                            checked={dominantPath === config.path}
                            onChange={() => setDominantPath(config.path)}
                          />
                          Dominant
                        </label>
                      )}
                    </div>
                    <span className="shrink-0 rounded-md bg-panel-2 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                      {config.providerId}
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left transition hover:bg-panel-2/60"
                    onClick={() => {
                      touchProject(project.id);
                      refreshProjects();
                      navigate(configHref(config.path));
                    }}
                  >
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold text-ink">
                        {config.displayName}
                      </div>
                      <div className="mt-1 font-mono text-xs text-muted break-all">
                        {config.relativePath}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-md bg-panel-2 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                      {config.providerId}
                    </span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
