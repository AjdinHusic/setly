import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import open from "open";
import { startServer } from "./server/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function printHelp() {
  console.log(`Usage: setly [path] [options]

  path                Optional folder or config file to open immediately
                      Folder  → scan as a project (e.g. setly .)
                      File    → scan parent project and open that config
                                (e.g. setly ./appsettings.json)

Options:
  --port <n>          Listen on a fixed port (default: ephemeral)
  --no-open           Do not launch the browser
  -h, --help          Show this help
`);
}

function parseArgs(argv: string[]) {
  let port = 0;
  let noOpen = false;
  let help = false;
  let targetPath: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--no-open") {
      noOpen = true;
    } else if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--port" && argv[i + 1]) {
      port = Number(argv[++i]);
    } else if (arg.startsWith("--port=")) {
      port = Number(arg.slice("--port=".length));
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (targetPath === undefined) {
      targetPath = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  return { port, noOpen, help, targetPath };
}

async function buildLaunchPath(targetPath: string): Promise<string> {
  const resolved = path.resolve(targetPath);
  const stat = await fs.stat(resolved).catch(() => null);
  if (!stat) {
    throw new Error(`Path not found: ${resolved}`);
  }

  if (stat.isDirectory()) {
    return `/?scan=${encodeURIComponent(resolved)}`;
  }

  if (!stat.isFile()) {
    throw new Error(`Not a file or directory: ${resolved}`);
  }

  return `/?scan=${encodeURIComponent(resolved)}&open=${encodeURIComponent(resolved)}`;
}

async function main() {
  const { port: preferredPort, noOpen, help, targetPath } = parseArgs(
    process.argv.slice(2),
  );

  if (help) {
    printHelp();
    return;
  }

  let launchPath = "/";
  if (targetPath) {
    launchPath = await buildLaunchPath(targetPath);
  }

  const staticDir = path.join(__dirname, "web");
  const { port } = await startServer({
    port: preferredPort || 0,
    staticDir,
  });
  const url = `http://127.0.0.1:${port}${launchPath}`;
  console.log(`setly running at http://127.0.0.1:${port}`);
  if (targetPath) {
    console.log(`Opening: ${path.resolve(targetPath)}`);
  }
  if (!noOpen) {
    await open(url);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
