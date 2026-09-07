import { exec } from "child_process";

export interface RunningTarget {
  appid: string;
  installDir: string;
}

function run(cmd: string): Promise<string> {
  return new Promise((resolve) => {
    exec(cmd, { windowsHide: true, timeout: 4000, maxBuffer: 8 * 1024 * 1024 }, (_e, stdout) =>
      resolve(stdout || ""),
    );
  });
}

// Whether the full Steam client (not just a background helper) is running.
export async function isSteamRunning(): Promise<boolean> {
  let cmd: string;
  if (process.platform === "darwin") {
    cmd = "ps -axo command | grep -i 'MacOS/steam_osx' | grep -v grep";
  } else if (process.platform === "win32") {
    cmd = 'tasklist /FI "IMAGENAME eq steam.exe" /NH';
  } else {
    cmd = 'pgrep -x steam || pgrep -x steam.sh || pgrep -f "ubuntu12_32/steam"';
  }
  const out = (await run(cmd)).trim();
  if (process.platform === "win32") return /steam\.exe/i.test(out);
  return out.length > 0;
}

async function processPaths(): Promise<string> {
  const cmd =
    process.platform === "win32"
      ? 'powershell -NoProfile -Command "Get-Process | Where-Object { $_.Path } | ForEach-Object { $_.Path }"'
      : "ps -axo command";
  return run(cmd);
}

// Returns the appid of the first target whose game process is running, found by
// matching a live process path against steamapps/common/<installDir>/.
export async function findRunningGame(targets: RunningTarget[]): Promise<string | null> {
  const usable = targets.filter((t) => t.installDir);
  if (!usable.length) return null;

  const haystack = (await processPaths()).toLowerCase();
  if (!haystack) return null;

  for (const t of usable) {
    const dir = t.installDir.toLowerCase();
    if (
      haystack.includes(`steamapps/common/${dir}/`) ||
      haystack.includes(`steamapps\\common\\${dir}\\`)
    ) {
      return t.appid;
    }
  }
  return null;
}
