import { fieldDomId, isEmptyValue, type FlatField } from "../util";

interface MissingFieldsBarProps {
  fields: FlatField[];
  values: Record<string, unknown>;
  onGoToNext: (pathKey: string) => void;
}

export function MissingFieldsBar({
  fields,
  values,
  onGoToNext,
}: MissingFieldsBarProps) {
  const requiredMissing = fields.filter(
    (f) => f.meta.Required && isEmptyValue(values[f.pathKey]),
  );
  const optionalMissing = fields.filter(
    (f) => !f.meta.Required && isEmptyValue(values[f.pathKey]),
  );

  const next = requiredMissing[0] ?? optionalMissing[0] ?? null;
  const totalMissing = requiredMissing.length + optionalMissing.length;

  return (
    <div className="sticky top-0 z-20 -mx-1 mb-4 border-b border-line bg-canvas/95 px-1 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="font-semibold text-ink">
            {totalMissing === 0 ? "All fields filled" : "Missing values"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                requiredMissing.length > 0
                  ? "bg-danger-soft text-danger"
                  : "bg-panel-2 text-muted"
              }`}
            >
              {requiredMissing.length} required
            </span>
            <span className="rounded-md bg-panel-2 px-1.5 py-0.5 text-[11px] font-semibold text-muted">
              {optionalMissing.length} optional
            </span>
          </span>
        </div>

        <button
          type="button"
          className="btn-secondary"
          disabled={!next}
          onClick={() => {
            if (!next) return;
            onGoToNext(next.pathKey);
            const el = document.getElementById(
              `field-${fieldDomId(next.pathKey)}`,
            );
            const input = document.getElementById(fieldDomId(next.pathKey));
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
            if (input instanceof HTMLElement) {
              window.setTimeout(() => input.focus(), 250);
            }
          }}
        >
          Go to next
        </button>
      </div>
    </div>
  );
}
