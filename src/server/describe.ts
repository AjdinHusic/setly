import type {
  DescribeConfig,
  FieldMeta,
  FieldType,
  ParameterNode,
} from "./types.js";
import { isFieldMeta } from "./types.js";

function inferType(value: unknown): FieldType {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  return "json";
}

function defaultLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Build describe Parameters tree from appsettings leaves */
export function generateParameters(
  value: unknown,
): Record<string, ParameterNode> {
  if (!isPlainObject(value)) {
    return {};
  }
  const result: Record<string, ParameterNode> = {};
  for (const [key, child] of Object.entries(value)) {
    if (isPlainObject(child) && Object.keys(child).length > 0) {
      result[key] = generateParameters(child);
    } else if (isPlainObject(child)) {
      result[key] = makeField(key, child, "json");
    } else {
      result[key] = makeField(key, child, inferType(child));
    }
  }
  return result;
}

function makeField(key: string, value: unknown, type: FieldType): FieldMeta {
  return {
    InitialValue: value,
    Type: type,
    Description: "",
    Label: defaultLabel(key),
    Required: false,
  };
}

export function generateDescribe(
  appsettings: unknown,
  targetFileName: string,
): DescribeConfig {
  return {
    TargetFile: targetFileName,
    Parameters: generateParameters(appsettings),
  };
}

export interface FlatField {
  path: string[];
  meta: FieldMeta;
  stale?: boolean;
}

/** Flatten Parameter tree to leaf fields */
export function flattenParameters(
  parameters: Record<string, ParameterNode>,
  prefix: string[] = [],
): FlatField[] {
  const fields: FlatField[] = [];
  for (const [key, node] of Object.entries(parameters)) {
    const path = [...prefix, key];
    if (isFieldMeta(node)) {
      fields.push({ path, meta: node });
    } else {
      fields.push(
        ...flattenParameters(node as Record<string, ParameterNode>, path),
      );
    }
  }
  return fields;
}

function getAtPath(
  obj: Record<string, unknown>,
  path: string[],
): unknown {
  let current: unknown = obj;
  for (const segment of path) {
    if (!isPlainObject(current) || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function setAtPath(
  obj: Record<string, unknown>,
  path: string[],
  value: unknown,
): void {
  let current = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i]!;
    if (!isPlainObject(current[segment])) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  }
  current[path[path.length - 1]!] = value;
}

/** Merge existing describe with appsettings; keep metadata; add new leaves; collect stale paths */
export function mergeDescribe(
  existing: DescribeConfig,
  appsettings: unknown,
  targetFileName: string,
): { describe: DescribeConfig; stalePaths: string[] } {
  const generated = generateParameters(appsettings);
  const stalePaths: string[] = [];

  function mergeNode(
    gen: ParameterNode | undefined,
    ex: ParameterNode | undefined,
    path: string[],
  ): ParameterNode | undefined {
    if (gen === undefined && ex !== undefined) {
      // Stale: in describe but not in appsettings
      if (isFieldMeta(ex)) {
        stalePaths.push(path.join("."));
        return { ...ex };
      }
      const staleChildren: Record<string, ParameterNode> = {};
      for (const [k, child] of Object.entries(ex as Record<string, ParameterNode>)) {
        const merged = mergeNode(undefined, child, [...path, k]);
        if (merged) staleChildren[k] = merged;
      }
      return Object.keys(staleChildren).length > 0 ? staleChildren : undefined;
    }

    if (gen !== undefined && ex === undefined) {
      return gen;
    }

    if (gen === undefined && ex === undefined) {
      return undefined;
    }

    // Both defined from here
    const genNode = gen as ParameterNode;
    const exNode = ex as ParameterNode;

    if (isFieldMeta(genNode) || isFieldMeta(exNode)) {
      if (isFieldMeta(exNode) && isFieldMeta(genNode)) {
        // Keep describe metadata (including InitialValue) — defaults never
        // follow live appsettings values.
        return { ...exNode };
      }
      if (isFieldMeta(exNode) && !isFieldMeta(genNode)) {
        return genNode;
      }
      return genNode;
    }

    const genObj = genNode as Record<string, ParameterNode>;
    const exObj = exNode as Record<string, ParameterNode>;
    const keys = new Set([...Object.keys(genObj), ...Object.keys(exObj)]);
    const result: Record<string, ParameterNode> = {};
    for (const key of keys) {
      const merged = mergeNode(genObj[key], exObj[key], [...path, key]);
      if (merged !== undefined) {
        result[key] = merged;
      }
    }
    return result;
  }

  const mergedParams =
    (mergeNode(generated as ParameterNode, existing.Parameters as ParameterNode, []) as
      | Record<string, ParameterNode>
      | undefined) ?? {};

  return {
    describe: {
      TargetFile: targetFileName,
      Parameters: mergedParams,
    },
    stalePaths,
  };
}

/** Build appsettings object from flat path -> value map using describe structure */
export function buildAppsettingsFromValues(
  describe: DescribeConfig,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const fields = flattenParameters(describe.Parameters);

  for (const field of fields) {
    const key = field.path.join(".");
    let value: unknown;
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      value = coerceValue(values[key], field.meta.Type);
    } else {
      value = field.meta.InitialValue;
    }
    setAtPath(result, field.path, value);
  }
  return result;
}

export function coerceValue(value: unknown, type: FieldType): unknown {
  if (type === "number") {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "") {
      const n = Number(value);
      if (!Number.isNaN(n)) return n;
    }
    return value;
  }
  if (type === "boolean") {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    return Boolean(value);
  }
  if (type === "json") {
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }
  if (type === "dropdown" || type === "string") {
    return value === undefined || value === null ? "" : String(value);
  }
  return value === undefined || value === null ? "" : String(value);
}

export function valuesFromAppsettings(
  describe: DescribeConfig,
  appsettings: unknown,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  const root = isPlainObject(appsettings) ? appsettings : {};
  for (const field of flattenParameters(describe.Parameters)) {
    const key = field.path.join(".");
    const fromFile = getAtPath(root, field.path);
    values[key] =
      fromFile !== undefined ? fromFile : field.meta.InitialValue;
  }
  return values;
}

/** Update FieldMeta at path in Parameters tree (immutable) */
export function updateFieldMeta(
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
    return {
      ...parameters,
      [head!]: { ...node, ...patch },
    };
  }

  if (isFieldMeta(node)) return parameters;
  return {
    ...parameters,
    [head!]: updateFieldMeta(
      node as Record<string, ParameterNode>,
      rest,
      patch,
    ),
  };
}
