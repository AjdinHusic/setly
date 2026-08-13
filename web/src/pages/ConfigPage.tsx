import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import {
  generateConfig,
  openConfig,
  saveDescribe,
  type DescribeConfig,
  type FieldMeta,
  type FieldType,
  type ProviderId,
} from "../api";
import type { AppOutletContext } from "../components/AppLayout";
import { AddParameterForm } from "../components/AddParameterForm";
import { ConfigForm } from "../components/ConfigForm";
import { PathInfo } from "../components/FilePicker";
import { GenerateActions } from "../components/GenerateActions";
import { MetaEditor } from "../components/MetaEditor";
import { MissingFieldsBar } from "../components/MissingFieldsBar";
import {
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

type Tab = "configure" | "describe" | "preview";

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
  const [describe, setDescribe] = useState<DescribeConfig | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [stalePaths, setStalePaths] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("configure");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savingMeta, setSavingMeta] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [genMessage, setGenMessage] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [highlightPathKey, setHighlightPathKey] = useState<string | null>(
    null,
  );

  const fields = useMemo(() => {
    if (!describe) return [];
    return flattenParameters(describe.Parameters, [], new Set(stalePaths));
  }, [describe, stalePaths]);

  const parentProject = useMemo(
    () => (targetPath ? findProjectForConfigPath(targetPath) : null),
    [targetPath],
  );

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
    setHighlightPathKey(null);
    setTab("configure");

    openConfig(filePath)
      .then((result) => {
        if (cancelled) return;
        setTargetPath(result.targetPath);
        setDescribePath(result.describePath);
        setProviderId(result.providerId);
        setProviderLabel(result.providerLabel);
        setDescribe(result.describe);
        setValues(result.values);
        setStalePaths(result.stalePaths);
        refreshProjects();
        setInfo(
          result.createdDescribe
            ? `Created describe metadata for ${result.providerLabel}.`
            : `Loaded existing describe metadata (${result.providerLabel}).`,
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setTargetPath(null);
        setDescribe(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filePath, refreshProjects]);

  useEffect(() => {
    if (tab !== "preview" || !targetPath || !describe) return;
    let cancelled = false;
    setPreviewError(null);
    generateConfig(targetPath, values, "preview")
      .then((result) => {
        if (!cancelled) setPreview(result.text);
      })
      .catch((err) => {
        if (!cancelled) {
          setPreview(null);
          setPreviewError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tab, targetPath, values, describe]);

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

  function handleMetaChange(path: string[], patch: Partial<FieldMeta>) {
    setDescribe((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        Parameters: updateFieldMetaAtPath(prev.Parameters, path, patch),
      };
    });
  }

  async function handleSaveDescribe() {
    if (!targetPath || !describe) return;
    setSavingMeta(true);
    setError(null);
    try {
      const result = await saveDescribe(targetPath, describe);
      setDescribe(result.describe);
      setInfo(`Saved ${result.describePath}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingMeta(false);
    }
  }

  async function handleAddParameter(input: {
    path: string;
    label: string;
    type: FieldType;
    description: string;
    required: boolean;
    initialValue: unknown;
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
    setSavingMeta(true);
    try {
      const result = await saveDescribe(targetPath, nextDescribe);
      setDescribe(result.describe);
      setInfo(`Added ${path.join(".")} and saved describe-config.json`);
      setTab("describe");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingMeta(false);
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

  async function runGenerate(copy?: boolean) {
    if (!targetPath) return;
    if (!validate()) {
      setTab("configure");
      setGenError("Fix required fields before generating.");
      return;
    }
    setGenBusy(true);
    setGenError(null);
    setGenMessage(null);
    try {
      const mode = copy ? "preview" : "overwrite";
      const result = await generateConfig(targetPath, values, mode);
      setPreview(result.text);
      if (copy) {
        await navigator.clipboard.writeText(result.text);
        setGenMessage("Copied config to clipboard.");
      } else {
        setGenMessage(`Wrote ${result.targetPath}`);
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

  if (!describe || !targetPath) return null;

  const fileName = targetPath.split(/[/\\]/).pop() ?? targetPath;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 pb-16">
      <header className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          Configuration
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
          {fileName}
        </h2>
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

      <div className="space-y-4">
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

        <PathInfo targetPath={targetPath} describePath={describePath} />

        {tab === "configure" && (
          <MissingFieldsBar
            fields={fields}
            values={values}
            onGoToNext={(pathKey) => {
              setHighlightPathKey(pathKey);
              setTab("configure");
            }}
          />
        )}

        <section className="rounded-xl border border-line bg-panel p-5 shadow-sm">
          <div className="mb-4 flex gap-1 border-b border-line">
            {(
              [
                ["configure", "Configure"],
                ["describe", "Describe"],
                ["preview", "Preview"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
                  tab === id
                    ? "border-accent text-ink"
                    : "border-transparent text-muted hover:text-ink"
                }`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "configure" && (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted">
                  Defaults come from describe-config InitialValue.
                </p>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleResetAll}
                >
                  Reset all to defaults
                </button>
              </div>
              <ConfigForm
                fields={fields}
                values={values}
                errors={fieldErrors}
                onChange={handleValueChange}
                onResetField={handleResetField}
                highlightPathKey={highlightPathKey}
              />
            </>
          )}

          {tab === "describe" && (
            <div className="space-y-6">
              <AddParameterForm
                onAdd={handleAddParameter}
                busy={savingMeta}
                defaultValueForType={defaultValueForType}
              />
              <MetaEditor
                fields={fields}
                onChange={handleMetaChange}
                onSave={handleSaveDescribe}
                saving={savingMeta}
              />
            </div>
          )}

          {tab === "preview" && (
            <div>
              <p className="mb-3 text-sm text-muted">
                Live preview of the file that would be generated from the current
                form values.
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
            </div>
          )}
        </section>

        <GenerateActions
          busy={genBusy}
          onOverwrite={() => runGenerate(false)}
          onCopy={() => runGenerate(true)}
          message={genMessage}
          error={genError}
          targetLabel={fileName}
        />
      </div>
    </div>
  );
}
