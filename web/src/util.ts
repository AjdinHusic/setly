import type {
  DescribeConfig,
  DiscoveredConfig,
  FieldMeta,
  FieldType,
  ParameterNode,
  ProviderId,
} from "./api";

export function isFieldMeta(node: ParameterNode): node is FieldMeta {
  return (
    typeof node === "object" &&
    node !== null &&
    "Type" in node &&
    "InitialValue" in node &&
    "Label" in node
  );
}

export interface FlatField {
  path: string[];
  pathKey: string;
  meta: FieldMeta;
  stale: boolean;
}

export function flattenParameters(
  parameters: Record<string, ParameterNode>,
  prefix: string[] = [],
  stalePaths: Set<string> = new Set(),
): FlatField[] {
  const fields: FlatField[] = [];
  for (const [key, node] of Object.entries(parameters)) {
    const path = [...prefix, key];
    const pathKey = path.join(".");
    if (isFieldMeta(node)) {
      fields.push({
        path,
        pathKey,
        meta: node,
        stale: stalePaths.has(pathKey),
      });
    } else {
      fields.push(
        ...flattenParameters(
          node as Record<string, ParameterNode>,
          path,
          stalePaths,
        ),
      );
    }
  }
  return fields;
}

export function updateFieldMetaAtPath(
  parameters: Record<string, ParameterNode>,
  path: string[],
  patch: Partial<FieldMeta>,
): Record<string, ParameterNode> {
  if (path.length === 0) return parameters;
  const [head, ...rest] = path;
  const node = parameters[head!];
  if (node === undefined) return parameters;

  if (rest.length === 0) {
    if (!isFieldMeta(node)) return parameters;
    return { ...parameters, [head!]: { ...node, ...patch } };
  }
  if (isFieldMeta(node)) return parameters;
  return {
    ...parameters,
    [head!]: updateFieldMetaAtPath(
      node as Record<string, ParameterNode>,
      rest,
      patch,
    ),
  };
}

export interface StoredProject {
  id: string;
  rootPath: string;
  label: string;
  configs: DiscoveredConfig[];
  addedAt: number;
  lastOpenedAt: number;
}

const PROJECTS_KEY = "setly:projects:v2";
const LEGACY_V1_KEY = "setly:projects";
const LEGACY_APP_CONFIG_KEY = "app-config:projects";
const LEGACY_RECENT_KEY = "app-config:recent-paths";

function newId(): string {
  return crypto.randomUUID();
}

export function folderLabelFromPath(rootPath: string): string {
  const normalized = rootPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] || rootPath;
}

function isDiscoveredConfig(value: unknown): value is DiscoveredConfig {
  if (typeof value !== "object" || value === null) return false;
  const c = value as DiscoveredConfig;
  return (
    typeof c.path === "string" &&
    typeof c.relativePath === "string" &&
    typeof c.displayName === "string" &&
    (c.providerId === "json" || c.providerId === "dotenv")
  );
}

function isV2Project(value: unknown): value is StoredProject {
  if (typeof value !== "object" || value === null) return false;
  const p = value as StoredProject;
  return (
    typeof p.id === "string" &&
    typeof p.rootPath === "string" &&
    typeof p.label === "string" &&
    Array.isArray(p.configs) &&
    p.configs.every(isDiscoveredConfig)
  );
}

function migrateLegacyFilePath(filePath: string, index: number): StoredProject {
  const now = Date.now() - index;
  const normalized = filePath.replace(/\\/g, "/");
  const parts = normalized.split("/");
  const fileName = parts[parts.length - 1] || filePath;
  const rootPath = parts.slice(0, -1).join("/") || filePath;
  const providerId: ProviderId =
    fileName === ".env" || fileName.startsWith(".env.") ? "dotenv" : "json";
  return {
    id: newId(),
    rootPath,
    label: folderLabelFromPath(rootPath),
    configs: [
      {
        path: filePath,
        relativePath: fileName,
        providerId,
        displayName: fileName,
      },
    ],
    addedAt: now,
    lastOpenedAt: now,
  };
}

