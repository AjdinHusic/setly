import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useCallback, useMemo, useState } from "react";
import {
  configHref,
  loadProjects,
  projectHref,
  removeProject,
  type StoredProject,
} from "../util";

export type AppOutletContext = {
  refreshProjects: () => void;
  projects: StoredProject[];
};

export function AppLayout() {
  const [projects, setProjects] = useState<StoredProject[]>(() =>
    loadProjects(),
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();
  const location = useLocation();

  const refreshProjects = useCallback(() => {
    setProjects(loadProjects());
  }, []);

  const activeConfigPath = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return location.pathname === "/config" ? params.get("path") : null;
  }, [location]);

  const activeProjectId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return location.pathname === "/project" ? params.get("id") : null;
  }, [location]);

  function handleDelete(projectId: string) {
    const next = removeProject(projectId);
    setProjects(next);
    if (activeProjectId === projectId) {
      navigate("/");
      return;
    }
    const removed = projects.find((p) => p.id === projectId);
    if (
      removed &&
      activeConfigPath &&
      removed.configs.some((c) => c.path === activeConfigPath)
    ) {
      navigate("/");
    }
  }

  function toggleExpanded(projectId: string) {
    setExpanded((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
  }

  return (
    <div className="flex h-full min-h-screen bg-canvas">
      <aside className="flex h-full w-72 shrink-0 flex-col border-r border-white/5 bg-sidebar text-white">
        <div className="border-b border-white/10 px-4 py-5">
          <Link
            to="/"
            className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted hover:text-white"
          >
            setly
          </Link>
          <h1 className="mt-1 text-lg font-semibold tracking-tight">Projects</h1>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3">
          {projects.length === 0 ? (
            <p className="px-2 py-3 text-sm leading-relaxed text-sidebar-muted">
              Add a project folder from the home page to scan for configs.
            </p>
          ) : (
            <ul className="space-y-1">
              {projects.map((project) => {
                const autoExpand =
                  activeProjectId === project.id ||
                  project.configs.some((c) => c.path === activeConfigPath);
                const isOpen =
                  expanded[project.id] !== undefined
                    ? Boolean(expanded[project.id])
                    : autoExpand;
                const projectActive = activeProjectId === project.id;

                return (
                  <li key={project.id}>
                    <div className="group relative flex items-stretch gap-0.5">
                      <button
                        type="button"
                        aria-label={isOpen ? "Collapse" : "Expand"}
                        onClick={() => toggleExpanded(project.id)}
                        className="rounded-md px-1.5 text-sidebar-muted hover:bg-sidebar-hover hover:text-white"
                      >
                        {isOpen ? "▾" : "▸"}
                      </button>
                      <NavLink
                        to={projectHref(project.id)}
                        title={project.rootPath}
                        className={`min-w-0 flex-1 rounded-lg px-2 py-2 pr-8 text-left transition ${
                          projectActive
                            ? "bg-sidebar-active text-white"
                            : "text-sidebar-muted hover:bg-sidebar-hover hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {project.label}
                          </span>
                          <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/80">
                            {project.configs.length}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate font-mono text-[10px] opacity-60">
                          {project.rootPath}
                        </div>
                      </NavLink>
                      <button
                        type="button"
                        aria-label={`Remove ${project.label}`}
                        title="Remove project"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDelete(project.id);
                        }}
                        className="absolute right-1 top-2 rounded-md px-1.5 py-1 text-xs text-sidebar-muted opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100"
                      >
                        ✕
                      </button>
                    </div>

                    {isOpen && (
                      <ul className="ml-6 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
                        {project.configs.map((config) => (
                          <li key={config.path}>
                            <NavLink
                              to={configHref(config.path)}
                              title={config.path}
                              className={({ isActive }) =>
                                `block rounded-md px-2 py-1.5 text-left transition ${
                                  isActive || activeConfigPath === config.path
                                    ? "bg-sidebar-active text-white"
                                    : "text-sidebar-muted hover:bg-sidebar-hover hover:text-white"
                                }`
                              }
                            >
                              <div className="truncate text-[13px] font-medium">
                                {config.displayName}
                              </div>
                              <div className="mt-0.5 flex items-center gap-1.5">
                                <span className="rounded bg-white/10 px-1 py-0.5 text-[9px] uppercase tracking-wide">
                                  {config.providerId}
                                </span>
                                <span className="truncate font-mono text-[10px] opacity-60">
                                  {config.relativePath}
                                </span>
                              </div>
                            </NavLink>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-white/10 px-4 py-3 text-[11px] text-sidebar-muted">
          Stored in browser localStorage
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <Outlet
          context={
            { refreshProjects, projects } satisfies AppOutletContext
          }
        />
      </main>
    </div>
  );
}
