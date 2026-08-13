import path from "node:path";
import { fileURLToPath } from "node:url";
import open from "open";
import { startServer } from "./server/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv: string[]) {
  let port = 0;
  let noOpen = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--no-open") {
      noOpen = true;
    } else if (arg === "--port" && argv[i + 1]) {
      port = Number(argv[++i]);
    } else if (arg?.startsWith("--port=")) {
      port = Number(arg.slice("--port=".length));
    }
  }
  return { port, noOpen };
}

async function main() {
  const { port: preferredPort, noOpen } = parseArgs(process.argv.slice(2));
  const staticDir = path.join(__dirname, "web");
  const { port } = await startServer({
    port: preferredPort || 0,
    staticDir,
  });
  const url = `http://127.0.0.1:${port}`;
  console.log(`setly running at ${url}`);
  if (!noOpen) {
    await open(url);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