function readProjectsRaw(): StoredProject[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter(isV2Project);
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const legacy = localStorage.getItem(LEGACY_V1_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as unknown;
      if (Array.isArray(parsed)) {
        const migrated: StoredProject[] = [];
        for (const [i, item] of parsed.entries()) {
          if (
            typeof item === "object" &&
            item !== null &&
            typeof (item as { path?: string }).path === "string" &&
            !("rootPath" in item)
          ) {
            migrated.push(
              migrateLegacyFilePath((item as { path: string }).path, i),
            );
          } else if (isV2Project(item)) {
            migrated.push(item);
          }
        }
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(migrated));
        localStorage.removeItem(LEGACY_V1_KEY);
        return migrated;
      }
    }
  } catch {
    /* ignore */
  }

  try {
    const old = localStorage.getItem(LEGACY_APP_CONFIG_KEY);
    if (old) {
      const parsed = JSON.parse(old) as unknown;
      if (Array.isArray(parsed)) {
        const migrated = parsed
          .filter(
            (p): p is { path: string } =>
              typeof p === "object" &&
              p !== null &&
              typeof (p as { path?: string }).path === "string",
          )
          .map((p, i) => migrateLegacyFilePath(p.path, i));
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(migrated));
        localStorage.removeItem(LEGACY_APP_CONFIG_KEY);
        localStorage.removeItem(LEGACY_RECENT_KEY);
        return migrated;
      }
    }
  } catch {
    /* ignore */
  }

  return [];
}

function writeProjects(projects: StoredProject[]): StoredProject[] {
  const sorted = [...projects].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(sorted));
  return sorted;
}

export function loadProjects(): StoredProject[] {
  return readProjectsRaw().sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
}

export function upsertScannedProject(input: {
  rootPath: string;
  label: string;
  configs: DiscoveredConfig[];
}): StoredProject[] {
  const now = Date.now();
  const existing = readProjectsRaw();
  const found = existing.find((p) => p.rootPath === input.rootPath);
  const next: StoredProject[] = found
    ? existing.map((p) =>
        p.rootPath === input.rootPath
          ? {
              ...p,
              label: p.label || input.label,
              configs: input.configs,
              lastOpenedAt: now,
            }
          : p,
      )
    : [
        {
          id: newId(),
          rootPath: input.rootPath,
          label: input.label,
          configs: input.configs,
          addedAt: now,
          lastOpenedAt: now,
        },
        ...existing,
      ];
  return writeProjects(next);
}

export function updateProjectLabel(
  projectId: string,
  label: string,
): StoredProject[] {
  const trimmed = label.trim();
  if (!trimmed) return loadProjects();
  const next = readProjectsRaw().map((p) =>
    p.id === projectId ? { ...p, label: trimmed } : p,
  );
  return writeProjects(next);
}

export function touchProject(projectId: string): StoredProject[] {
  const now = Date.now();
  const next = readProjectsRaw().map((p) =>
    p.id === projectId ? { ...p, lastOpenedAt: now } : p,
  );
  return writeProjects(next);
}

export function removeProject(projectId: string): StoredProject[] {
  return writeProjects(readProjectsRaw().filter((p) => p.id !== projectId));
}

export function getProjectById(projectId: string): StoredProject | null {
  return readProjectsRaw().find((p) => p.id === projectId) ?? null;
}

export function findProjectForConfigPath(
  configPath: string,
): StoredProject | null {
  return (
    readProjectsRaw().find((p) =>
      p.configs.some((c) => c.path === configPath),
    ) ?? null
  );
}

export function isEmptyValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (typeof value === "string" && value.trim() === "")
  );
}

