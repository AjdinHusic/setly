import path from "node:path";
import {
  buildAppsettingsFromValues,
  flattenParameters,
  generateDescribe,
  generateParameters,
  mergeDescribe,
  valuesFromAppsettings,
} from "./describe.js";
import {
  DEFAULT_ENV_SEPARATOR,
  detectEnvSeparator,
  unflattenEnvRecord,
} from "./nesting.js";
import { providerForPath } from "./providers/index.js";
import {
  describePathFor,
  pathExists,
  readJsonFile,
  readTextFile,
} from "./configIo.js";
import type { DescribeConfig, FieldMeta, ParameterNode } from "./types.js";
import { isFieldMeta } from "./types.js";
import type { ProviderId } from "./providers/types.js";

export interface CombineSourceInput {
  path: string;
}

export interface CombineSourceInfo {
  path: string;
  fileName: string;
  providerId: ProviderId;
  providerLabel: string;
  excluded: boolean;
}

export interface FieldSourceInfo {
  pathKey: string;
  sourcePath: string;
  sourceFileName: string;
  displayKey: string;
  label: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Deep merge: later overlay wins on leaf conflicts; arrays replaced wholesale. */
export function deepMergeConfig(
  base: Record<string, unknown>,
  overlay: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    const existing = result[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      result[key] = deepMergeConfig(existing, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

async function loadNestedConfig(targetPath: string): Promise<{
  nested: Record<string, unknown>;
  describe: DescribeConfig;
  providerId: ProviderId;
  providerLabel: string;
  separator?: string;
}> {
  const provider = providerForPath(targetPath);
  const raw = await readTextFile(targetPath);
  const parsed = provider.parse(raw);
  const targetFileName = path.basename(targetPath);
  const describePath = describePathFor(
    targetPath,
    provider.describeSiblingName(targetFileName),
  );

  let nested: Record<string, unknown> = parsed;
  let separator: string | undefined;

  if (provider.id === "dotenv") {
    const existing = (await pathExists(describePath))
      ? await readJsonFile<DescribeConfig>(describePath)
      : null;
    separator =
      existing?.Separator ??
      detectEnvSeparator(parsed) ??
      DEFAULT_ENV_SEPARATOR;
    nested = unflattenEnvRecord(parsed, separator);
  }

  let describe: DescribeConfig;
  if (await pathExists(describePath)) {
    const existing = await readJsonFile<DescribeConfig>(describePath);
    const merged = mergeDescribe(
      {
        ...existing,
        ...(separator ? { Separator: separator } : {}),
      },
      nested,
      targetFileName,
    );
    describe = {
      ...merged.describe,
      ...(separator ? { Separator: separator } : {}),
    };
  } else {
    describe = generateDescribe(nested, targetFileName, {
      separator,
    });
  }

  return {
    nested,
    describe,
    providerId: provider.id,
    providerLabel: provider.label,
    separator,
  };
}

function getAtPath(
  obj: Record<string, unknown>,
  pathParts: string[],
): unknown {
  let current: unknown = obj;
  for (const segment of pathParts) {
    if (!isPlainObject(current) || !(segment in current)) return undefined;
    current = current[segment];
  }
  return current;
}

function preferMeta(
  a: FieldMeta | undefined,
  b: FieldMeta | undefined,
): FieldMeta | undefined {
  if (!a) return b;
  if (!b) return a;
  return {
    ...b,
    ...a,
    InitialValue: a.InitialValue,
    Label: a.Label || b.Label,
    Description: a.Description || b.Description,
    Type: a.Type || b.Type,
    ItemType: a.ItemType ?? b.ItemType,
    Options: a.Options ?? b.Options,
    Required: a.Required || b.Required,
  };
}

function mergeParameterMeta(
  generated: Record<string, ParameterNode>,
  sources: { describe: DescribeConfig }[],
): Record<string, ParameterNode> {
  const metaByPath = new Map<string, FieldMeta>();
  for (const source of sources) {
    for (const field of flattenParameters(source.describe.Parameters)) {
      const key = field.path.join(".");
      metaByPath.set(key, preferMeta(metaByPath.get(key), field.meta)!);
    }
  }

  function apply(
    node: ParameterNode,
    pathParts: string[],
  ): ParameterNode {
    if (isFieldMeta(node)) {
      const prev = metaByPath.get(pathParts.join("."));
      if (!prev) return node;
      return {
        ...prev,
        InitialValue: node.InitialValue,
        Type: prev.Type || node.Type,
        ItemType: prev.ItemType ?? node.ItemType,
      };
    }
    const obj = node as Record<string, ParameterNode>;
    const next: Record<string, ParameterNode> = {};
    for (const [key, child] of Object.entries(obj)) {
      next[key] = apply(child, [...pathParts, key]);
    }
    return next;
  }

  return apply(generated as ParameterNode, []) as Record<string, ParameterNode>;
}

export async function openCombinedConfig(input: {
  paths: string[];
  dominantPath: string;
  excludedPaths?: string[];
}): Promise<{
  sources: CombineSourceInfo[];
  dominantPath: string;
  configData: Record<string, unknown>;
  describe: DescribeConfig;
  values: Record<string, unknown>;
  fieldSources: FieldSourceInfo[];
}> {
  const excluded = new Set(input.excludedPaths ?? []);
  const uniquePaths = [...new Set(input.paths.map((p) => path.resolve(p)))];
  if (uniquePaths.length < 2) {
    throw new Error("Combine requires at least two config files");
  }

  const dominantPath = path.resolve(input.dominantPath);
  if (!uniquePaths.includes(dominantPath)) {
    throw new Error("Dominant config must be one of the combined paths");
  }

  const loaded = [];
  for (const targetPath of uniquePaths) {
    const info = await loadNestedConfig(targetPath);
    loaded.push({
      path: targetPath,
      fileName: path.basename(targetPath),
      excluded: excluded.has(targetPath),
      ...info,
    });
  }

  const active = loaded.filter((s) => !s.excluded);
  if (active.length === 0) {
    throw new Error("At least one config must remain included");
  }

  // Apply non-dominant first, dominant last (wins conflicts)
  const ordered = [
    ...active.filter((s) => s.path !== dominantPath),
    ...active.filter((s) => s.path === dominantPath),
  ];

  let merged: Record<string, unknown> = {};
  for (const source of ordered) {
    merged = deepMergeConfig(merged, source.nested);
  }

  const generated = generateParameters(merged);
  const parameters = mergeParameterMeta(
    generated,
    ordered.map((s) => ({ describe: s.describe })),
  );

  const dotenvSource = ordered.find((s) => s.providerId === "dotenv");
  const describe: DescribeConfig = {
    TargetFile: `combined:${ordered.map((s) => s.fileName).join("+")}`,
    Parameters: parameters,
    ...(dotenvSource?.separator
      ? { Separator: dotenvSource.separator }
      : {}),
  };

  const values = valuesFromAppsettings(describe, merged);

  // Attribution: which active source last set each leaf (dominant wins)
  const fieldSources: FieldSourceInfo[] = [];
  for (const field of flattenParameters(describe.Parameters)) {
    let winner = ordered[0]!;
    for (const source of ordered) {
      const fromSource = getAtPath(source.nested, field.path);
      if (fromSource !== undefined) winner = source;
    }
    const displayKey =
      winner.providerId === "dotenv" && winner.separator
        ? field.path.join(winner.separator)
        : field.path.join(".");
    fieldSources.push({
      pathKey: field.path.join("."),
      sourcePath: winner.path,
      sourceFileName: winner.fileName,
      displayKey,
      label: `takes from ${winner.fileName} ${displayKey}`,
    });
  }

  return {
    sources: loaded.map((s) => ({
      path: s.path,
      fileName: s.fileName,
      providerId: s.providerId,
      providerLabel: s.providerLabel,
      excluded: s.excluded,
    })),
    dominantPath,
    configData: merged,
    describe,
    values,
    fieldSources,
  };
}

/** Rebuild merged values object for generate from describe + form values. */
export function combinedConfigData(
  describe: DescribeConfig,
  values: Record<string, unknown>,
): Record<string, unknown> {
  return buildAppsettingsFromValues(describe, values);
}
