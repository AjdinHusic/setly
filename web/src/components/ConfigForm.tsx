import {
  fieldDomId,
  formatDefaultValue,
  isEmptyValue,
  valuesEqual,
  type FlatField,
} from "../util";

interface ConfigFormProps {
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

export function ConfigForm({
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

  return (
    <div className="divide-y divide-line">
      {fields.map((field) => {
        const { meta, pathKey } = field;
        const value = values[pathKey];
        const id = fieldDomId(pathKey);
        const missing = meta.Required && isEmptyValue(value);
        const highlighted = highlightPathKey === pathKey;
        const atDefault = valuesEqual(value, meta.InitialValue);

        return (
          <div
            key={pathKey}
            id={`field-${fieldDomId(pathKey)}`}
            className={`scroll-mt-28 py-5 first:pt-1 last:pb-1 ${
              highlighted ? "rounded-lg bg-accent-soft/40 px-3 -mx-3" : ""
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
            ) : (
              <input
                id={id}
                className="input"
                type="text"
                value={displayValue(value, meta.Type)}
                onChange={(e) => onChange(pathKey, e.target.value)}
              />
            )}

            {errors[pathKey] && (
              <p className="mt-2 text-sm text-danger">{errors[pathKey]}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
