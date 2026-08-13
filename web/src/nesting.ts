/** Client copy of nesting helpers (keep in sync with src/server/nesting.ts). */

export type KeyCasing =
  | "preserve"
  | "camelCase"
  | "PascalCase"
  | "UPPERCASE"
  | "lowercase";

export const DEFAULT_ENV_SEPARATOR = "_";

export const ENV_SEPARATOR_PRESETS = [
  { value: "_", label: "Underscore (_)" },
  { value: "__", label: "Double underscore (__)" },
  { value: ":", label: "Colon (:)" },
  { value: ".", label: "Dot (.)" },
  { value: "-", label: "Hyphen (-)" },
  { value: "/", label: "Slash (/)" },
] as const;

export const KEY_CASING_OPTIONS: { value: KeyCasing; label: string }[] = [
  { value: "preserve", label: "Preserve" },
  { value: "camelCase", label: "camelCase" },
  { value: "PascalCase", label: "PascalCase" },
  { value: "UPPERCASE", label: "UPPERCASE" },
  { value: "lowercase", label: "lowercase" },
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function detectEnvSeparator(
  flat: Record<string, unknown>,
): string {
  const keys = Object.keys(flat);
  if (keys.some((k) => k.includes("__"))) return "__";
  if (keys.some((k) => k.includes(":"))) return ":";
  if (keys.some((k) => k.includes("."))) return ".";
  if (keys.some((k) => k.includes("/"))) return "/";
  if (keys.some((k) => k.includes("-") && /[A-Za-z0-9]-[A-Za-z0-9]/.test(k))) {
    return "-";
  }
  if (keys.some((k) => k.includes("_"))) return "_";
  return DEFAULT_ENV_SEPARATOR;
}

export function splitEnvKey(key: string, separator: string): string[] {
  if (!separator) return [key];
  if (!key.includes(separator)) return [key];
  return key.split(separator).filter((part) => part.length > 0);
}

export function isValidEnvKey(key: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_.:/-]*$/.test(key);
}

export function unflattenEnvRecord(
  flat: Record<string, unknown>,
  separator: string,
): Record<string, unknown> {
  if (!separator) {
    return { ...flat };
  }
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(flat)) {
    const parts = splitEnvKey(key, separator);
    if (parts.length === 0) continue;

    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;
      const existing = current[part];
      if (!isPlainObject(existing)) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }
    const leaf = parts[parts.length - 1]!;
    const prior = current[leaf];
    if (isPlainObject(prior) && Object.keys(prior).length > 0) {
      if (value !== "" && value !== undefined) {
        prior["_"] = value;
      }
    } else {
      current[leaf] = value;
    }
  }

  return result;
}

export function flattenToEnvRecord(
  data: unknown,
  separator: string = DEFAULT_ENV_SEPARATOR,
): Record<string, unknown> {
  if (!isPlainObject(data)) {
    throw new Error(".env root must be an object");
  }

  const sep = separator || DEFAULT_ENV_SEPARATOR;
  const out: Record<string, unknown> = {};

  function walk(node: unknown, parts: string[]) {
    if (isPlainObject(node)) {
      const entries = Object.entries(node);
      if (entries.length === 0) {
        if (parts.length > 0) out[parts.join(sep)] = "";
        return;
      }
      for (const [key, value] of entries) {
        walk(value, [...parts, key]);
      }
      return;
    }

    if (parts.length === 0) {
      throw new Error(".env root must be a flat or nested object of values");
    }

    const key = parts.join(sep);
    if (node === undefined || node === null) {
      out[key] = "";
    } else if (typeof node === "object") {
      out[key] = JSON.stringify(node);
    } else {
      out[key] = node;
    }
  }

  walk(data, []);
  return out;
}
