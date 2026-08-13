import { useEffect, useId, useState, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}

/** Centered dialog with fade + scale enter/exit. */
export function Modal({ open, onClose, title, children, wide }: ModalProps) {
  const titleId = useId();
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setShown(true));
      });
      return () => window.cancelAnimationFrame(id);
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), 200);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-colors duration-200 ${
        shown ? "bg-ink/45" : "bg-ink/0"
      }`}
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`w-full ${wide ? "max-w-3xl" : "max-w-lg"} rounded-xl border border-line bg-panel shadow-xl transition-all duration-200 ${
          shown
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-3 scale-95 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3.5">
          <h3 id={titleId} className="text-base font-semibold text-ink">
            {title}
          </h3>
          <button type="button" className="btn-ghost text-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="max-h-[min(70vh,36rem)] overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
