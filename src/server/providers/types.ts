import type { KeyCasing } from "../nesting.js";

export type ProviderId = "json" | "dotenv";

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  description: string;
  patterns: string[];
}

export interface DiscoveredConfig {
  path: string;
  relativePath: string;
  providerId: ProviderId;
  displayName: string;
}

export interface SerializeOptions {
  /** Nesting separator when flattening to dotenv keys. */
  separator?: string;
  /** Transform object keys before serialize. */
  casing?: KeyCasing;
}

export interface ConfigProvider {
  id: ProviderId;
  label: string;
  description: string;
  patterns: string[];
  matchesFileName(fileName: string): boolean;
  parse(raw: string): Record<string, unknown>;
  serialize(data: unknown, options?: SerializeOptions): string;
  describeSiblingName(targetFileName: string): string;
  /** Default filename when exporting into this format from another provider. */
  suggestedFileName(sourceFileName: string): string;
}
