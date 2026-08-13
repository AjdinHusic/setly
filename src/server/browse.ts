import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type BrowseMode = "file" | "directory";

export class BrowseCancelledError extends Error {
  constructor() {
    super("Selection cancelled");
    this.name = "BrowseCancelledError";
  }
}

function trimPath(stdout: string): string {
  return stdout.trim().replace(/\r?\n$/, "");
}

async function browseDarwin(mode: BrowseMode): Promise<string> {
  const script =
    mode === "directory"
      ? 'POSIX path of (choose folder with prompt "Select project folder")'
      : 'POSIX path of (choose file of type {"public.json", "json", "public.plain-text"} with prompt "Select a config file")';

  try {
    const { stdout } = await execFileAsync("osascript", ["-e", script], {
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
    });
    const selected = trimPath(stdout);
    if (!selected) throw new BrowseCancelledError();
    return selected;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // User pressed Cancel in the dialog
    if (
      message.includes("User canceled") ||
      message.includes("User cancelled") ||
      (err as { code?: number | string }).code === 1
    ) {
      throw new BrowseCancelledError();
    }
    throw err;
  }
}

async function browseLinux(mode: BrowseMode): Promise<string> {
  const args =
    mode === "directory"
      ? ["--file-selection", "--directory", "--title=Select project folder"]
      : [
        "--file-selection",
        "--title=Select appsettings.json",
        "--file-filter=JSON files | *.json",
        "--file-filter=All files | *",
      ];

  try {
    const { stdout } = await execFileAsync("zenity", args, {
      timeout: 120_000,
    });
    const selected = trimPath(stdout);
    if (!selected) throw new BrowseCancelledError();
    return selected;
  } catch (err) {
    const code = (err as { code?: number | string }).code;
    if (code === 1 || code === "1") throw new BrowseCancelledError();
    throw new Error(
      "Folder/file dialog requires zenity on Linux (install zenity).",
    );
  }
}

async function browseWindows(mode: BrowseMode): Promise<string> {
  const ps =
    mode === "directory"
      ? `
Add-Type -AssemblyName System.Windows.Forms;
$d = New-Object System.Windows.Forms.FolderBrowserDialog;
$d.Description = 'Select project folder';
if ($d.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 1 };
[Console]::Out.Write($d.SelectedPath)
`
      : `
Add-Type -AssemblyName System.Windows.Forms;
$d = New-Object System.Windows.Forms.OpenFileDialog;
$d.Filter = 'JSON files (*.json)|*.json|All files (*.*)|*.*';
$d.Title = 'Select appsettings.json';
if ($d.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 1 };
[Console]::Out.Write($d.FileName)
`;

  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-Command", ps],
      { timeout: 120_000 },
    );
    const selected = trimPath(stdout);
    if (!selected) throw new BrowseCancelledError();
    return selected;
  } catch (err) {
    const code = (err as { code?: number | string }).code;
    if (code === 1 || code === "1") throw new BrowseCancelledError();
    throw err;
  }
}

/** Open a native OS file/folder dialog and return the absolute path. */
export async function browseNativePath(mode: BrowseMode): Promise<string> {
  switch (process.platform) {
    case "darwin":
      return browseDarwin(mode);
    case "win32":
      return browseWindows(mode);
    default:
      return browseLinux(mode);
  }
}
