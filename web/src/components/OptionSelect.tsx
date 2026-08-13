import { useEffect, useId, useRef, useState } from "react";
import type { DropdownOption } from "../api";

interface OptionSelectProps {
  id?: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  /** Allow typing a value that is not in the option list. */
  allowCustom?: boolean;
}

function Chevron({ open }: { open: boolean }) {
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
      className={`shrink-0 text-muted transition ${open ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** Styled dropdown: label primary, value secondary — supports optional custom typing. */
export function OptionSelect({
  id,
  value,
  options,
  onChange,
  placeholder = "Select an option",
  disabled,
  className,
  allowEmpty,
  emptyLabel = "None",
  allowCustom = true,
}: OptionSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryRef = useRef("");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.Value === value) ?? null;
  const isCustom = value !== "" && !selected;

  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const allowCustomRef = useRef(allowCustom);
  onChangeRef.current = onChange;
  valueRef.current = value;
  allowCustomRef.current = allowCustom;

  function updateQuery(next: string) {
    queryRef.current = next;
    setQuery(next);
  }

  function commitTyped() {
    if (!allowCustomRef.current) return;
    const next = queryRef.current.trim();
    if (next !== "" && next !== valueRef.current) onChangeRef.current(next);
  }

  function close(commit: boolean) {
    if (commit) commitTyped();
    updateQuery("");
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close(true);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(next: string) {
    onChange(next);
    updateQuery("");
    setOpen(false);
  }

  function openMenu(seed?: string) {
    setOpen(true);
    if (allowCustom) {
      updateQuery(seed ?? "");
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  const q = query.trim().toLowerCase();
  const filtered =
    q === ""
      ? options
      : options.filter(
          (o) =>
            o.Label.toLowerCase().includes(q) ||
            o.Value.toLowerCase().includes(q),
        );

  const showCustomHint =
    allowCustom &&
    open &&
    query.trim() !== "" &&
    !options.some((o) => o.Value === query.trim());

  return (
    <div
      ref={rootRef}
      className={`relative ${open ? "z-50" : "z-0"} ${className ?? "max-w-md"}`}
    >
      <div
        className={`flex w-full items-center gap-2 rounded-md border border-line bg-panel px-2.5 py-1 text-left shadow-sm outline-none transition ${
          open
            ? "border-accent ring-2 ring-accent/20"
            : "hover:border-accent/40"
        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <div className="min-w-0 flex-1">
          {open && allowCustom ? (
            <input
              ref={inputRef}
              id={id}
              type="text"
              disabled={disabled}
              className="w-full bg-transparent text-[13px] leading-snug text-ink outline-none placeholder:text-muted/70"
              placeholder={
                selected ? `${selected.Label} · ${selected.Value}` : placeholder
              }
              value={query}
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={listId}
              onChange={(e) => updateQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const trimmed = query.trim();
                  if (trimmed) pick(trimmed);
                  else close(false);
                }
              }}
            />
          ) : selected ? (
            <button
              id={id}
              type="button"
              disabled={disabled}
              className="w-full py-0.5 text-left outline-none"
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => openMenu("")}
            >
              <div className="truncate text-[13px] font-semibold leading-tight text-ink">
                {selected.Label}
              </div>
              <div className="truncate font-mono text-[10px] leading-tight text-muted">
                {selected.Value}
              </div>
            </button>
          ) : (
            <button
              id={id}
              type="button"
              disabled={disabled}
              className="w-full py-0.5 text-left outline-none"
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => openMenu(isCustom ? value : "")}
            >
              {isCustom ? (
                <div className="truncate font-mono text-[13px] leading-snug text-ink">
                  {value}
                </div>
              ) : (
                <div className="text-[13px] leading-snug text-muted">
                  {placeholder}
                </div>
              )}
            </button>
          )}
        </div>
        <button
          type="button"
          disabled={disabled}
          className="shrink-0 rounded p-0.5 text-muted outline-none hover:bg-panel-2"
          aria-label={open ? "Close options" : "Open options"}
          onClick={() => {
            if (open) close(true);
            else openMenu(isCustom ? value : "");
          }}
        >
          <Chevron open={open} />
        </button>
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-auto rounded-md border border-line bg-panel py-1 shadow-lg"
        >
          {allowEmpty && (
            <li role="option" aria-selected={!selected && value === ""}>
              <button
                type="button"
                className={`flex w-full flex-col gap-0.5 px-2.5 py-1.5 text-left transition hover:bg-accent-soft/60 ${
                  !selected && value === "" ? "bg-accent-soft/40" : ""
                }`}
                onClick={() => pick("")}
              >
                <span className="text-[13px] text-muted">{emptyLabel}</span>
              </button>
            </li>
          )}
          {filtered.length === 0 && !showCustomHint && !allowEmpty && (
            <li className="px-2.5 py-2 text-[13px] text-muted">
              No options yet
            </li>
          )}
          {filtered.map((opt) => {
            const active = opt.Value === value;
            return (
              <li
                key={`${opt.Label}:${opt.Value}`}
                role="option"
                aria-selected={active}
              >
                <button
                  type="button"
                  className={`flex w-full flex-col gap-0.5 px-2.5 py-1.5 text-left transition hover:bg-accent-soft/60 ${
                    active ? "bg-accent-soft/50" : ""
                  }`}
                  onClick={() => pick(opt.Value)}
                >
                  <span className="text-[13px] font-semibold leading-tight text-ink">
                    {opt.Label || "Untitled"}
                  </span>
                  <span className="font-mono text-[10px] leading-snug text-muted">
                    {opt.Value || "—"}
                  </span>
                </button>
              </li>
            );
          })}
          {showCustomHint && (
            <li role="option" aria-selected={false}>
              <button
                type="button"
                className="flex w-full flex-col gap-0.5 border-t border-line px-2.5 py-1.5 text-left transition hover:bg-accent-soft/60"
                onClick={() => pick(query.trim())}
              >
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
                  Use custom value
                </span>
                <span className="font-mono text-[13px] text-ink">
                  {query.trim()}
                </span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
