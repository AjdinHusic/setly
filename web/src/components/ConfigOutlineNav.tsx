import { useEffect, useMemo, useRef, useState } from "react";
import {
  displayFieldKey,
  fieldDomId,
  getScrollParent,
  isEmptyValue,
  scrollToConfigTarget,
  sectionDomId,
  type FlatField,
  type OutlineEntry,
} from "../util";

interface ConfigOutlineNavProps {
  outline: OutlineEntry[];
  fields: FlatField[];
  values: Record<string, unknown>;
  onNavigate: (pathKey: string) => void;
  keySeparator?: string | null;
}

function collectFieldKeys(entries: OutlineEntry[]): string[] {
  const keys: string[] = [];
  for (const entry of entries) {
    if (entry.kind === "field") keys.push(entry.pathKey);
    else keys.push(...collectFieldKeys(entry.children));
  }
  return keys;
}

function collectSectionKeys(entries: OutlineEntry[]): string[] {
  const keys: string[] = [];
  for (const entry of entries) {
    if (entry.kind === "section") {
      keys.push(entry.pathKey);
      keys.push(...collectSectionKeys(entry.children));
    }
  }
  return keys;
}

function scrollChildIntoContainer(
  container: HTMLElement,
  child: HTMLElement,
) {
  const cRect = container.getBoundingClientRect();
  const childRect = child.getBoundingClientRect();
  if (childRect.top < cRect.top) {
    container.scrollTop -= cRect.top - childRect.top + 4;
  } else if (childRect.bottom > cRect.bottom) {
    container.scrollTop += childRect.bottom - cRect.bottom + 4;
  }
}

export function ConfigOutlineNav({
  outline,
  fields,
  values,
  onNavigate,
  keySeparator,
}: ConfigOutlineNavProps) {
  const rootRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [activePathKey, setActivePathKey] = useState<string | null>(null);
  const fieldByKey = useMemo(
    () => new Map(fields.map((f) => [f.pathKey, f])),
    [fields],
  );

  const requiredMissing = useMemo(
    () =>
      fields.filter(
        (f) => f.meta.Required && isEmptyValue(values[f.pathKey]),
      ),
    [fields, values],
  );

  const fieldKeys = useMemo(() => collectFieldKeys(outline), [outline]);
  const sectionKeys = useMemo(() => collectSectionKeys(outline), [outline]);

  useEffect(() => {
    if (fieldKeys.length === 0) return;

    const targets = [
      ...sectionKeys.map((key) => ({
        key,
        el: document.getElementById(`section-${sectionDomId(key)}`),
      })),
      ...fieldKeys.map((key) => ({
        key,
        el: document.getElementById(`field-${fieldDomId(key)}`),
      })),
    ].filter((t): t is { key: string; el: HTMLElement } => t.el != null);

    if (targets.length === 0) return;

    const scrollRoot =
      getScrollParent(targets[0]!.el) ?? getScrollParent(rootRef.current);

    function pickActive() {
      const rootTop =
        scrollRoot instanceof HTMLElement
          ? scrollRoot.getBoundingClientRect().top
          : 0;
      const marker = rootTop + 110;

      let chosen: string | null = null;
      let chosenTop = -Infinity;
      for (const { key, el } of targets) {
        const top = el.getBoundingClientRect().top;
        if (top <= marker && top >= chosenTop) {
          chosenTop = top;
          chosen = key;
        }
      }
      if (!chosen) chosen = targets[0]?.key ?? null;
      setActivePathKey((prev) => (prev === chosen ? prev : chosen));
    }

    pickActive();
    const root: HTMLElement | Window = scrollRoot ?? window;
    root.addEventListener("scroll", pickActive, { passive: true });
    window.addEventListener("resize", pickActive);
    return () => {
      root.removeEventListener("scroll", pickActive);
      window.removeEventListener("resize", pickActive);
    };
  }, [fieldKeys, sectionKeys]);

  useEffect(() => {
    if (!activePathKey || !listRef.current || !rootRef.current) return;
    const item = rootRef.current.querySelector(
      `[data-outline-key="${CSS.escape(activePathKey)}"]`,
    );
    if (item instanceof HTMLElement) {
      scrollChildIntoContainer(listRef.current, item);
    }
  }, [activePathKey]);

  function handleClick(pathKey: string, kind: "field" | "section") {
    onNavigate(pathKey);
    setActivePathKey(pathKey);
    // Defer so highlight/layout settles before scrolling the main pane
    window.requestAnimationFrame(() => {
      scrollToConfigTarget(pathKey, kind);
    });
  }

  function goToNextMissing() {
    const next = requiredMissing[0];
    if (!next) return;
    handleClick(next.pathKey, "field");
  }

  function renderEntries(entries: OutlineEntry[], depth: number) {
    return entries.map((entry, index) => {
      if (entry.kind === "section") {
        const active = activePathKey === entry.pathKey;
        const childHasActive =
          activePathKey != null &&
          activePathKey.startsWith(`${entry.pathKey}.`);
        return (
          <div
            key={entry.pathKey}
            className={index > 0 ? "mt-3 border-t border-line pt-3" : undefined}
          >
            <button
              type="button"
              data-outline-key={entry.pathKey}
              onClick={() => handleClick(entry.pathKey, "section")}
              className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] transition ${
                active
                  ? "bg-accent-soft text-accent"
                  : childHasActive
                    ? "text-ink"
                    : "text-muted hover:bg-panel-2 hover:text-ink"
              }`}
              style={{ paddingLeft: `${8 + depth * 10}px` }}
            >
              {entry.label}
            </button>
            <div className="mt-0.5 space-y-0.5">
              {renderEntries(entry.children, depth + 1)}
            </div>
          </div>
        );
      }

      const field = fieldByKey.get(entry.pathKey);
      const missingRequired =
        field?.meta.Required === true &&
        isEmptyValue(values[entry.pathKey]);
      const active = activePathKey === entry.pathKey;

      return (
        <button
          key={entry.pathKey}
          type="button"
          data-outline-key={entry.pathKey}
          onClick={() => handleClick(entry.pathKey, "field")}
          className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left transition ${
            active
              ? "bg-accent-soft text-accent"
              : "text-muted hover:bg-panel-2 hover:text-ink"
          }`}
          style={{ paddingLeft: `${8 + depth * 10}px` }}
          title={entry.label}
        >
          <span
            className={`size-1.5 shrink-0 rounded-full ${
              missingRequired
                ? "bg-danger"
                : active
                  ? "bg-accent"
                  : "bg-transparent"
            }`}
            aria-hidden
          />
          <span className="min-w-0 truncate font-mono text-[11px] leading-snug">
            {displayFieldKey(entry.path, { separator: keySeparator })}
          </span>
        </button>
      );
    });
  }

  if (outline.length === 0) {
    return null;
  }

  return (
    <nav
      ref={rootRef}
      aria-label="Configuration outline"
      className="rounded-xl border border-line bg-panel shadow-sm"
    >
      <div className="border-b border-line px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
          On this page
        </p>
        {requiredMissing.length === 0 ? (
          <p className="mt-1 text-xs font-medium text-accent">
            All required filled
          </p>
        ) : (
          <button
            type="button"
            className="mt-1 text-left text-xs font-medium text-danger hover:underline"
            onClick={goToNextMissing}
          >
            {requiredMissing.length} required missing — go to next
          </button>
        )}
      </div>
      <div
        ref={listRef}
        className="max-h-[min(28rem,calc(100vh-10rem))] overflow-y-auto px-1.5 py-2"
      >
        {renderEntries(outline, 0)}
      </div>
    </nav>
  );
}
