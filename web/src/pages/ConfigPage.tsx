import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import {
  browsePath,
  generateConfig,
  listProviders,
  openConfig,
  saveDescribe,
  type DescribeConfig,
  type DropdownOption,
  type FieldMeta,
  type FieldType,
  type ProviderId,
  type ProviderInfo,
} from "../api";
import type { AppOutletContext } from "../components/AppLayout";
import { AddParameterForm } from "../components/AddParameterForm";
import { ConfigForm } from "../components/ConfigForm";
import { ConfigOutlineNav } from "../components/ConfigOutlineNav";
import { GenerateActions } from "../components/GenerateActions";
import { Modal } from "../components/Modal";
import { PathsInfoButton } from "../components/PathsInfoButton";
import {
  buildOutline,
  cloneDescribe,
  cloneValues,
  countDescribeChanges,
  countValueChanges,
  defaultValueForType,
  defaultsFromDescribe,
  findProjectForConfigPath,
  flattenParameters,
  insertFieldAtPath,
  isEmptyValue,
  parseParameterPath,
  projectHref,
  updateFieldMetaAtPath,
} from "../util";

function suggestedOutputName(
  sourcePath: string,
  sourceProviderId: ProviderId,
  outputProviderId: ProviderId,
): string {
  const base = sourcePath.split(/[/\\]/).pop() ?? "config";
  if (outputProviderId === sourceProviderId) return base;
  if (outputProviderId === "dotenv") return ".env";
  if (outputProviderId === "json") return "appsettings.json";
  return base;
}

