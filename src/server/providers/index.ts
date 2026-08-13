import { dotEnvProvider } from "./dotEnvProvider.js";
import { jsonProvider } from "./jsonProvider.js";
import type {
  ConfigProvider,
  DiscoveredConfig,
  ProviderId,
  ProviderInfo,
} from "./types.js";

export const providers: ConfigProvider[] = [jsonProvider, dotEnvProvider];

export function listProviderInfo(): ProviderInfo[] {
  return providers.map((p) => ({
    id: p.id,
    label: p.label,
    description: p.description,
    patterns: p.patterns,
  }));
}

export function getProvider(id: ProviderId): ConfigProvider {
  const found = providers.find((p) => p.id === id);
  if (!found) throw new Error(`Unknown provider: ${id}`);
  return found;
}

export function providerForFileName(fileName: string): ConfigProvider | null {
  return providers.find((p) => p.matchesFileName(fileName)) ?? null;
}

export function providerForPath(filePath: string): ConfigProvider {
  const base = filePath.split(/[/\\]/).pop() ?? filePath;
  const provider = providerForFileName(base);
  if (!provider) {
    throw new Error(`No provider matches file: ${base}`);
  }
  return provider;
}

export type { ConfigProvider, DiscoveredConfig, ProviderId, ProviderInfo };
