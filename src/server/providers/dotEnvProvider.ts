import type { ConfigProvider } from "./types.js";

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

export function serializeDotEnv(data: unknown): string {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error(".env root must be a flat object");
  }
  const lines: string[] = [];
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
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
};
