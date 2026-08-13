import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type BrowseMode = "file" | "directory" | "save";

export class BrowseCancelledError extends Error {
  constructor() {
    super("Selection cancelled");
    this.name = "BrowseCancelledError";
  }
}

function trimPath(stdout: string): string {
  return stdout.trim().replace(/\r?\n$/, "");
}

function escapeAppleScriptString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function browseDarwin(
  mode: BrowseMode,
  defaultName?: string,
): Promise<string> {
  let script: string;
  if (mode === "directory") {
    script =
      'POSIX path of (choose folder with prompt "Select project folder")';
  } else if (mode === "save") {
    const name = escapeAppleScriptString(defaultName?.trim() || "config");
    script = `POSIX path of (choose file name with prompt "Save generated config as" default name "${name}")`;
  } else {
    script =
      'POSIX path of (choose file of type {"public.json", "json", "public.plain-text"} with prompt "Select a config file")';
  }

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

async function browseLinux(
  mode: BrowseMode,
  defaultName?: string,
): Promise<string> {
  let args: string[];
  if (mode === "directory") {
    args = ["--file-selection", "--directory", "--title=Select project folder"];
  } else if (mode === "save") {
    args = [
      "--file-selection",
      "--save",
      "--confirm-overwrite",
      "--title=Save generated config",
    ];
    if (defaultName?.trim()) {
      args.push(`--filename=${defaultName.trim()}`);
    }
  } else {
    args = [
      "--file-selection",
      "--title=Select appsettings.json",
      "--file-filter=JSON files | *.json",
      "--file-filter=All files | *",
    ];
  }

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

async function browseWindows(
  mode: BrowseMode,
  defaultName?: string,
): Promise<string> {
  const safeDefault = (defaultName ?? "config").replace(/'/g, "''");
  let ps: string;
  if (mode === "directory") {
    ps = `
Add-Type -AssemblyName System.Windows.Forms;
$d = New-Object System.Windows.Forms.FolderBrowserDialog;
$d.Description = 'Select project folder';
if ($d.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 1 };
[Console]::Out.Write($d.SelectedPath)
`;
  } else if (mode === "save") {
    ps = `
Add-Type -AssemblyName System.Windows.Forms;
$d = New-Object System.Windows.Forms.SaveFileDialog;
$d.Filter = 'All files (*.*)|*.*|JSON files (*.json)|*.json|Env files (*.env)|*.env';
$d.Title = 'Save generated config';
$d.FileName = '${safeDefault}';
if ($d.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 1 };
[Console]::Out.Write($d.FileName)
`;
  } else {
    ps = `
Add-Type -AssemblyName System.Windows.Forms;
$d = New-Object System.Windows.Forms.OpenFileDialog;
$d.Filter = 'JSON files (*.json)|*.json|All files (*.*)|*.*';
$d.Title = 'Select appsettings.json';
if ($d.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 1 };
[Console]::Out.Write($d.FileName)
`;
  }

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
export async function browseNativePath(
  mode: BrowseMode,
  options?: { defaultName?: string },
): Promise<string> {
  const defaultName = options?.defaultName;
  switch (process.platform) {
    case "darwin":
      return browseDarwin(mode, defaultName);
    case "win32":
      return browseWindows(mode, defaultName);
    default:
      return browseLinux(mode, defaultName);
  }
}
