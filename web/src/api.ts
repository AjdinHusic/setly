export type FieldType = "string" | "number" | "boolean" | "json";
export type ProviderId = "json" | "dotenv";

export interface FieldMeta {
  InitialValue: unknown;
  Type: FieldType;
  Description: string;
  Label: string;
  Required: boolean;
}

export type ParameterNode = FieldMeta | { [key: string]: ParameterNode };

export interface DescribeConfig {
  TargetFile: string;
  Parameters: Record<string, ParameterNode>;
}

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

export interface ScanProjectResponse {
  rootPath: string;
  label: string;
  configs: DiscoveredConfig[];
}

export interface OpenResponse {
  targetPath: string;
  describePath: string;
  providerId: ProviderId;
  providerLabel: string;
  configData: unknown;
  describe: DescribeConfig;
  values: Record<string, unknown>;
  createdDescribe: boolean;
  stalePaths: string[];
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: (T & { error?: string }) | null = null;
  try {
    data = text ? (JSON.parse(text) as T & { error?: string }) : null;
  } catch {
    throw new Error(
      `API returned non-JSON (${res.status}) from ${url}. Is the setly server running? Try restarting with npm run dev.`,
    );
  }
  if (!res.ok) {
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }
  if (!data) {
    throw new Error(`Empty response from ${url}`);
  }
  return data;
}

export function listProviders() {
  return request<{ providers: ProviderInfo[] }>("/api/providers");
}

export function scanProject(path: string) {
  return request<ScanProjectResponse>("/api/projects/scan", {
    method: "POST",
    body: JSON.stringify({ path }),
  });
}

export function openConfig(path: string) {
  return request<OpenResponse>("/api/open", {
    method: "POST",
    body: JSON.stringify({ path }),
  });
}

export async function browsePath(
  mode: "file" | "directory",
): Promise<string | null> {
  const res = await fetch("/api/browse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  const text = await res.text();
  let data: { path?: string; error?: string; cancelled?: boolean };
  try {
    data = text ? (JSON.parse(text) as typeof data) : {};
  } catch {
    throw new Error(
      "Browse failed: API returned non-JSON. The setly server may be outdated or not running — restart with npm run dev.",
    );
  }
  if (data.cancelled) {
    return null;
  }
  if (!res.ok) {
    throw new Error(data.error ?? `Browse failed (${res.status})`);
  }
  if (typeof data.path !== "string" || !data.path) {
    throw new Error("No path returned from file picker");
  }
  return data.path;
}

export function saveDescribe(path: string, describe: DescribeConfig) {
  return request<{ ok: true; describePath: string; describe: DescribeConfig }>(
    "/api/describe",
    {
      method: "PUT",
      body: JSON.stringify({ path, describe }),
    },
  );
}

export function generateConfig(
  path: string,
  values: Record<string, unknown>,
  mode: "overwrite" | "preview",
) {
  return request<{
    ok: true;
    mode: string;
    targetPath: string;
    providerId: ProviderId;
    configData: unknown;
    text: string;
  }>("/api/generate", {
    method: "POST",
    body: JSON.stringify({ path, values, mode }),
  });
}
