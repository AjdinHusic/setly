import { useMemo, useState } from "react";
import { Link, useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { scanProject } from "../api";
import type { AppOutletContext } from "../components/AppLayout";
import {
  configHref,
  getProjectById,
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
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
