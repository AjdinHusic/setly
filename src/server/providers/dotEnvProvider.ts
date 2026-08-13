import type { ConfigProvider, SerializeOptions } from "./types.js";
import {
  DEFAULT_ENV_SEPARATOR,
  applyObjectKeyCasing,
  flattenToEnvRecord,
  isValidEnvKey,
} from "../nesting.js";

/** Parse KEY=VALUE .env content into a flat string record */
export function parseDotEnv(raw: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const exportPrefix = trimmed.startsWith("export ")
      ? trimmed.slice("export ".length).trim()
      : trimmed;
    const eq = exportPrefix.indexOf("=");
    if (eq <= 0) continue;
    const key = exportPrefix.slice(0, eq).trim();
    if (!isValidEnvKey(key)) continue;
    let value = exportPrefix.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

export function serializeDotEnv(
  data: unknown,
  separator: string = DEFAULT_ENV_SEPARATOR,
): string {
  const flat = flattenToEnvRecord(data, separator);
  const lines: string[] = [];
  for (const [key, value] of Object.entries(flat)) {
    if (!isValidEnvKey(key)) continue;
    const raw =
      value === undefined || value === null
        ? ""
        : typeof value === "string"
          ? value
          : String(value);
    const needsQuotes = /[\s#"'\\]/.test(raw) || raw === "";
    const escaped = raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    lines.push(needsQuotes ? `${key}="${escaped}"` : `${key}=${raw}`);
  }
  return `${lines.join("\n")}${lines.length ? "\n" : ""}`;
}

export const dotEnvProvider: ConfigProvider = {
  id: "dotenv",
  label: "DotEnv",
  description:
    "Environment files (.env, .env.local, .env.development, …) as KEY=VALUE pairs.",
  patterns: [".env", ".env.*"],

  matchesFileName(fileName: string): boolean {
    if (fileName === ".env") return true;
    if (fileName === ".env.example" || fileName === ".env.sample") return false;
    return /^\.env\.[^/\\]+$/i.test(fileName);
  },

  parse(raw: string): Record<string, unknown> {
    return parseDotEnv(raw);
  },

  serialize(data: unknown, options?: SerializeOptions): string {
    const casing = options?.casing ?? "preserve";
    const payload =
      casing !== "preserve" ? applyObjectKeyCasing(data, casing) : data;
    return serializeDotEnv(
      payload,
      options?.separator ?? DEFAULT_ENV_SEPARATOR,
    );
  },

  describeSiblingName(targetFileName: string): string {
    if (targetFileName === ".env") return "describe-config.env.json";
    return `describe-config${targetFileName}.json`;
  },

  suggestedFileName(_sourceFileName: string): string {
    return ".env";
  },
};

// Re-export for callers that imported flatten from this module
export { flattenToEnvRecord } from "../nesting.js";
