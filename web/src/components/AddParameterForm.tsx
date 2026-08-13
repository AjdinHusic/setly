import { useMemo, useState, type FormEvent } from "react";
import type { DropdownOption, FieldType, ScalarFieldType } from "../api";
import { OptionSelect } from "./OptionSelect";

const TYPES: FieldType[] = [
  "string",
  "number",
  "boolean",
  "json",
  "dropdown",
  "list",
];
const LIST_ITEM_TYPES: ScalarFieldType[] = ["string", "number", "boolean"];

interface AddParameterFormProps {
  busy: boolean;
  /** When "env", ask for KEY instead of dotted path. */
  mode?: "path" | "env";
  /** Shown in env-mode help text. */
  separator?: string;
  onAdd: (input: {
    path: string;
    label: string;
    type: FieldType;
    description: string;
    required: boolean;
    initialValue: unknown;
    options?: DropdownOption[];
    itemType?: ScalarFieldType;
  }) => Promise<void> | void;
  defaultValueForType: (type: FieldType) => unknown;
}

export function AddParameterForm({
  busy,
  mode = "path",
  separator = "_",
  onAdd,
  defaultValueForType,
}: AddParameterFormProps) {
  const [path, setPath] = useState("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("string");
  const [itemType, setItemType] = useState<ScalarFieldType>("string");
  const [description, setDescription] = useState("");
  const [required, setRequired] = useState(false);
  const [initialRaw, setInitialRaw] = useState("");
  const [options, setOptions] = useState<DropdownOption[]>([
    { Label: "Local", Value: "http://localhost:5174" },
    { Label: "Production", Value: "https://api.example.com" },
  ]);
  const [error, setError] = useState<string | null>(null);

  const isEnv = mode === "env";
  const placeholderDefault = useMemo(
    () => String(defaultValueForType(type) ?? ""),
    [defaultValueForType, type],
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      let initialValue: unknown = defaultValueForType(type);
      if (type === "dropdown") {
        if (options.length === 0) {
          throw new Error("Add at least one dropdown option");
        }
        initialValue =
          initialRaw.trim() !== ""
            ? initialRaw
            : (options[0]?.Value ?? "");
      } else if (type === "list") {
        if (initialRaw.trim() !== "") {
          const parsed = JSON.parse(initialRaw) as unknown;
          if (!Array.isArray(parsed)) {
            throw new Error("List default must be a JSON array");
          }
          initialValue = parsed;
        } else {
          initialValue = [];
        }
      } else if (initialRaw.trim() !== "") {
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
        options: type === "dropdown" ? options : undefined,
        itemType: type === "list" ? itemType : undefined,
      });
      setPath("");
      setLabel("");
      setDescription("");
      setRequired(false);
      setInitialRaw("");
      setType("string");
      setOptions([
        { Label: "Local", Value: "http://localhost:5174" },
        { Label: "Production", Value: "https://api.example.com" },
      ]);
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
        {isEnv ? (
          <>
            Enter the environment variable key (e.g.{" "}
            <code className="font-mono">
              HOST{separator}NAME
            </code>
            ). Nesting uses separator{" "}
            <code className="font-mono">{separator}</code>.
          </>
        ) : (
          <>
            Use a dotted path (e.g.{" "}
            <code className="font-mono">Host.Timeout</code>). Saved into
            describe-config.json.
          </>
        )}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label
            className="mb-1 block text-xs font-medium text-muted"
            htmlFor="add-path"
          >
            {isEnv ? "Key" : "Parameter path"}
          </label>
          <input
            id="add-path"
            className="input font-mono text-[13px]"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder={isEnv ? `HOST${separator}NAME` : "Section.Key"}
            required
          />
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-medium text-muted"
            htmlFor="add-label"
          >
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
          <label
            className="mb-1 block text-xs font-medium text-muted"
            htmlFor="add-type"
          >
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
                {t === "list" ? "list<…>" : t}
              </option>
            ))}
          </select>
        </div>
        {type === "list" && (
          <div>
            <label
              className="mb-1 block text-xs font-medium text-muted"
              htmlFor="add-item-type"
            >
              List item type
            </label>
            <select
              id="add-item-type"
              className="input"
              value={itemType}
              onChange={(e) => setItemType(e.target.value as ScalarFieldType)}
            >
              {LIST_ITEM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="sm:col-span-2">
          <label
            className="mb-1 block text-xs font-medium text-muted"
            htmlFor="add-desc"
          >
            Description
          </label>
          <input
            id="add-desc"
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        {type === "dropdown" ? (
          <div className="sm:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted">Options</span>
              <button
                type="button"
                className="btn-ghost text-[11px]"
                onClick={() =>
                  setOptions((prev) => [
                    ...prev,
                    { Label: "OPTION", Value: "" },
                  ])
                }
              >
                Add option
              </button>
            </div>
            {options.map((opt, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <input
                  className="input max-w-[8rem] text-[12px] font-semibold"
                  value={opt.Label}
                  placeholder="Label"
                  onChange={(e) =>
                    setOptions((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, Label: e.target.value } : row,
                      ),
                    )
                  }
                />
                <input
                  className="input min-w-0 flex-1 font-mono text-[12px]"
                  value={opt.Value}
                  placeholder="value"
                  onChange={(e) =>
                    setOptions((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, Value: e.target.value } : row,
                      ),
                    )
                  }
                />
                <button
                  type="button"
                  className="btn-ghost text-[11px] text-danger"
                  onClick={() =>
                    setOptions((prev) => prev.filter((_, i) => i !== index))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <div>
              <label
                className="mb-1 block text-xs font-medium text-muted"
                htmlFor="add-initial"
              >
                Default value
              </label>
              <OptionSelect
                id="add-initial"
                value={initialRaw || options[0]?.Value || ""}
                options={options}
                onChange={setInitialRaw}
              />
            </div>
          </div>
        ) : (
          <div className="sm:col-span-2">
            <label
              className="mb-1 block text-xs font-medium text-muted"
              htmlFor="add-initial"
            >
              Default (InitialValue)
            </label>
            <input
              id="add-initial"
              className="input font-mono text-[13px]"
              value={initialRaw}
              onChange={(e) => setInitialRaw(e.target.value)}
              placeholder={
                type === "list"
                  ? '["a","b"]'
                  : placeholderDefault || "(type default)"
              }
            />
          </div>
        )}
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
        <button
          className="btn-primary"
          type="submit"
          disabled={busy || !path.trim()}
        >
          {busy ? "Adding…" : "Add parameter"}
        </button>
      </div>
    </form>
  );
}
