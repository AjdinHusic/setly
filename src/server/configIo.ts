import fs from "node:fs/promises";
import path from "node:path";
import { providerForFileName, type DiscoveredConfig } from "./providers/index.js";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  "bin",
  "obj",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  "vendor",
  "__pycache__",
  ".vs",
  ".idea",
  "target",
  ".turbo",
  ".cache",
]);

export const DEFAULT_SCAN_DEPTH = 4;

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readTextFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf8");
}

export async function writeTextFile(
  filePath: string,
  text: string,
): Promise<void> {
  await fs.writeFile(filePath, text, "utf8");
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readTextFile(filePath);
  return JSON.parse(raw) as T;
}

export async function writeJsonFile(
  filePath: string,
  data: unknown,
): Promise<void> {
  await writeTextFile(filePath, `${JSON.stringify(data, null, 4)}\n`);
}

/** Resolve to an absolute existing path (file or directory). */
export async function resolveExistingPath(input: string): Promise<string> {
  const resolved = path.resolve(input.trim());
  const stat = await fs.stat(resolved).catch(() => null);
  if (!stat) {
    throw new Error(`Path not found: ${resolved}`);
  }
  return resolved;
}

export function describePathFor(
  targetPath: string,
  describeSiblingName: string,
): string {
  return path.join(path.dirname(targetPath), describeSiblingName);
}

async function walk(
  dir: string,
  root: string,
  depth: number,
  maxDepth: number,
  out: DiscoveredConfig[],
): Promise<void> {
  if (depth > maxDepth) return;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      await walk(full, root, depth + 1, maxDepth, out);
      continue;
    }
    if (!entry.isFile()) continue;
    const provider = providerForFileName(entry.name);
    if (!provider) continue;
    out.push({
      path: full,
      relativePath: path.relative(root, full).split(path.sep).join("/"),
      providerId: provider.id,
      displayName: entry.name,
    });
  }
}

/** Scan a folder (or the parent of a file) for known config files. */
export async function scanForConfigs(
  inputPath: string,
  maxDepth = DEFAULT_SCAN_DEPTH,
): Promise<{ rootPath: string; label: string; configs: DiscoveredConfig[] }> {
  const resolved = await resolveExistingPath(inputPath);
  const stat = await fs.stat(resolved);
  let rootPath: string;
  let seedFile: string | null = null;

  if (stat.isDirectory()) {
    rootPath = resolved;
  } else {
    seedFile = resolved;
    rootPath = path.dirname(resolved);
  }

  const configs: DiscoveredConfig[] = [];
  await walk(rootPath, rootPath, 0, maxDepth, configs);

  // Ensure a directly selected file is included even if provider matched
  if (seedFile) {
    const base = path.basename(seedFile);
    const provider = providerForFileName(base);
    if (provider && !configs.some((c) => c.path === seedFile)) {
      configs.push({
        path: seedFile,
        relativePath: path.relative(rootPath, seedFile).split(path.sep).join("/"),
        providerId: provider.id,
        displayName: base,
      });
    }
  }

  configs.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  return {
    rootPath,
    label: path.basename(rootPath),
    configs,
  };
}
