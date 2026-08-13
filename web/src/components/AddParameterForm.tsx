import { useMemo, useState, type FormEvent } from "react";
import type { FieldType } from "../api";

const TYPES: FieldType[] = ["string", "number", "boolean", "json"];

interface AddParameterFormProps {
  busy: boolean;
  onAdd: (input: {
    path: string;
    label: string;
    type: FieldType;
    description: string;
    required: boolean;
    initialValue: unknown;
  }) => Promise<void> | void;
  defaultValueForType: (type: FieldType) => unknown;
}

export function AddParameterForm({
  busy,
  onAdd,
  defaultValueForType,
}: AddParameterFormProps) {
  const [path, setPath] = useState("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("string");
  const [description, setDescription] = useState("");
  const [required, setRequired] = useState(false);
  const [initialRaw, setInitialRaw] = useState("");
  const [error, setError] = useState<string | null>(null);

  const placeholderDefault = useMemo(
    () => String(defaultValueForType(type) ?? ""),
    [defaultValueForType, type],
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      let initialValue: unknown = defaultValueForType(type);
      if (initialRaw.trim() !== "") {
        if (type === "number") {
          const n = Number(initialRaw);
          if (Number.isNaN(n)) throw new Error("Initial value must be a number");
          initialValue = n;
        } else if (type === "boolean") {
          if (initialRaw === "true") initialValue = true;
          else if (initialRaw === "false") initialValue = false;
          else throw new Error('Initial value must be "true" or "false"');
        } else if (type === "json") {
          initialValue = JSON.parse(initialRaw);
        } else {
          initialValue = initialRaw;
        }
      }

      await onAdd({
        path,
        label,
        type,
        description,
        required,
        initialValue,
      });
      setPath("");
      setLabel("");
      setDescription("");
      setRequired(false);
      setInitialRaw("");
      setType("string");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-dashed border-line bg-panel-2/60 p-4"
    >
      <h3 className="text-sm font-semibold text-ink">Add parameter</h3>
      <p className="mt-1 text-xs text-muted">
        Use a dotted path (e.g. <code className="font-mono">Host.Timeout</code>
        ). Saved into describe-config.json.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="add-path">
            Parameter path
          </label>
          <input
            id="add-path"
            className="input font-mono text-[13px]"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="Section.Key"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="add-label">
            Label
          </label>
          <input
            id="add-label"
            className="input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Friendly name"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="add-type">
            Type
          </label>
          <select
            id="add-type"
            className="input"
            value={type}
            onChange={(e) => setType(e.target.value as FieldType)}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="add-desc">
            Description
          </label>
          <input
            id="add-desc"
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="add-initial">
            Default (InitialValue)
          </label>
          <input
            id="add-initial"
            className="input font-mono text-[13px]"
            value={initialRaw}
            onChange={(e) => setInitialRaw(e.target.value)}
            placeholder={placeholderDefault || "(type default)"}
          />
        </div>
      </div>

      <label className="mt-3 inline-flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          className="size-4 rounded border-line text-accent focus:ring-accent"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
        />
        Required
      </label>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <div className="mt-3">
        <button className="btn-primary" type="submit" disabled={busy || !path.trim()}>
          {busy ? "Adding…" : "Add parameter"}
        </button>
      </div>
    </form>
  );
}
