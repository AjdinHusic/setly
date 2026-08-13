import type { ParameterNode } from "../api";
import {
  fieldDomId,
  formatDefaultValue,
  isEmptyValue,
  isFieldMeta,
  sectionDomId,
  valuesEqual,
  type FlatField,
} from "../util";

interface ConfigFormProps {
  parameters: Record<string, ParameterNode>;
  fields: FlatField[];
  values: Record<string, unknown>;
  errors: Record<string, string>;
  onChange: (pathKey: string, value: unknown) => void;
  onResetField: (pathKey: string) => void;
  highlightPathKey?: string | null;
}

function displayValue(value: unknown, type: string): string {
  if (type === "json") {
    return typeof value === "string"
      ? value
      : (JSON.stringify(value, null, 2) ?? "");
  }
  if (value === undefined || value === null) return "";
  return String(value);
}

function FieldRow({
  field,
  value,
  error,
  highlighted,
  onChange,
  onResetField,
}: {
  field: FlatField;
  value: unknown;
  error?: string;
  highlighted: boolean;
  onChange: (pathKey: string, value: unknown) => void;
  onResetField: (pathKey: string) => void;
}) {
  const { meta, pathKey } = field;
  const id = fieldDomId(pathKey);
  const missing = meta.Required && isEmptyValue(value);
  const atDefault = valuesEqual(value, meta.InitialValue);

  return (
    <div
      id={`field-${fieldDomId(pathKey)}`}
      data-outline-path={pathKey}
      className={`scroll-mt-24 py-4 ${
        highlighted ? "rounded-lg bg-accent-soft/50 px-3 -mx-1" : ""
      }`}
    >
      <div className="mb-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <label
          className="text-[15px] font-semibold tracking-tight text-ink"
          htmlFor={id}
        >
          {meta.Label || pathKey}
        </label>
        <span className="font-mono text-[11px] text-muted">{pathKey}</span>
        {field.stale && (
          <span className="rounded bg-warn-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warn">
            stale
          </span>
        )}
      </div>

      {meta.Description ? (
        <p className="mb-2 mt-0.5 text-[13px] leading-snug text-muted">
          {meta.Description}
        </p>
      ) : (
        <div className="mb-2" />
      )}

      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        {meta.Required ? (
          <span className="rounded-md bg-danger-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-danger">
            Required
          </span>
        ) : (
          <span className="rounded-md bg-panel-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
            Optional
          </span>
        )}
        <span className="font-mono text-[11px] text-muted">
          Default:{" "}
          <span className="text-ink/80">
            {formatDefaultValue(meta.InitialValue, meta.Type)}
          </span>
        </span>
        {missing && (
          <span className="text-[11px] font-medium text-danger">
            Value missing
          </span>
        )}
        {!atDefault && (
          <button
            type="button"
            className="btn-ghost text-[11px]"
            onClick={() => onResetField(pathKey)}
          >
            Reset to default
          </button>
        )}
      </div>

      {meta.Type === "boolean" ? (
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            id={id}
            type="checkbox"
            className="size-4 rounded border-line text-accent focus:ring-accent"
            checked={Boolean(value)}
            onChange={(e) => onChange(pathKey, e.target.checked)}
          />
          <span className="text-muted">
            {Boolean(value) ? "true" : "false"}
          </span>
        </label>
      ) : meta.Type === "number" ? (
        <input
          id={id}
          className="input max-w-xs"
          type="number"
          value={displayValue(value, meta.Type)}
          onChange={(e) =>
            onChange(
              pathKey,
              e.target.value === "" ? "" : Number(e.target.value),
            )
          }
        />
      ) : meta.Type === "json" ? (
        <textarea
          id={id}
          className="input min-h-24 font-mono text-[13px]"
          value={displayValue(value, meta.Type)}
          onChange={(e) => onChange(pathKey, e.target.value)}
        />
      ) : meta.Type === "dropdown" ? (
        <select
          id={id}
          className="input max-w-md"
          value={displayValue(value, "string")}
          onChange={(e) => onChange(pathKey, e.target.value)}
        >
          {(meta.Options ?? []).length === 0 && (
            <option value="">No options configured</option>
          )}
          {(meta.Options ?? []).map((opt) => (
            <option key={`${opt.Label}:${opt.Value}`} value={opt.Value}>
              [{opt.Label}] {opt.Value}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          className="input"
          type="text"
          value={displayValue(value, meta.Type)}
          onChange={(e) => onChange(pathKey, e.target.value)}
        />
      )}

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

function ParameterTree({
  parameters,
  prefix,
  depth,
  fieldByKey,
  values,
  errors,
  highlightPathKey,
  onChange,
  onResetField,
}: {
  parameters: Record<string, ParameterNode>;
  prefix: string[];
  depth: number;
  fieldByKey: Map<string, FlatField>;
  values: Record<string, unknown>;
  errors: Record<string, string>;
  highlightPathKey?: string | null;
  onChange: (pathKey: string, value: unknown) => void;
  onResetField: (pathKey: string) => void;
}) {
  const entries = Object.entries(parameters);

  return (
    <div className={depth === 0 ? "space-y-6" : "space-y-1"}>
      {entries.map(([key, node]) => {
        const path = [...prefix, key];
        const pathKey = path.join(".");

        if (isFieldMeta(node)) {
          const field = fieldByKey.get(pathKey);
          if (!field) return null;
          return (
            <FieldRow
              key={pathKey}
              field={field}
              value={values[pathKey]}
              error={errors[pathKey]}
              highlighted={highlightPathKey === pathKey}
              onChange={onChange}
              onResetField={onResetField}
            />
          );
        }

        const isTop = depth === 0;
        return (
          <section
            key={pathKey}
            id={`section-${sectionDomId(pathKey)}`}
            data-outline-path={pathKey}
            className={
              isTop
                ? "scroll-mt-24 overflow-hidden rounded-xl border border-line bg-panel-2/40"
                : "scroll-mt-24 mt-3 border-l-2 border-line/80 pl-4"
            }
          >
            <header
              className={
                isTop
                  ? "border-b border-line bg-panel px-4 py-3"
                  : "mb-1 pt-2"
              }
            >
              <p
                className={
                  isTop
                    ? "text-[11px] font-semibold uppercase tracking-[0.14em] text-muted"
                    : "text-[11px] font-semibold uppercase tracking-[0.1em] text-muted"
                }
              >
                {isTop ? "Section" : "Subsection"}
              </p>
              <h3
                className={
                  isTop
                    ? "mt-0.5 text-base font-semibold tracking-tight text-ink"
                    : "text-sm font-semibold text-ink"
                }
              >
                {key}
              </h3>
              <p className="mt-0.5 font-mono text-[10px] text-muted">
                {pathKey}
              </p>
            </header>
            <div className={isTop ? "space-y-1 px-4 py-1" : "space-y-1"}>
              <ParameterTree
                parameters={node as Record<string, ParameterNode>}
                prefix={path}
                depth={depth + 1}
                fieldByKey={fieldByKey}
                values={values}
                errors={errors}
                highlightPathKey={highlightPathKey}
                onChange={onChange}
                onResetField={onResetField}
              />
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function ConfigForm({
  parameters,
  fields,
  values,
  errors,
  onChange,
  onResetField,
  highlightPathKey,
}: ConfigFormProps) {
  if (fields.length === 0) {
    return <p className="text-sm text-muted">No configurable fields found.</p>;
  }

  const fieldByKey = new Map(fields.map((f) => [f.pathKey, f]));

  return (
    <ParameterTree
      parameters={parameters}
      prefix={[]}
      depth={0}
      fieldByKey={fieldByKey}
      values={values}
      errors={errors}
      highlightPathKey={highlightPathKey}
      onChange={onChange}
      onResetField={onResetField}
    />
  );
}
