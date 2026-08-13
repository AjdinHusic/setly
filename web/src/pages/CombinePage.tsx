import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import {
  browsePath,
  generateConfig,
  listProviders,
  openCombine,
  type DescribeConfig,
  type FieldSourceInfo,
  type ProviderId,
  type ProviderInfo,
} from "../api";
import type { AppOutletContext } from "../components/AppLayout";
import { ConfigForm } from "../components/ConfigForm";
import { GenerateActions } from "../components/GenerateActions";
import { Modal } from "../components/Modal";
import type { KeyCasing } from "../nesting";
import { DEFAULT_ENV_SEPARATOR } from "../nesting";
import {
  buildOutline,
  flattenParameters,
  getProjectById,
  isEmptyValue,
  projectHref,
  upsertCombinedView,
} from "../util";

export function CombinePage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project") ?? "";
  const combineId = searchParams.get("id") ?? "";
  const { refreshProjects, projects } = useOutletContext<AppOutletContext>();

  const project = useMemo(
    () => projects.find((p) => p.id === projectId) ?? getProjectById(projectId),
    [projects, projectId],
  );
  const combine = useMemo(
    () => project?.combines?.find((c) => c.id === combineId) ?? null,
    [project, combineId],
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [describe, setDescribe] = useState<DescribeConfig | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [fieldSources, setFieldSources] = useState<Record<string, string>>({});
  const [sources, setSources] = useState<
    {
      path: string;
      fileName: string;
      providerId: ProviderId;
      providerLabel: string;
      excluded: boolean;
    }[]
  >([]);
  const [dominantPath, setDominantPath] = useState("");
  const [excludedPaths, setExcludedPaths] = useState<string[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [outputProviderId, setOutputProviderId] = useState<ProviderId>("json");
  const [outputSeparator, setOutputSeparator] = useState(DEFAULT_ENV_SEPARATOR);
  const [outputCasing, setOutputCasing] = useState<KeyCasing>("preserve");
  const [genBusy, setGenBusy] = useState(false);
  const [genMessage, setGenMessage] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [highlightPathKey] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [reloadToken, setReloadToken] = useState(0);

  const fields = useMemo(() => {
    if (!describe) return [];
    return flattenParameters(describe.Parameters);
  }, [describe]);

  const outline = useMemo(() => {
    if (!describe) return [];
    return buildOutline(describe.Parameters);
  }, [describe]);

  useEffect(() => {
    listProviders()
      .then((r) => setProviders(r.providers))
      .catch(() => setProviders([]));
  }, []);

  useEffect(() => {
    if (!combine) {
      setLoading(false);
      setError("Combined view not found.");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    openCombine({
      paths: combine.sourcePaths,
      dominantPath: combine.dominantPath,
      excludedPaths: combine.excludedPaths,
    })
      .then((result) => {
        if (cancelled) return;
        setDescribe(result.describe);
        setValues(result.values);
        setSources(result.sources);
        setDominantPath(result.dominantPath);
        setExcludedPaths(
          result.sources.filter((s) => s.excluded).map((s) => s.path),
        );
        const map: Record<string, string> = {};
        for (const src of result.fieldSources as FieldSourceInfo[]) {
          map[src.pathKey] = src.label;
        }
        setFieldSources(map);
        const dotenv = result.sources.find((s) => s.providerId === "dotenv");
        setOutputProviderId(dotenv?.providerId ?? "json");
        setOutputSeparator(result.describe.Separator ?? DEFAULT_ENV_SEPARATOR);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setDescribe(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [combine, reloadToken]);

  function persistCombine(next: {
    dominantPath?: string;
    excludedPaths?: string[];
  }) {
    if (!project || !combine) return;
    upsertCombinedView(project.id, {
      ...combine,
      dominantPath: next.dominantPath ?? dominantPath,
      excludedPaths: next.excludedPaths ?? excludedPaths,
    });
    refreshProjects();
    setReloadToken((n) => n + 1);
  }

  function toggleExcluded(path: string) {
    const next = excludedPaths.includes(path)
      ? excludedPaths.filter((p) => p !== path)
      : [...excludedPaths, path];
    if (next.length >= (combine?.sourcePaths.length ?? 0)) {
      setGenError("Keep at least one config included.");
      return;
    }
    if (path === dominantPath && next.includes(path)) {
      const remaining = (combine?.sourcePaths ?? []).find(
        (p) => !next.includes(p),
      );
      if (remaining) {
        setDominantPath(remaining);
        setExcludedPaths(next);
        persistCombine({ dominantPath: remaining, excludedPaths: next });
        return;
      }
    }
    setExcludedPaths(next);
    persistCombine({ excludedPaths: next });
  }

  function handleDominantChange(path: string) {
    setDominantPath(path);
    const nextExcluded = excludedPaths.filter((p) => p !== path);
    setExcludedPaths(nextExcluded);
    persistCombine({ dominantPath: path, excludedPaths: nextExcluded });
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    for (const field of fields) {
      if (!field.meta.Required) continue;
      if (isEmptyValue(values[field.pathKey])) {
        next[field.pathKey] = "This field is required.";
      }
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function openPreviewModal() {
    if (!describe) return;
    const writeTarget =
      sources.find((s) => !s.excluded && s.path === dominantPath)?.path ??
      sources.find((s) => !s.excluded)?.path;
    if (!writeTarget) return;
    setPreviewOpen(true);
    setPreview(null);
    setPreviewError(null);
    try {
      const result = await generateConfig(writeTarget, values, "preview", {
        outputProviderId,
        separator: outputSeparator,
        casing: outputCasing,
        describe,
      });
      setPreview(result.text);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : String(err));
    }
  }

  async function runGenerate(action: "overwrite" | "copy" | "write") {
    if (!describe) return;
    const writeTarget =
      sources.find((s) => !s.excluded && s.path === dominantPath)?.path ??
      sources.find((s) => !s.excluded)?.path;
    if (!writeTarget) return;
    if (!validate()) {
      setGenError("Fix required fields before generating.");
      return;
    }
    setGenBusy(true);
    setGenError(null);
    setGenMessage(null);
    try {
      if (action === "write") {
        const selected = await browsePath("save", {
          defaultName:
            outputProviderId === "dotenv" ? ".env" : "appsettings.json",
        });
        if (!selected) return;
        const result = await generateConfig(writeTarget, values, "write", {
          outputProviderId,
          outputPath: selected,
          separator: outputSeparator,
          casing: outputCasing,
          describe,
        });
        setGenMessage(`Wrote ${result.writtenPath ?? selected}`);
        return;
      }
      const mode = action === "copy" ? "preview" : "overwrite";
      if (action === "overwrite" && outputProviderId !== sources.find((s) => s.path === writeTarget)?.providerId) {
        setGenError(
          "Overwrite only works for the dominant file’s native format. Use Write file instead.",
        );
        return;
      }
      const result = await generateConfig(writeTarget, values, mode, {
        outputProviderId,
        separator: outputSeparator,
        casing: outputCasing,
        describe,
      });
      if (action === "copy") {
        await navigator.clipboard.writeText(result.text);
        setGenMessage("Copied combined output to clipboard.");
      } else {
        setGenMessage(`Wrote ${result.writtenPath ?? result.targetPath}`);
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenBusy(false);
    }
  }

  if (!projectId || !combineId || !project || !combine) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8 space-y-3">
        <p className="text-sm text-danger">Combined view not found.</p>
        <Link to="/" className="text-sm text-accent">
          Back to home
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8 text-sm text-muted">
        Loading combined configuration…
      </div>
    );
  }

  if (error || !describe) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8 space-y-3">
        <p className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
          {error ?? "Failed to open combined view."}
        </p>
        <Link
          to={projectHref(project.id)}
          className="text-sm text-accent hover:underline"
        >
          Back to project
        </Link>
      </div>
    );
  }

  const outputLabel =
    providers.find((p) => p.id === outputProviderId)?.label ?? outputProviderId;

  return (
    <div className="relative mx-auto max-w-6xl px-6 pt-8 pb-24">
      <header className="mb-6 max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          Combined view
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
          {combine.label}
        </h2>
        <Link
          to={projectHref(project.id)}
          className="mt-1.5 inline-block text-base font-medium text-accent hover:underline"
        >
          {project.label}
        </Link>
      </header>

      <div className="mb-5 max-w-3xl rounded-xl border border-accent/25 bg-accent-soft/40 px-4 py-3 text-sm text-ink">
        <p className="font-semibold text-accent">Merge strategy</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Included files are converted to nested objects (dotenv keys are split
          with their separator), then deep-merged. Object keys recurse; arrays
          and scalar leaves are replaced wholesale. The{" "}
          <strong className="font-semibold text-ink">dominant</strong> file is
          applied last and wins when the same path exists in multiple sources.
          Uncheck a file to exclude it from the merge without removing it from
          this view.
        </p>
      </div>

      <section className="mb-6 max-w-3xl rounded-xl border border-line bg-panel p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-ink">Source files</h3>
        <ul className="mt-3 space-y-2">
          {sources.map((source) => (
            <li
              key={source.path}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-3 py-2"
            >
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 rounded border-line text-accent"
                  checked={!source.excluded}
                  onChange={() => toggleExcluded(source.path)}
                />
                <span className="font-medium text-ink">{source.fileName}</span>
              </label>
              <span className="rounded bg-panel-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted">
                {source.providerId}
              </span>
              <label className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-muted">
                <input
                  type="radio"
                  name="dominant"
                  checked={dominantPath === source.path}
                  disabled={source.excluded}
                  onChange={() => handleDominantChange(source.path)}
                />
                Dominant
              </label>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
        <div className="min-w-0 max-w-3xl flex-1">
          <section className="rounded-xl border border-line bg-panel p-5 shadow-sm">
            <p className="mb-4 text-xs text-muted">
              {outline.length} section
              {outline.length === 1 ? "" : "s"} · {fields.length} parameter
              {fields.length === 1 ? "" : "s"} (read-only describe metadata in
              this view — edit sources individually to change labels/types).
            </p>
            <ConfigForm
              parameters={describe.Parameters}
              fields={fields}
              values={values}
              errors={fieldErrors}
              onChange={(pathKey, value) =>
                setValues((prev) => ({ ...prev, [pathKey]: value }))
              }
              onResetField={(pathKey) => {
                const field = fields.find((f) => f.pathKey === pathKey);
                if (!field) return;
                setValues((prev) => ({
                  ...prev,
                  [pathKey]: field.meta.InitialValue,
                }));
              }}
              onMetaChange={() => {
                /* describe edits are local to source files */
              }}
              highlightPathKey={highlightPathKey}
              keySeparator={describe.Separator ?? null}
              fieldSources={fieldSources}
            />
          </section>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 md:left-72">
        <GenerateActions
          busy={genBusy}
          providers={providers}
          sourceProviderId={
            sources.find((s) => s.path === dominantPath)?.providerId ?? "json"
          }
          outputProviderId={outputProviderId}
          onOutputProviderChange={setOutputProviderId}
          outputSeparator={outputSeparator}
          onOutputSeparatorChange={setOutputSeparator}
          outputCasing={outputCasing}
          onOutputCasingChange={setOutputCasing}
          onOverwrite={() => void runGenerate("overwrite")}
          onCopy={() => void runGenerate("copy")}
          onWriteFile={() => void runGenerate("write")}
          onPreview={() => void openPreviewModal()}
          message={genMessage}
          error={genError}
          targetLabel={
            sources.find((s) => s.path === dominantPath)?.fileName ?? "config"
          }
        />
      </div>

      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`Preview · ${outputLabel}`}
        wide
      >
        {previewError && (
          <p className="mb-3 text-sm text-danger">{previewError}</p>
        )}
        {preview !== null ? (
          <pre className="max-h-[28rem] overflow-auto rounded-lg border border-line bg-panel-2 p-3 font-mono text-xs leading-relaxed text-ink">
            {preview}
          </pre>
        ) : (
          !previewError && (
            <p className="text-sm text-muted">Building preview…</p>
          )
        )}
      </Modal>
    </div>
  );
}
