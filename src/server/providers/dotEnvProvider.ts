import type { ConfigProvider } from "./types.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
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

/**
 * Flatten nested config (e.g. appsettings) into env-style keys.
 * Nesting uses `__` (ASP.NET Core convention): Host.Name → Host__Name.
 */
export function flattenToEnvRecord(
  data: unknown,
): Record<string, unknown> {
  if (!isPlainObject(data)) {
    throw new Error(".env root must be an object");
  }

  const out: Record<string, unknown> = {};

  function walk(node: unknown, parts: string[]) {
    if (isPlainObject(node)) {
      const entries = Object.entries(node);
      if (entries.length === 0) {
        if (parts.length > 0) out[parts.join("__")] = "";
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

    const key = parts.join("__");
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

export function serializeDotEnv(data: unknown): string {
  const flat = flattenToEnvRecord(data);
  const lines: string[] = [];
  for (const [key, value] of Object.entries(flat)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
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
    // .env.local, .env.development — skip .env.example optionally? include all .env*
    if (fileName === ".env.example" || fileName === ".env.sample") return false;
    return /^\.env\.[^/\\]+$/i.test(fileName);
  },

  parse(raw: string): Record<string, unknown> {
    return parseDotEnv(raw);
  },

  serialize(data: unknown): string {
    return serializeDotEnv(data);
  },

  describeSiblingName(targetFileName: string): string {
    // .env -> describe-config.env.json
    // .env.local -> describe-config.env.local.json
    if (targetFileName === ".env") return "describe-config.env.json";
    return `describe-config${targetFileName}.json`;
  },

  suggestedFileName(_sourceFileName: string): string {
    return ".env";
  },
};
