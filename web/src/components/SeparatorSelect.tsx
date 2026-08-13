import { useState } from "react";
import { ENV_SEPARATOR_PRESETS } from "../nesting";

interface SeparatorSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Dark toolbar styling */
  tone?: "light" | "dark";
  className?: string;
}

export function SeparatorSelect({
  id,
  value,
  onChange,
  disabled,
  tone = "light",
  className,
}: SeparatorSelectProps) {
  const presetValues: string[] = ENV_SEPARATOR_PRESETS.map((p) => p.value);
  const isCustom = value !== "" && !presetValues.includes(value);
  const [customMode, setCustomMode] = useState(isCustom);
  const selectValue = customMode || isCustom ? "__custom__" : value;

  const selectClass =
    tone === "dark"
      ? "rounded-md border border-white/15 bg-white/10 px-2 py-1 text-xs text-white outline-none focus:border-accent focus:ring-1 focus:ring-accent/40"
      : "input max-w-[11rem] py-1 text-xs";

  const customClass =
    tone === "dark"
      ? "w-16 rounded-md border border-white/15 bg-white/10 px-2 py-1 font-mono text-xs text-white outline-none focus:border-accent"
      : "input w-16 py-1 font-mono text-xs";

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className ?? ""}`}>
      <select
        id={id}
        className={selectClass}
        disabled={disabled}
        value={selectValue}
        onChange={(e) => {
          const next = e.target.value;
          if (next === "__custom__") {
            setCustomMode(true);
            if (!isCustom) onChange(value || "|");
            return;
          }
          setCustomMode(false);
          onChange(next);
        }}
      >
        {ENV_SEPARATOR_PRESETS.map((preset) => (
          <option
            key={preset.value}
            value={preset.value}
            className={tone === "dark" ? "bg-[#15202b] text-ink" : undefined}
          >
            {preset.label}
          </option>
        ))}
        <option
          value="__custom__"
          className={tone === "dark" ? "bg-[#15202b] text-ink" : undefined}
        >
          Custom…
        </option>
      </select>
      {(customMode || isCustom) && (
        <input
          type="text"
          className={customClass}
          disabled={disabled}
          value={value}
          maxLength={8}
          aria-label="Custom separator"
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
