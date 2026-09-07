import https from "https";
import type { Achievement } from "../types";

function get(url: string, timeout = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "steam-achiever" } }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve(body));
    });
    req.on("error", reject);
    req.setTimeout(timeout, () => req.destroy(new Error("request timed out")));
  });
}

// Achievement schema from the Steam Web API, for games Steam has not cached
// locally. Needs a user Web API key. Returns [] when the game has none or the
// call fails.
export async function fetchSchema(appid: string, apiKey: string): Promise<Achievement[]> {
  if (!apiKey) return [];
  try {
    const url =
      `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/` +
      `?key=${encodeURIComponent(apiKey)}&appid=${encodeURIComponent(appid)}&l=english`;
    const json = JSON.parse(await get(url)) as {
      game?: {
        availableGameStats?: {
          achievements?: Array<{
            name?: string;
            displayName?: string;
            description?: string;
            hidden?: number;
            icon?: string;
            icongray?: string;
          }>;
        };
      };
    };
    const list = json.game?.availableGameStats?.achievements ?? [];
    return list
      .filter((a) => a.name)
      .map((a, index) => ({
        apiName: String(a.name),
        displayName: a.displayName || String(a.name),
        description: a.description || "",
        hidden: a.hidden === 1,
        bit: index,
        icon: a.icon || "",
        iconGray: a.icongray || "",
      }));
  } catch {
    return [];
  }
}