function IconPlus() {
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
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function IconReset() {
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
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

const thinBtn =
  "inline-flex items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-panel-2 disabled:cursor-not-allowed disabled:opacity-50";

export function ConfigPage() {
  const [searchParams] = useSearchParams();
  const filePath = searchParams.get("path") ?? "";
  const { refreshProjects } = useOutletContext<AppOutletContext>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [targetPath, setTargetPath] = useState<string | null>(null);
  const [describePath, setDescribePath] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<ProviderId | null>(null);
  const [providerLabel, setProviderLabel] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [outputProviderId, setOutputProviderId] = useState<ProviderId | null>(
    null,
  );
  const [describe, setDescribe] = useState<DescribeConfig | null>(null);
  const [baselineDescribe, setBaselineDescribe] =
    useState<DescribeConfig | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [baselineValues, setBaselineValues] = useState<
    Record<string, unknown>
  >({});
  const [stalePaths, setStalePaths] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savingEdits, setSavingEdits] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [addParamOpen, setAddParamOpen] = useState(false);
  const [genMessage, setGenMessage] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [highlightPathKey, setHighlightPathKey] = useState<string | null>(
    null,
  );

  const fields = useMemo(() => {
    if (!describe) return [];
    return flattenParameters(describe.Parameters, [], new Set(stalePaths));
  }, [describe, stalePaths]);

  const outline = useMemo(() => {
    if (!describe) return [];
    return buildOutline(describe.Parameters);
  }, [describe]);

  const parentProject = useMemo(
    () => (targetPath ? findProjectForConfigPath(targetPath) : null),
    [targetPath],
  );

  const activeOutputProviderId = outputProviderId ?? providerId;

  const pending = useMemo(() => {
    if (!describe || !baselineDescribe) return null;
    const descriptions = countDescribeChanges(describe, baselineDescribe);
    const valueCount = countValueChanges(values, baselineValues);
    const total = descriptions + valueCount;
    if (total === 0) return null;
    return { total, descriptions, values: valueCount };
  }, [describe, baselineDescribe, values, baselineValues]);

  useEffect(() => {
    let cancelled = false;
    listProviders()
      .then((result) => {
        if (!cancelled) setProviders(result.providers);
      })
      .catch(() => {
        if (!cancelled) setProviders([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!filePath) {
      setLoading(false);
      setError("No config path in the URL.");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setInfo(null);
    setGenMessage(null);
    setGenError(null);
    setPreview(null);
    setPreviewOpen(false);
    setAddParamOpen(false);
    setHighlightPathKey(null);

    openConfig(filePath)
      .then((result) => {
        if (cancelled) return;
        setTargetPath(result.targetPath);
        setDescribePath(result.describePath);
        setProviderId(result.providerId);
        setProviderLabel(result.providerLabel);
        setOutputProviderId(result.providerId);
        setDescribe(result.describe);
        setBaselineDescribe(cloneDescribe(result.describe));
        setValues(result.values);
        setBaselineValues(cloneValues(result.values));
        setStalePaths(result.stalePaths);
        refreshProjects();
        if (result.createdDescribe) {
          console.info(
            `[setly] Created describe metadata for ${result.providerLabel}: ${result.describePath}`,
          );
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setTargetPath(null);
        setDescribe(null);
        setBaselineDescribe(null);
        setValues({});
        setBaselineValues({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filePath, refreshProjects]);

  function handleValueChange(pathKey: string, value: unknown) {
    setValues((prev) => ({ ...prev, [pathKey]: value }));
    setFieldErrors((prev) => {
      if (!prev[pathKey]) return prev;
      const next = { ...prev };
      delete next[pathKey];
      return next;
    });
  }

  function handleResetField(pathKey: string) {
    if (!describe) return;
    const field = fields.find((f) => f.pathKey === pathKey);
    if (!field) return;
    handleValueChange(pathKey, field.meta.InitialValue);
  }

  function handleResetAll() {
    if (!describe) return;
    setValues(defaultsFromDescribe(describe, stalePaths));
    setFieldErrors({});
  }

  async function persistDescribe(next: DescribeConfig) {
    if (!targetPath) return;
    const result = await saveDescribe(targetPath, next);
    setDescribe(result.describe);
    setBaselineDescribe(cloneDescribe(result.describe));
  }

  function handleMetaChange(path: string[], patch: Partial<FieldMeta>) {
    setDescribe((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        Parameters: updateFieldMetaAtPath(prev.Parameters, path, patch),
      };
    });
  }

  function handleCancelPending() {
    if (!baselineDescribe) return;
    setDescribe(cloneDescribe(baselineDescribe));
    setValues(cloneValues(baselineValues));
    setFieldErrors({});
    setGenError(null);
    setInfo(null);
  }

  async function handleSavePending() {
    if (!targetPath || !describe || !providerId || !baselineDescribe) return;
    const descriptions = countDescribeChanges(describe, baselineDescribe);
    const valueCount = countValueChanges(values, baselineValues);
    if (descriptions === 0 && valueCount === 0) return;

    if (valueCount > 0 && !validate()) {
      setGenError("Fix required fields before saving values.");
      return;
    }

    setSavingEdits(true);
    setGenError(null);
    setGenMessage(null);
    setError(null);
    try {
      if (descriptions > 0) {
        await persistDescribe(describe);
      }
      if (valueCount > 0) {
        const result = await generateConfig(targetPath, values, "overwrite", {
          outputProviderId: providerId,
        });
        setBaselineValues(cloneValues(values));
        setGenMessage(
          descriptions > 0
            ? `Saved describe and ${result.writtenPath ?? result.targetPath}`
            : `Saved ${result.writtenPath ?? result.targetPath}`,
        );
      } else {
        setGenMessage("Describe metadata saved.");
      }
      await refreshProjects();
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingEdits(false);
    }
  }

  async function handleAddParameter(input: {
    path: string;
    label: string;
    type: FieldType;
    description: string;
    required: boolean;
    initialValue: unknown;
    options?: DropdownOption[];
  }) {
    if (!describe || !targetPath) return;
    const path = parseParameterPath(input.path);
    const leafKey = path[path.length - 1]!;
    const meta: FieldMeta = {
      InitialValue: input.initialValue,
      Type: input.type,
      Description: input.description,
      Label: input.label.trim() || leafKey,
      Required: input.required,
      ...(input.type === "dropdown" ? { Options: input.options ?? [] } : {}),
    };
    const nextDescribe: DescribeConfig = {
      ...describe,
      Parameters: insertFieldAtPath(describe.Parameters, path, meta),
    };
    setDescribe(nextDescribe);
    setValues((prev) => ({
      ...prev,
      [path.join(".")]: input.initialValue,
    }));
    setSavingEdits(true);
    try {
      const result = await saveDescribe(targetPath, nextDescribe);
      setDescribe(result.describe);
      setBaselineDescribe(cloneDescribe(result.describe));
      setBaselineValues((prev) => ({
        ...prev,
        [path.join(".")]: input.initialValue,
      }));
      setInfo(`Added ${path.join(".")}`);
      setAddParamOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingEdits(false);
    }
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
    if (!targetPath || !activeOutputProviderId) return;
    setPreviewOpen(true);
    setPreviewError(null);
    setPreview(null);
    try {
      const result = await generateConfig(targetPath, values, "preview", {
        outputProviderId: activeOutputProviderId,
      });
      setPreview(result.text);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : String(err));
    }
  }

  async function runGenerate(action: "overwrite" | "copy" | "write") {
    if (!targetPath || !providerId || !activeOutputProviderId) return;
    if (!validate()) {
      setGenError("Fix required fields before generating.");
      return;
    }
    setGenBusy(true);
    setGenError(null);
    setGenMessage(null);
    try {
      if (action === "write") {
        const defaultName = suggestedOutputName(
          targetPath,
          providerId,
          activeOutputProviderId,
        );
        const selected = await browsePath("save", { defaultName });
        if (!selected) {
          setGenMessage(null);
          return;
        }
        const result = await generateConfig(targetPath, values, "write", {
          outputProviderId: activeOutputProviderId,
          outputPath: selected,
        });
        setPreview(result.text);
        setGenMessage(`Wrote ${result.writtenPath ?? selected}`);
        return;
      }

      const mode = action === "copy" ? "preview" : "overwrite";
      const result = await generateConfig(targetPath, values, mode, {
        outputProviderId: activeOutputProviderId,
      });
      setPreview(result.text);
      if (action === "copy") {
        await navigator.clipboard.writeText(result.text);
        setGenMessage(
          `Copied ${result.outputProviderId} output to clipboard.`,
        );
      } else {
        setGenMessage(`Wrote ${result.writtenPath ?? result.targetPath}`);
        setBaselineValues(cloneValues(values));
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenBusy(false);
    }
  }

  if (!filePath) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <p className="text-sm text-danger">Missing config path.</p>
        <Link to="/" className="mt-3 inline-block text-sm text-accent">
          Back to home
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8 text-sm text-muted">
        Loading configuration…
      </div>
    );
  }

  if (error && !describe) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8 space-y-3">
        <p className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
        <Link to="/" className="inline-block text-sm text-accent">
          Back to home
        </Link>
      </div>
    );
  }

  if (!describe || !targetPath || !providerId || !activeOutputProviderId) {
    return null;
  }

  const fileName = targetPath.split(/[/\\]/).pop() ?? targetPath;
  const outputLabel =
    providers.find((p) => p.id === activeOutputProviderId)?.label ??
    activeOutputProviderId;

  return (
    <div className="relative mx-auto max-w-6xl px-6 pt-8 pb-24">
      <header className="mb-6 max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          Configuration
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            {fileName}
          </h2>
          <PathsInfoButton
            targetPath={targetPath}
            describePath={describePath}
          />
          {savingEdits && (
            <span className="text-[11px] text-muted">Saving…</span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {providerLabel && (
            <span className="rounded-md bg-panel-2 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {providerLabel}
              {providerId ? ` · ${providerId}` : ""}
            </span>
          )}
          {parentProject && (
            <Link
              to={projectHref(parentProject.id)}
              className="text-xs font-medium text-accent hover:underline"
            >
              {parentProject.label}
            </Link>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
        <div className="min-w-0 max-w-3xl flex-1 space-y-4">
          {error && (
            <p className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          {info && !error && (
            <p className="rounded-lg border border-accent/20 bg-accent-soft px-3 py-2 text-sm text-accent">
              {info}
            </p>
          )}

          <section className="rounded-xl border border-line bg-panel p-5 shadow-sm">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted">
                Click labels, descriptions, type, or defaults to edit. Changes
                stay local until you save from the toolbar.
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  className={thinBtn}
                  onClick={() => setAddParamOpen(true)}
                >
                  <IconPlus />
                  Add parameter
                </button>
                <button
                  type="button"
                  className={thinBtn}
                  onClick={handleResetAll}
                >
                  <IconReset />
                  Reset defaults
                </button>
              </div>
            </div>
            <ConfigForm
              parameters={describe.Parameters}
              fields={fields}
              values={values}
              errors={fieldErrors}
              onChange={handleValueChange}
              onResetField={handleResetField}
              onMetaChange={handleMetaChange}
              highlightPathKey={highlightPathKey}
            />
          </section>
        </div>

        <aside className="w-full shrink-0 md:sticky md:top-4 md:w-56 xl:w-64">
          <ConfigOutlineNav
            outline={outline}
            fields={fields}
            values={values}
            onNavigate={(pathKey) => setHighlightPathKey(pathKey)}
          />
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 md:left-72">
        <GenerateActions
          busy={genBusy}
          providers={providers}
          sourceProviderId={providerId}
          outputProviderId={activeOutputProviderId}
          onOutputProviderChange={setOutputProviderId}
          onOverwrite={() => runGenerate("overwrite")}
          onCopy={() => runGenerate("copy")}
          onWriteFile={() => runGenerate("write")}
          onPreview={() => void openPreviewModal()}
          message={genMessage}
          error={genError}
          targetLabel={fileName}
          pending={pending}
          onCancelPending={handleCancelPending}
          onSavePending={() => void handleSavePending()}
          saveBusy={savingEdits}
        />
      </div>

      <Modal
        open={addParamOpen}
        onClose={() => setAddParamOpen(false)}
        title="Add parameter"
      >
        <AddParameterForm
          onAdd={handleAddParameter}
          busy={savingEdits}
          defaultValueForType={defaultValueForType}
        />
      </Modal>

      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`Preview · ${outputLabel}`}
        wide
      >
        <p className="mb-3 text-sm text-muted">
          Generated output for the selected format from current form values.
        </p>
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
