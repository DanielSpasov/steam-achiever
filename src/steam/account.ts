import fs from "fs";
import path from "path";
import { parseVdf, VdfNode } from "./vdf";

export interface SteamAccount {
  steamId64: string;
  accountName: string;
  personaName: string;
}

// Reads the most recently signed-in account from config/loginusers.vdf.
export function readAccount(steamRoot: string): SteamAccount | null {
  let data: VdfNode;
  try {
    data = parseVdf(fs.readFileSync(path.join(steamRoot, "config", "loginusers.vdf"), "utf8"));
  } catch {
    return null;
  }

  const users = (data.users || data.Users) as VdfNode | undefined;
  if (!users || typeof users !== "object") return null;

  let best: (SteamAccount & { score: number }) | null = null;
  for (const id of Object.keys(users)) {
    const u = users[id];
    if (typeof u !== "object") continue;
    const score = (String(u.MostRecent) === "1" ? 1e13 : 0) + Number(u.Timestamp || 0);
    if (!best || score > best.score) {
      best = {
        score,
        steamId64: id,
        accountName: typeof u.AccountName === "string" ? u.AccountName : "",
        personaName: typeof u.PersonaName === "string" ? u.PersonaName : "",
      };
    }
  }
  if (!best) return null;
  const { score: _score, ...account } = best;
  return account;
}
