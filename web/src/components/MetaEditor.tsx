import type { FieldMeta, FieldType } from "../api";
import type { FlatField } from "../util";

interface MetaEditorProps {
  fields: FlatField[];
  onChange: (path: string[], patch: Partial<FieldMeta>) => void;
  onSave: () => void;
  saving: boolean;
}

const TYPES: FieldType[] = ["string", "number", "boolean", "json"];

export function MetaEditor({
  fields,
  onChange,
  onSave,
  saving,
}: MetaEditorProps) {
  if (fields.length === 0) {
    return <p className="text-sm text-muted">No fields to describe.</p>;
  }

  return (
    <div>
      <div className="divide-y divide-line">
        {fields.map((field) => {
          const { meta, path, pathKey } = field;
          return (
            <div className="py-5 first:pt-1 last:pb-1" key={pathKey}>
              <div className="mb-3 flex flex-wrap items-baseline gap-x-2">
                <span className="text-[15px] font-semibold text-ink">
                  {meta.Label || pathKey}
                </span>
                <span className="font-mono text-[11px] text-muted">
                  {pathKey}
                </span>
                {field.stale && (
                  <span className="rounded bg-warn-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-warn">
                    stale
                  </span>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    className="mb-1 block text-xs font-medium text-muted"
                    htmlFor={`label-${pathKey}`}
                  >
                    Label
                  </label>
                  <input
                    id={`label-${pathKey}`}
                    className="input"
                    type="text"
                    value={meta.Label}
                    onChange={(e) => onChange(path, { Label: e.target.value })}
                  />
                </div>
                <div>
                  <label
                    className="mb-1 block text-xs font-medium text-muted"
                    htmlFor={`type-${pathKey}`}
                  >
                    Type
                  </label>
                  <select
                    id={`type-${pathKey}`}
                    className="input"
                    value={meta.Type}
                    onChange={(e) =>
                      onChange(path, { Type: e.target.value as FieldType })
                    }
                  >
                    {TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-3">
                <label
                  className="mb-1 block text-xs font-medium text-muted"
                  htmlFor={`desc-${pathKey}`}
                >
                  Description
                </label>
                <textarea
                  id={`desc-${pathKey}`}
                  className="input min-h-20"
                  value={meta.Description}
                  onChange={(e) =>
                    onChange(path, { Description: e.target.value })
                  }
                />
              </div>

              <div className="mt-3">
                <label
                  className="mb-1 block text-xs font-medium text-muted"
                  htmlFor={`initial-${pathKey}`}
                >
                  Default (InitialValue)
                </label>
                {meta.Type === "boolean" ? (
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      id={`initial-${pathKey}`}
                      type="checkbox"
                      className="size-4 rounded border-line text-accent focus:ring-accent"
                      checked={Boolean(meta.InitialValue)}
                      onChange={(e) =>
                        onChange(path, { InitialValue: e.target.checked })
                      }
                    />
                    <span className="text-muted">
                      {Boolean(meta.InitialValue) ? "true" : "false"}
                    </span>
                  </label>
                ) : meta.Type === "number" ? (
                  <input
                    id={`initial-${pathKey}`}
                    className="input max-w-xs"
                    type="number"
                    value={
                      meta.InitialValue === undefined || meta.InitialValue === null
                        ? ""
                        : String(meta.InitialValue)
                    }
                    onChange={(e) =>
                      onChange(path, {
                        InitialValue:
                          e.target.value === "" ? "" : Number(e.target.value),
                      })
                    }
                  />
                ) : meta.Type === "json" ? (
                  <textarea
                    id={`initial-${pathKey}`}
                    className="input min-h-20 font-mono text-[13px]"
                    value={
                      typeof meta.InitialValue === "string"
                        ? meta.InitialValue
                        : JSON.stringify(meta.InitialValue, null, 2) ?? ""
                    }
                    onChange={(e) => {
                      try {
                        onChange(path, {
                          InitialValue: JSON.parse(e.target.value),
                        });
                      } catch {
                        onChange(path, { InitialValue: e.target.value });
                      }
                    }}
                  />
                ) : (
                  <input
                    id={`initial-${pathKey}`}
                    className="input"
                    type="text"
                    value={
                      meta.InitialValue === undefined || meta.InitialValue === null
                        ? ""
                        : String(meta.InitialValue)
                    }
                    onChange={(e) =>
                      onChange(path, { InitialValue: e.target.value })
                    }
                  />
                )}
              </div>

              <label className="mt-3 inline-flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className="size-4 rounded border-line text-accent focus:ring-accent"
                  checked={meta.Required}
                  onChange={(e) =>
                    onChange(path, { Required: e.target.checked })
                  }
                />
                Required field
              </label>
            </div>
          );
        })}
      </div>

      <div className="mt-4 border-t border-line pt-4">
        <button
          className="btn-primary"
          type="button"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save describe-config.json"}
        </button>
      </div>
    </div>
  );
}
