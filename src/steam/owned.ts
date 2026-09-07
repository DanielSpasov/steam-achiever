import https from "https";

export interface OwnedGame {
  appid: string;
  name: string;
  playtime: number;
}

export interface OwnedResult {
  source: "webapi" | "none";
  games: OwnedGame[];
  error: string | null;
}

function get(url: string, timeout = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "steam-achiever" } }, (res) => {
      const status = res.statusCode ?? 0;
      if (status !== 200) {
        res.resume();
        reject(new Error(`HTTP ${status}`));
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

// Full owned library from the Steam Web API. Needs a user-supplied key.
export async function fetchOwnedGames(steamId64: string | null, apiKey: string): Promise<OwnedResult> {
  if (!steamId64) return { source: "none", games: [], error: "no Steam ID" };
  if (!apiKey) return { source: "none", games: [], error: "no API key" };

  try {
    const url =
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${encodeURIComponent(apiKey)}` +
      `&steamid=${encodeURIComponent(steamId64)}&include_appinfo=1&include_played_free_games=1&format=json`;
    const json = JSON.parse(await get(url)) as {
      response?: { game_count?: number; games?: Array<{ appid: number; name?: string; playtime_forever?: number }> };
    };
    const games = json.response?.games ?? [];
    if (!games.length && json.response?.game_count === undefined) {
      throw new Error("no data returned (bad key or private profile)");
    }
    return {
      source: "webapi",
      games: games.map((g) => ({
        appid: String(g.appid),
        name: g.name || `App ${g.appid}`,
        playtime: g.playtime_forever ?? 0,
      })),
      error: null,
    };
  } catch (e) {
    return { source: "none", games: [], error: (e as Error).message };
  }
}
