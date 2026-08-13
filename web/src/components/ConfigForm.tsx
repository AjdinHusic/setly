import { useEffect, useRef, useState, type ReactNode } from "react";
import type { DropdownOption, FieldMeta, FieldType, ParameterNode } from "../api";
import { OptionSelect } from "./OptionSelect";
import {
  fieldDomId,
  formatDefaultValue,
  isEmptyValue,
  isFieldMeta,
  sectionDomId,
  valuesEqual,
  type FlatField,
} from "../util";

const FIELD_TYPES: FieldType[] = [
  "string",
  "number",
  "boolean",
  "json",
  "dropdown",
];

interface ConfigFormProps {
  parameters: Record<string, ParameterNode>;
  fields: FlatField[];
  values: Record<string, unknown>;
  errors: Record<string, string>;
  onChange: (pathKey: string, value: unknown) => void;
  onResetField: (pathKey: string) => void;
  onMetaChange: (path: string[], patch: Partial<FieldMeta>) => void;
  highlightPathKey?: string | null;
}

type EditPart = "label" | "description" | "default" | "type" | null;

function IconPencil({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function HoverEditable({
  className,
  editing,
  onEdit,
  display,
  editor,
}: {
  className?: string;
  editing: boolean;
  onEdit: () => void;
  display: ReactNode;
  editor: ReactNode;
}) {
  if (editing) return <div className={className}>{editor}</div>;
  return (
    <div
      role="button"
      tabIndex={0}
      className={`group/meta flex max-w-full cursor-pointer items-start gap-1.5 rounded-md px-1 py-0.5 -mx-1 transition hover:bg-accent-soft/50 focus-visible:bg-accent-soft/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 ${className ?? "w-full"}`}
      title="Click to edit"
      onClick={(e) => {
        e.preventDefault();
        onEdit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit();
        }
      }}
    >
      <span
        className="mt-0.5 hidden size-5 shrink-0 items-center justify-center rounded text-muted group-hover/meta:inline-flex group-focus-visible/meta:inline-flex"
        aria-hidden
      >
        <IconPencil />
      </span>
      <div className="min-w-0 flex-1">{display}</div>
    </div>
  );
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

function OptionsEditor({
  options,
  onChange,
}: {
  options: DropdownOption[];
  onChange: (options: DropdownOption[]) => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-panel px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
          Dropdown options
        </span>
        <button
          type="button"
          className="btn-ghost text-[10px]"
          onClick={() =>
            onChange([...options, { Label: "New option", Value: "" }])
          }
        >
          Add
        </button>
      </div>
      {options.length === 0 ? (
        <p className="text-[11px] text-muted">No options yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {options.map((opt, index) => (
            <li key={index} className="flex flex-wrap items-center gap-1.5">
              <input
                className="input max-w-[8rem] py-1 text-[12px] font-semibold"
                value={opt.Label}
                placeholder="Label"
                onChange={(e) => {
                  onChange(
                    options.map((row, i) =>
                      i === index ? { ...row, Label: e.target.value } : row,
                    ),
                  );
                }}
              />
              <input
                className="input min-w-0 flex-1 py-1 font-mono text-[11px]"
                value={opt.Value}
                placeholder="value"
                onChange={(e) => {
                  onChange(
                    options.map((row, i) =>
                      i === index ? { ...row, Value: e.target.value } : row,
                    ),
                  );
                }}
              />
              <button
                type="button"
                className="btn-ghost text-[10px] text-danger"
                onClick={() => onChange(options.filter((_, i) => i !== index))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FieldRow({
  field,
  value,
  error,
  highlighted,
  onChange,
  onResetField,
  onMetaChange,
}: {
  field: FlatField;
  value: unknown;
  error?: string;
  highlighted: boolean;
  onChange: (pathKey: string, value: unknown) => void;
  onResetField: (pathKey: string) => void;
  onMetaChange: (path: string[], patch: Partial<FieldMeta>) => void;
}) {
  const { meta, path, pathKey } = field;
  const id = fieldDomId(pathKey);
  const missing = meta.Required && isEmptyValue(value);
  const atDefault = valuesEqual(value, meta.InitialValue);
  const [editPart, setEditPart] = useState<EditPart>(null);
  const [draft, setDraft] = useState("");
  const [draftOptions, setDraftOptions] = useState<DropdownOption[]>([]);
  const inputRef = useRef<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
  >(null);

  useEffect(() => {
    if (editPart && editPart !== "type" && inputRef.current) {
      inputRef.current.focus();
      if (
        "select" in inputRef.current &&
        typeof inputRef.current.select === "function"
      ) {
        inputRef.current.select();
      }
    }
  }, [editPart]);

  function startEdit(part: EditPart) {
    if (part === "label") setDraft(meta.Label || "");
    else if (part === "description") setDraft(meta.Description || "");
    else if (part === "default") {
      setDraft(
        meta.Type === "json"
          ? typeof meta.InitialValue === "string"
            ? meta.InitialValue
            : JSON.stringify(meta.InitialValue, null, 2) ?? ""
          : meta.InitialValue === undefined || meta.InitialValue === null
            ? ""
            : String(meta.InitialValue),
      );
    } else if (part === "type") {
      setDraft(meta.Type);
      setDraftOptions(meta.Options ? meta.Options.map((o) => ({ ...o })) : []);
    }
    setEditPart(part);
  }

  function cancelEdit() {
    setEditPart(null);
    setDraft("");
    setDraftOptions([]);
  }

  function commitLabel() {
    const next = draft.trim() || path[path.length - 1]!;
    onMetaChange(path, { Label: next });
    cancelEdit();
  }

  function commitDescription() {
    onMetaChange(path, { Description: draft });
    cancelEdit();
  }

  function commitDefault() {
    let initial: unknown = draft;
    if (meta.Type === "number") {
      initial = draft.trim() === "" ? "" : Number(draft);
      if (draft.trim() !== "" && Number.isNaN(initial)) {
        cancelEdit();
        return;
      }
    } else if (meta.Type === "boolean") {
      initial = draft === "true";
    } else if (meta.Type === "json") {
      try {
        initial = JSON.parse(draft);
      } catch {
        initial = draft;
      }
    }
    onMetaChange(path, { InitialValue: initial });
    cancelEdit();
  }

  function commitType() {
    const next = draft as FieldType;
    const patch: Partial<FieldMeta> = { Type: next };
    if (next === "dropdown") {
      patch.Options = draftOptions;
    }
    onMetaChange(path, patch);
    cancelEdit();
  }

  const defaultDisplay =
    meta.Type === "dropdown" ? (
      (() => {
        const raw = String(meta.InitialValue ?? "");
        if (!raw) {
          return <span className="italic text-muted/70">none</span>;
        }
        const opt = (meta.Options ?? []).find((o) => o.Value === raw);
        return (
          <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
            <span className="font-mono font-medium text-ink/90">{raw}</span>
            {opt?.Label ? (
              <span className="text-muted">({opt.Label})</span>
            ) : (
              <span className="italic text-muted/70">custom</span>
            )}
          </span>
        );
      })()
    ) : (
      <span className="font-medium text-ink/80">
        {formatDefaultValue(meta.InitialValue, meta.Type)}
      </span>
    );

  return (
    <div
      id={`field-${fieldDomId(pathKey)}`}
      data-outline-path={pathKey}
      className={`scroll-mt-24 py-4 ${
        highlighted ? "rounded-lg bg-accent-soft/50 px-3 -mx-1" : ""
      }`}
    >
      <div className="mb-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <HoverEditable
          className="min-w-0 w-auto"
          editing={editPart === "label"}
          onEdit={() => startEdit("label")}
          display={
            <span className="text-[15px] font-semibold tracking-tight text-ink">
              {meta.Label || pathKey}
            </span>
          }
          editor={
            <input
              ref={(el) => {
                inputRef.current = el;
              }}
              className="input py-1 text-[15px] font-semibold"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitLabel();
                if (e.key === "Escape") cancelEdit();
              }}
            />
          }
        />
        <label
          className="font-mono text-[11px] text-muted"
          htmlFor={id}
        >
          {pathKey}
        </label>
        {field.stale && (
          <span className="rounded bg-warn-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warn">
            stale
          </span>
        )}
      </div>

      <div className="mb-3 flex flex-col gap-1.5">
        <HoverEditable
          editing={editPart === "description"}
          onEdit={() => startEdit("description")}
          display={
            meta.Description ? (
              <p className="text-[13px] leading-snug text-muted">
                {meta.Description}
              </p>
            ) : (
              <p className="text-[13px] italic text-muted/70">
                Add description…
              </p>
            )
          }
          editor={
            <textarea
              ref={(el) => {
                inputRef.current = el;
              }}
              className="input min-h-16 text-[13px]"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDescription}
              onKeyDown={(e) => {
                if (e.key === "Escape") cancelEdit();
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  commitDescription();
                }
              }}
            />
          }
        />

        <button
          type="button"
          className={`w-fit rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition ${
            meta.Required
              ? "bg-danger-soft text-danger hover:ring-1 hover:ring-danger/30"
              : "bg-panel-2 text-muted hover:ring-1 hover:ring-line"
          }`}
          title="Click to toggle required"
          onClick={() => onMetaChange(path, { Required: !meta.Required })}
        >
          {meta.Required ? "Required" : "Optional"}
        </button>

        {editPart === "type" ? (
          <div className="space-y-2 rounded-lg border border-accent/30 bg-accent-soft/30 p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="input max-w-[9rem] py-0.5 text-[11px]"
                value={draft}
                onChange={(e) => {
                  const next = e.target.value as FieldType;
                  setDraft(next);
                  if (next === "dropdown" && draftOptions.length === 0) {
                    setDraftOptions([
                      {
                        Label: "Local",
                        Value: "http://localhost:5174",
                      },
                      {
                        Label: "Production",
                        Value: "https://api.example.com",
                      },
                    ]);
                  }
                }}
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-primary px-2 py-1 text-[11px]"
                onClick={commitType}
              >
                Done
              </button>
              <button
                type="button"
                className="btn-ghost text-[11px]"
                onClick={cancelEdit}
              >
                Cancel
              </button>
            </div>
            {draft === "dropdown" && (
              <OptionsEditor
                options={draftOptions}
                onChange={setDraftOptions}
              />
            )}
          </div>
        ) : (
          <HoverEditable
            editing={false}
            onEdit={() => startEdit("type")}
            display={
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
                Type:{" "}
                <span className="rounded-md bg-panel-2 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-ink/80">
                  {meta.Type}
                </span>
              </span>
            }
            editor={null}
          />
        )}

        <HoverEditable
          editing={editPart === "default"}
          onEdit={() => startEdit("default")}
          display={
            <span className="text-[11px] text-muted">
              Default: {defaultDisplay}
            </span>
          }
          editor={
            meta.Type === "boolean" ? (
              <select
                ref={(el) => {
                  inputRef.current = el;
                }}
                className="input max-w-[8rem] py-0.5 text-[11px]"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitDefault}
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : meta.Type === "json" ? (
              <textarea
                ref={(el) => {
                  inputRef.current = el;
                }}
                className="input min-h-16 font-mono text-[12px]"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitDefault}
                onKeyDown={(e) => {
                  if (e.key === "Escape") cancelEdit();
                }}
              />
            ) : meta.Type === "dropdown" ? (
              <OptionSelect
                className="min-w-[14rem] max-w-md"
                value={draft}
                options={meta.Options ?? []}
                allowEmpty
                emptyLabel="No default"
                onChange={(v) => {
                  setDraft(v);
                  onMetaChange(path, { InitialValue: v });
                  cancelEdit();
                }}
              />
            ) : (
              <input
                ref={(el) => {
                  inputRef.current = el;
                }}
                className="input max-w-xs py-0.5 font-mono text-[11px]"
                type={meta.Type === "number" ? "number" : "text"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitDefault}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitDefault();
                  if (e.key === "Escape") cancelEdit();
                }}
              />
            )
          }
        />

        {(missing || !atDefault) && (
          <div className="flex flex-wrap items-center gap-2 px-1">
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
        <OptionSelect
          id={id}
          value={displayValue(value, "string")}
          options={meta.Options ?? []}
          placeholder="Choose an option"
          onChange={(v) => onChange(pathKey, v)}
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
  onMetaChange,
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
  onMetaChange: (path: string[], patch: Partial<FieldMeta>) => void;
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
              onMetaChange={onMetaChange}
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
                ? "scroll-mt-24 overflow-visible rounded-xl border border-line bg-panel-2/40"
                : "scroll-mt-24 mt-3 overflow-visible border-l-2 border-line/80 pl-4"
            }
          >
            <header
              className={
                isTop
                  ? "rounded-t-xl border-b border-line bg-panel px-4 py-3"
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
                onMetaChange={onMetaChange}
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
  onMetaChange,
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
      onMetaChange={onMetaChange}
    />
  );
}
