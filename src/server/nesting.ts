/** Shared nesting / key-transform helpers for flat formats (dotenv) and generate. */

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

/** Pick a likely nesting separator from flat env-style keys. */
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

/**
 * Split an env key on separator. Prefer longest match for `__` vs `_`
 * by using String.split (works: "a__b".split("__") => ["a","b"]).
 */
export function splitEnvKey(key: string, separator: string): string[] {
  if (!separator) return [key];
  if (!key.includes(separator)) return [key];
  return key.split(separator).filter((part) => part.length > 0);
}

/** Unflatten KEY__NESTED=value into nested objects (and indexed arrays). */
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

  return collapseIndexedMaps(result) as Record<string, unknown>;
}

/**
 * Flatten nested config into env-style keys with the given separator.
 * Scalar arrays become indexed keys: Features_AllowedOrigins_0, _1, …
 */
export function flattenToEnvRecord(
  data: unknown,
  separator: string = DEFAULT_ENV_SEPARATOR,
): Record<string, unknown> {
  if (!isPlainObject(data)) {
    throw new Error(".env root must be an object");
  }

  const sep = separator || DEFAULT_ENV_SEPARATOR;
  const out: Record<string, unknown> = {};

  function isScalar(value: unknown): boolean {
    return (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    );
  }

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

    if (Array.isArray(node)) {
      if (parts.length === 0) {
        throw new Error(".env root must be a flat or nested object of values");
      }
      if (node.length === 0) return;
      if (node.every(isScalar)) {
        node.forEach((item, index) => {
          out[[...parts, String(index)].join(sep)] = item;
        });
        return;
      }
      out[parts.join(sep)] = JSON.stringify(node);
      return;
    }

    if (parts.length === 0) {
      throw new Error(".env root must be a flat or nested object of values");
    }

    const key = parts.join(sep);
    if (node === undefined || node === null) {
      out[key] = "";
    } else {
      out[key] = node;
    }
  }

  walk(data, []);
  return out;
}

/** Collapse plain objects whose keys are dense integer indices into arrays. */
export function collapseIndexedMaps(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(collapseIndexedMaps);
  }
  if (!isPlainObject(value)) return value;

  const collapsed: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    collapsed[key] = collapseIndexedMaps(child);
  }

  const keys = Object.keys(collapsed);
  if (keys.length === 0) return collapsed;
  if (!keys.every((k) => /^\d+$/.test(k))) return collapsed;

  const indices = keys.map(Number).sort((a, b) => a - b);
  if (indices[0] !== 0) return collapsed;
  const max = indices[indices.length - 1]!;
  if (indices.length !== max + 1) return collapsed;
  for (let i = 0; i <= max; i++) {
    if (!(String(i) in collapsed)) return collapsed;
  }
  return indices.map((i) => collapsed[String(i)]);
}

function toCamelCase(segment: string): string {
  const parts = segment.split(/[-_\s]+/).filter(Boolean);
  if (parts.length === 0) return segment;
  return parts
    .map((p, i) => {
      const lower = p.toLowerCase();
      if (i === 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

function toPascalCase(segment: string): string {
  const camel = toCamelCase(segment);
  if (!camel) return segment;
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

export function applyKeyCasingSegment(
  segment: string,
  casing: KeyCasing,
): string {
  switch (casing) {
    case "camelCase":
      return toCamelCase(segment);
    case "PascalCase":
      return toPascalCase(segment);
    case "UPPERCASE":
      return segment.toUpperCase();
    case "lowercase":
      return segment.toLowerCase();
    case "preserve":
    default:
      return segment;
  }
}

/** Deep-clone object keys with casing applied to every property name. */
export function applyObjectKeyCasing(
  data: unknown,
  casing: KeyCasing,
): unknown {
  if (casing === "preserve") return data;
  if (Array.isArray(data)) {
    return data.map((item) => applyObjectKeyCasing(item, casing));
  }
  if (!isPlainObject(data)) return data;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    out[applyKeyCasingSegment(key, casing)] = applyObjectKeyCasing(
      value,
      casing,
    );
  }
  return out;
}

export function isValidEnvKey(key: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_.:/-]*$/.test(key);
}
