import fs from "fs";
import path from "path";
import { parseBinaryVdf, BinNode, BinValue } from "./binvdf";
import type { Achievement, Schema } from "../types";

const ICON_BASE = "https://shared.fastly.steamstatic.com/community_assets/images/apps";

function text(value: BinValue | undefined): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if (typeof value.english === "string") return value.english;
    const first = Object.values(value).find((v) => typeof v === "string");
    if (typeof first === "string") return first;
    if (typeof value.token === "string") return value.token;
    return "";
  }
  return String(value);
}

function schemaFile(steamRoot: string, appid: string | number): string {
  return path.join(steamRoot, "appcache", "stats", `UserGameStatsSchema_${appid}.bin`);
}

export function readGameName(steamRoot: string, appid: string | number): string | null {
  try {
    const file = schemaFile(steamRoot, appid);
    if (!fs.existsSync(file)) return null;
    const parsed = parseBinaryVdf(fs.readFileSync(file));
    const root = parsed[String(appid)] ?? parsed[Object.keys(parsed)[0] ?? ""];
    if (root && typeof root === "object" && typeof root.gamename === "string") return root.gamename;
    return null;
  } catch {
    return null;
  }
}

export function readSchema(steamRoot: string, appid: string | number): Schema {
  const file = schemaFile(steamRoot, appid);
  if (!fs.existsSync(file)) return { available: false, achievements: [] };

  let parsed: BinNode;
  try {
    parsed = parseBinaryVdf(fs.readFileSync(file));
  } catch (e) {
    return { available: false, achievements: [], error: (e as Error).message };
  }

  const rootVal = parsed[String(appid)] ?? parsed[Object.keys(parsed)[0] ?? ""];
  const root = (rootVal && typeof rootVal === "object" ? rootVal : {}) as BinNode;
  const stats = (root.stats && typeof root.stats === "object" ? root.stats : {}) as BinNode;

  const achievements: Achievement[] = [];
  for (const statKey of Object.keys(stats)) {
    const stat = stats[statKey];
    if (!stat || typeof stat !== "object" || !stat.bits || typeof stat.bits !== "object") continue;
    const bits = stat.bits as BinNode;

    for (const bitKey of Object.keys(bits)) {
      const entry = bits[bitKey];
      if (!entry || typeof entry !== "object" || typeof entry.name !== "string") continue;
      const display = (entry.display && typeof entry.display === "object" ? entry.display : {}) as BinNode;
      const icon = typeof display.icon === "string" ? display.icon : "";
      const iconGray = typeof display.icon_gray === "string" ? display.icon_gray : "";
      achievements.push({
        apiName: String(entry.name),
        displayName: text(display.name) || String(entry.name),
        description: text(display.desc),
        hidden: String(display.hidden) === "1",
        bit: typeof entry.bit === "number" ? entry.bit : Number(bitKey) || 0,
        icon: icon ? `${ICON_BASE}/${appid}/${icon}` : "",
        iconGray: iconGray ? `${ICON_BASE}/${appid}/${iconGray}` : "",
      });
    }
  }

  achievements.sort((a, b) => a.bit - b.bit);
  // An empty list means Steam only cached a stub; treat it as not available.
  return { available: achievements.length > 0, achievements };
}
