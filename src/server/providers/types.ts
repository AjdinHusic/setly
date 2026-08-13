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

export interface ConfigProvider {
  id: ProviderId;
  label: string;
  description: string;
  patterns: string[];
  matchesFileName(fileName: string): boolean;
  parse(raw: string): Record<string, unknown>;
  serialize(data: unknown): string;
  describeSiblingName(targetFileName: string): string;
}
