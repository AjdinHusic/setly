import type { ConfigProvider } from "./types.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const jsonProvider: ConfigProvider = {
  id: "json",
  label: "JSON",
  description:
    "JSON configuration files such as .NET appsettings and nested JSON configs.",
  patterns: ["appsettings.json", "appsettings.*.json"],

  matchesFileName(fileName: string): boolean {
    if (fileName === "appsettings.json") return true;
    return /^appsettings\.[^/\\]+\.json$/i.test(fileName);
  },

  parse(raw: string): Record<string, unknown> {
    const data = JSON.parse(raw) as unknown;
    if (!isPlainObject(data)) {
      throw new Error("JSON config root must be an object");
    }
    return data;
  },

  serialize(data: unknown): string {
    return `${JSON.stringify(data, null, 4)}\n`;
  },

  describeSiblingName(targetFileName: string): string {
    if (targetFileName.toLowerCase() === "appsettings.json") {
      return "describe-config.json";
    }
    // appsettings.Development.json -> describe-config.appsettings.Development.json
    const withoutExt = targetFileName.replace(/\.json$/i, "");
    return `describe-config.${withoutExt}.json`;
  },

  suggestedFileName(sourceFileName: string): string {
    if (this.matchesFileName(sourceFileName)) return sourceFileName;
    return "appsettings.json";
  },
};
