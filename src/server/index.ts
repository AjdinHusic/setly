import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BrowseCancelledError, browseNativePath } from "./browse.js";
import {
  describePathFor,
  pathExists,
  readJsonFile,
  readTextFile,
  resolveExistingPath,
  scanForConfigs,
  writeJsonFile,
  writeTextFile,
} from "./configIo.js";
import {
  buildAppsettingsFromValues,
  describeHasFlatSeparatorKeys,
  expandFlatDescribeParameters,
  generateDescribe,
  mergeDescribe,
  valuesFromAppsettings,
} from "./describe.js";
import {
  DEFAULT_ENV_SEPARATOR,
  detectEnvSeparator,
  unflattenEnvRecord,
  type KeyCasing,
} from "./nesting.js";
import { listProviderInfo, getProvider, providerForPath } from "./providers/index.js";
import type { ProviderId } from "./providers/types.js";
import type { DescribeConfig } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(options?: { staticDir?: string }) {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/providers", (_req, res) => {
    res.json({ providers: listProviderInfo() });
  });

  app.post("/api/browse", async (req, res) => {
    try {
      const rawMode = req.body?.mode;
      const mode =
        rawMode === "directory"
          ? "directory"
          : rawMode === "save"
            ? "save"
            : "file";
      const defaultName =
        typeof req.body?.defaultName === "string"
          ? req.body.defaultName
          : undefined;
      const selectedPath = await browseNativePath(mode, { defaultName });
      res.json({ path: selectedPath, mode });
    } catch (err) {
      if (err instanceof BrowseCancelledError) {
        res.json({ cancelled: true });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/projects/scan", async (req, res) => {
    try {
      const inputPath = req.body?.path;
      if (typeof inputPath !== "string" || !inputPath.trim()) {
        res.status(400).json({ error: "path is required" });
        return;
      }
      const maxDepth =
        typeof req.body?.maxDepth === "number" ? req.body.maxDepth : undefined;
      const result = await scanForConfigs(inputPath, maxDepth);
      if (result.configs.length === 0) {
        res.status(400).json({
          error:
            "No supported config files found (appsettings*.json, .env*). Try another folder.",
        });
        return;
      }
      res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: message });
    }
  });

  app.post("/api/open", async (req, res) => {
    try {
      const inputPath = req.body?.path;
      if (typeof inputPath !== "string" || !inputPath.trim()) {
        res.status(400).json({ error: "path is required" });
        return;
      }

      const targetPath = await resolveExistingPath(inputPath);
      const stat = await fs.stat(targetPath);
      if (stat.isDirectory()) {
        res.status(400).json({
          error: "Open a specific config file, not a folder. Add a project from home to scan folders.",
        });
        return;
      }

      const provider = providerForPath(targetPath);
      const raw = await readTextFile(targetPath);
      const parsed = provider.parse(raw);
      const targetFileName = path.basename(targetPath);
      const describePath = describePathFor(
        targetPath,
        provider.describeSiblingName(targetFileName),
      );

      let flatSource = parsed;
      let configData: Record<string, unknown> = parsed;
      let describe: DescribeConfig;
      let createdDescribe = false;
      let stalePaths: string[] = [];

      if (provider.id === "dotenv") {
        flatSource = parsed;
        const existingExists = await pathExists(describePath);
        const existing = existingExists
          ? await readJsonFile<DescribeConfig>(describePath)
          : null;
        const separator =
          existing?.Separator ??
          detectEnvSeparator(flatSource) ??
          DEFAULT_ENV_SEPARATOR;
        configData = unflattenEnvRecord(flatSource, separator);

        if (existing) {
          let base: DescribeConfig = {
            ...existing,
            Separator: separator,
            Parameters: describeHasFlatSeparatorKeys(
              existing.Parameters,
              separator,
            )
              ? expandFlatDescribeParameters(existing.Parameters, separator)
              : existing.Parameters,
          };
          const merged = mergeDescribe(base, configData, targetFileName);
          describe = {
            ...merged.describe,
            Separator: separator,
          };
          stalePaths = merged.stalePaths;
          await writeJsonFile(describePath, describe);
        } else {
          describe = generateDescribe(configData, targetFileName, {
            separator,
          });
          await writeJsonFile(describePath, describe);
          createdDescribe = true;
        }
      } else if (await pathExists(describePath)) {
        const existing = await readJsonFile<DescribeConfig>(describePath);
        const merged = mergeDescribe(existing, configData, targetFileName);
        describe = merged.describe;
        stalePaths = merged.stalePaths;
        await writeJsonFile(describePath, describe);
      } else {
        describe = generateDescribe(configData, targetFileName);
        await writeJsonFile(describePath, describe);
        createdDescribe = true;
      }

      const values = valuesFromAppsettings(describe, configData);

      res.json({
        targetPath,
        describePath,
        providerId: provider.id,
        providerLabel: provider.label,
        configData,
        flatSource: provider.id === "dotenv" ? flatSource : undefined,
        describe,
        values,
        createdDescribe,
        stalePaths,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const permissionHint = /EPERM|permission denied/i.test(message)
        ? " (disk permission denied — stop any old setly/node process and restart setly from your normal terminal)"
        : "";
      res.status(400).json({ error: `${message}${permissionHint}` });
    }
  });

  app.put("/api/describe", async (req, res) => {
    try {
      const { path: targetPathInput, describe } = req.body ?? {};
      if (typeof targetPathInput !== "string" || !targetPathInput.trim()) {
        res.status(400).json({ error: "path is required" });
        return;
      }
      if (!describe || typeof describe !== "object") {
        res.status(400).json({ error: "describe is required" });
        return;
      }

      const targetPath = await resolveExistingPath(targetPathInput);
      const provider = providerForPath(targetPath);
      const describePath = describePathFor(
        targetPath,
        provider.describeSiblingName(path.basename(targetPath)),
      );
      await writeJsonFile(describePath, describe as DescribeConfig);
      res.json({ ok: true, describePath, describe });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: message });
    }
  });

  app.post("/api/generate", async (req, res) => {
    try {
      const {
        path: targetPathInput,
        values,
        mode,
        outputProviderId,
        outputPath: outputPathInput,
        separator: separatorInput,
        casing: casingInput,
      } = req.body ?? {};
      if (typeof targetPathInput !== "string" || !targetPathInput.trim()) {
        res.status(400).json({ error: "path is required" });
        return;
      }
      if (!values || typeof values !== "object") {
        res.status(400).json({ error: "values is required" });
        return;
      }

      const generateMode =
        mode === "overwrite" ? "overwrite" : mode === "write" ? "write" : "preview";

      const targetPath = await resolveExistingPath(targetPathInput);
      const sourceProvider = providerForPath(targetPath);
      const describePath = describePathFor(
        targetPath,
        sourceProvider.describeSiblingName(path.basename(targetPath)),
      );
      if (!(await pathExists(describePath))) {
        res.status(400).json({
          error: "describe-config not found; open the target first",
        });
        return;
      }

      let outputProvider = sourceProvider;
      if (typeof outputProviderId === "string" && outputProviderId.trim()) {
        try {
          outputProvider = getProvider(outputProviderId as ProviderId);
        } catch {
          res.status(400).json({
            error: `Unknown output provider: ${outputProviderId}`,
          });
          return;
        }
      }

      const describe = await readJsonFile<DescribeConfig>(describePath);
      const configData = buildAppsettingsFromValues(
        describe,
        values as Record<string, unknown>,
      );

      const casing: KeyCasing =
        casingInput === "camelCase" ||
        casingInput === "PascalCase" ||
        casingInput === "UPPERCASE" ||
        casingInput === "lowercase" ||
        casingInput === "preserve"
          ? casingInput
          : "preserve";

      const separator =
        typeof separatorInput === "string" && separatorInput.length > 0
          ? separatorInput
          : (describe.Separator ?? DEFAULT_ENV_SEPARATOR);

      const text = outputProvider.serialize(configData, {
        separator,
        casing,
      });

      let writtenPath: string | null = null;
      if (generateMode === "overwrite") {
        if (outputProvider.id !== sourceProvider.id) {
          res.status(400).json({
            error:
              "Overwrite only writes the opened file’s native format. Choose Write to file for another format.",
          });
          return;
        }
        await writeTextFile(targetPath, text);
        writtenPath = targetPath;
      } else if (generateMode === "write") {
        if (typeof outputPathInput !== "string" || !outputPathInput.trim()) {
          res.status(400).json({ error: "outputPath is required for write mode" });
          return;
        }
        const outputPath = path.resolve(outputPathInput.trim());
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await writeTextFile(outputPath, text);
        writtenPath = outputPath;
      }

      res.json({
        ok: true,
        mode: generateMode,
        targetPath,
        writtenPath,
        providerId: sourceProvider.id,
        outputProviderId: outputProvider.id,
        configData,
        text,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: message });
    }
  });

  const staticDir = options?.staticDir ?? path.join(__dirname, "web");
  app.use(express.static(staticDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(staticDir, "index.html"), (err) => {
      if (err) next();
    });
  });

  return app;
}

export async function startServer(options: {
  port: number;
  staticDir?: string;
}): Promise<{ port: number; close: () => Promise<void> }> {
  const app = createApp({ staticDir: options.staticDir });
  const server = await new Promise<import("node:http").Server>(
    (resolve, reject) => {
      const s = app.listen(options.port, "127.0.0.1", () => resolve(s));
      s.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          reject(
            new Error(
              `Port ${options.port} is already in use. Stop the other setly/node process (lsof -nP -iTCP:${options.port} -sTCP:LISTEN) and restart.`,
            ),
          );
          return;
        }
        reject(err);
      });
    },
  );
  const address = server.address();
  const port =
    typeof address === "object" && address ? address.port : options.port;

  return {
    port,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
