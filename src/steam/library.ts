import fs from "fs";
import path from "path";
import { parseVdf, VdfNode } from "./vdf";
import { readAppInfo, AppInfo } from "./appinfo";
import { readGameName } from "./schema";
import type { GameInfo } from "../types";

const ASSETS = "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps";

// Store assets use a hash-prefixed path for newer games and a bare filename for
// older ones; `common.header_image` in appinfo.vdf gives whichever applies.
export function imageUrls(appid: string, info?: AppInfo): { headerUrl: string; capsuleUrl: string } {
  const header = info?.headerPath || "header.jpg";
  const capsule = info?.capsulePath || "library_600x900.jpg";
  return {
    headerUrl: `${ASSETS}/${appid}/${header}`,
    capsuleUrl: `${ASSETS}/${appid}/${capsule}`,
  };
}

// Steam runtimes and redistributables that have an appmanifest but are not games.
const IGNORE = new Set([
  "228980", "1070560", "1391110", "1628350", "1493710", "1580130",
  "1826330", "2180100", "2230260", "2805730", "1887720", "250820", "323910",
]);

// appinfo `type` values that should not appear in the game list.
const NON_GAME_TYPES = new Set([
  "tool", "config", "demo", "dlc", "music", "video", "hardware", "series", "media", "beta",
]);

function libraryFolders(steamRoot: string): string[] {
  const folders = new Set<string>([steamRoot]);
  try {
    const data = parseVdf(
      fs.readFileSync(path.join(steamRoot, "steamapps", "libraryfolders.vdf"), "utf8"),
    );
    const list = (data.libraryfolders || data.LibraryFolders) as VdfNode | undefined;
    if (list && typeof list === "object") {
      for (const key of Object.keys(list)) {
        const entry = list[key];
        if (entry && typeof entry === "object" && typeof entry.path === "string") {
          folders.add(entry.path);
        } else if (typeof entry === "string" && /[\\/]/.test(entry)) {
          folders.add(entry);
        }
      }
    }
  } catch {
    // fall back to the root library only
  }
  return [...folders];
}

function installedGames(steamRoot: string, appInfo: Map<string, AppInfo>): GameInfo[] {
  const games: GameInfo[] = [];
  const seen = new Set<string>();

  for (const folder of libraryFolders(steamRoot)) {
    const dir = path.join(folder, "steamapps");
    let files: string[];
    try {
      files = fs.readdirSync(dir);
    } catch {
      continue;
    }

    for (const file of files) {
      const match = file.match(/^appmanifest_(\d+)\.acf$/);
      if (!match) continue;
      const appid = match[1];
      if (IGNORE.has(appid) || seen.has(appid)) continue;

      try {
        const manifest = parseVdf(fs.readFileSync(path.join(dir, file), "utf8"));
        const state = (manifest.AppState || manifest.appstate) as VdfNode | undefined;
        const name = state && typeof state === "object" ? state.name || state.Name : undefined;
        if (typeof name !== "string" || !name) continue;
        seen.add(appid);
        const info = appInfo.get(appid);
        games.push({
          appid,
          name,
          installed: true,
          vac: info?.vac ?? false,
          onlineTier: info?.onlineTier ?? "none",
          ...imageUrls(appid, info),
          installDir:
            state && typeof state.installdir === "string" ? state.installdir : info?.installDir || "",
        });
      } catch {
        // skip an unreadable manifest
      }
    }
  }

  return games;
}

// appids with cached library artwork are the games in this account's library.
function libraryCacheAppids(steamRoot: string): string[] {
  try {
    return fs
      .readdirSync(path.join(steamRoot, "appcache", "librarycache"), { withFileTypes: true })
      .filter((e) => e.isDirectory() && /^\d+$/.test(e.name))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

// Installed games plus everything else in the local library cache. No network.
export function listGames(steamRoot: string): GameInfo[] {
  const appInfo = readAppInfo(steamRoot);
  const byId = new Map<string, GameInfo>();
  for (const game of installedGames(steamRoot, appInfo)) byId.set(game.appid, game);

  for (const appid of libraryCacheAppids(steamRoot)) {
    if (byId.has(appid) || IGNORE.has(appid)) continue;
    const info = appInfo.get(appid);
    if (info && NON_GAME_TYPES.has(info.type.toLowerCase())) continue;

    const name = info?.name || readGameName(steamRoot, appid) || "";
    if (!name && !(info && info.type.toLowerCase() === "game")) continue;

    byId.set(appid, {
      appid,
      name: name || `App ${appid}`,
      installed: false,
      vac: info?.vac ?? false,
      onlineTier: info?.onlineTier ?? "none",
      ...imageUrls(appid, info),
      installDir: info?.installDir || "",
    });
  }

  return [...byId.values()];
}