export function fieldDomId(pathKey: string): string {
  return `cfg-${pathKey.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

export function sectionDomId(pathKey: string): string {
  return `sec-${pathKey.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

export type OutlineEntry =
  | {
      kind: "section";
      path: string[];
      pathKey: string;
      label: string;
      children: OutlineEntry[];
    }
  | {
      kind: "field";
      path: string[];
      pathKey: string;
      label: string;
    };

/** Build a nested outline of sections and leaf fields from describe Parameters. */
export function buildOutline(
  parameters: Record<string, ParameterNode>,
  prefix: string[] = [],
): OutlineEntry[] {
  const entries: OutlineEntry[] = [];
  for (const [key, node] of Object.entries(parameters)) {
    const path = [...prefix, key];
    const pathKey = path.join(".");
    if (isFieldMeta(node)) {
      entries.push({
        kind: "field",
        path,
        pathKey,
        label: node.Label || key,
      });
    } else {
      entries.push({
        kind: "section",
        path,
        pathKey,
        label: key,
        children: buildOutline(
          node as Record<string, ParameterNode>,
          path,
        ),
      });
    }
  }
  return entries;
}

export function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === "auto" || overflowY === "scroll") {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/** Scroll the main pane (not the outline) to a field or section. */
export function scrollToConfigTarget(
  pathKey: string,
  kind: "field" | "section",
) {
  const id =
    kind === "field"
      ? `field-${fieldDomId(pathKey)}`
      : `section-${sectionDomId(pathKey)}`;
  const el = document.getElementById(id);
  if (!el) return;

  const scrollRoot = getScrollParent(el);
  const offset = 20;
  if (scrollRoot) {
    const rootRect = scrollRoot.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const nextTop =
      scrollRoot.scrollTop + (elRect.top - rootRect.top) - offset;
    scrollRoot.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
  } else {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (kind === "field") {
    const input = document.getElementById(fieldDomId(pathKey));
    if (input instanceof HTMLElement) {
      window.setTimeout(() => input.focus({ preventScroll: true }), 280);
    }
  }
}

export function valuesEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a === "object" || typeof b === "object") {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

export function formatDefaultValue(value: unknown, type: string): string {
  if (type === "json") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  return String(value);
}

export function defaultsFromDescribe(
  describe: DescribeConfig,
  stalePaths: string[] = [],
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of flattenParameters(
    describe.Parameters,
    [],
    new Set(stalePaths),
  )) {
    values[field.pathKey] = field.meta.InitialValue;
  }
  return values;
}

export function parseParameterPath(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Parameter path is required");
  const parts = trimmed.split(".").map((p) => p.trim());
  if (parts.some((p) => !p)) {
    throw new Error("Parameter path has an empty segment");
  }
  if (parts.some((p) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(p))) {
    throw new Error(
      "Each path segment must be a letter/underscore followed by letters, digits, or underscores",
    );
  }
  return parts;
}

export function insertFieldAtPath(
  parameters: Record<string, ParameterNode>,
  path: string[],
  meta: FieldMeta,
): Record<string, ParameterNode> {
  if (path.length === 0) {
    throw new Error("Parameter path is required");
  }
  const [head, ...rest] = path;
  if (rest.length === 0) {
    if (parameters[head!] !== undefined) {
      throw new Error(`Parameter already exists at ${path.join(".")}`);
    }
    return { ...parameters, [head!]: meta };
  }

  const existing = parameters[head!];
  if (existing !== undefined && isFieldMeta(existing)) {
    throw new Error(
      `Cannot add under "${head}" because it is already a value field`,
    );
  }
  const child = (existing as Record<string, ParameterNode> | undefined) ?? {};
  return {
    ...parameters,
    [head!]: insertFieldAtPath(child, rest, meta),
  };
}

export function defaultValueForType(type: FieldType): unknown {
  switch (type) {
    case "number":
      return 0;
    case "boolean":
      return false;
    case "json":
      return {};
    case "dropdown":
    case "string":
    default:
      return "";
  }
}

export function configHref(filePath: string): string {
  return `/config?path=${encodeURIComponent(filePath)}`;
}

export function projectHref(projectId: string): string {
  return `/project?id=${encodeURIComponent(projectId)}`;
}
