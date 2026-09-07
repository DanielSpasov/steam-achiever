import os from "os";
import path from "path";
import fs from "fs";
import { execFileSync } from "child_process";

function candidates(): string[] {
  const home = os.homedir();

  if (process.platform === "darwin") {
    return [path.join(home, "Library", "Application Support", "Steam")];
  }

  if (process.platform === "win32") {
    const list: string[] = [];
    try {
      const out = execFileSync("reg", ["query", "HKCU\\Software\\Valve\\Steam", "/v", "SteamPath"], {
        encoding: "utf8",
        windowsHide: true,
      });
      const match = out.match(/SteamPath\s+REG_SZ\s+(.+)/i);
      if (match) list.push(match[1].trim().replace(/\//g, "\\"));
    } catch {
      // registry query not available
    }
    list.push("C:\\Program Files (x86)\\Steam", "C:\\Program Files\\Steam");
    return list;
  }

  return [
    path.join(home, ".steam", "steam"),
    path.join(home, ".local", "share", "Steam"),
    path.join(home, ".steam", "root"),
    path.join(home, ".var", "app", "com.valvesoftware.Steam", ".local", "share", "Steam"),
  ];
}

export function findSteamRoot(): string | null {
  for (const dir of candidates()) {
    try {
      if (fs.existsSync(path.join(dir, "steamapps"))) return dir;
    } catch {
      // keep looking
    }
  }
  return null;
}
