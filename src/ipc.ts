import { ipcMain } from "electron";
import { context, gameById, isVacGame, isFullyOnlineGame, onlineTier } from "./context";
import { listGames, imageUrls } from "./steam/library";
import { readSchema } from "./steam/schema";
import { fetchSchema } from "./steam/webschema";
import { readAppInfo } from "./steam/appinfo";
import { readAccount } from "./steam/account";
import { fetchOwnedGames } from "./steam/owned";
import { isRiskyAchievement } from "./steam/risk";
import { isSteamRunning } from "./steam/detect";
import { readSettings, writeSettings } from "./settings";
import { ensureWorker, workerRequest } from "./worker-pool";
import type { AchievementState, GameInfo, Settings } from "./types";

function refreshGames(): GameInfo[] {
  if (!context.steamRoot) return [];
  context.games = listGames(context.steamRoot);
  return context.games;
}

export function registerIpc(): void {
  ipcMain.handle("app:init", async () => {
    const settings = readSettings();
    return {
      hasSteamRoot: !!context.steamRoot,
      running: await isSteamRunning(),
      editingEnabled: context.editingEnabled,
      riskAccepted: settings.riskAccepted,
      autoCloseOnVacGame: settings.autoCloseOnVacGame,
    };
  });

  ipcMain.handle("edit:get", () => ({ editingEnabled: context.editingEnabled }));
  ipcMain.handle("edit:set", (_e, enabled: boolean) => {
    context.editingEnabled = !!enabled;
    return { editingEnabled: context.editingEnabled };
  });

  ipcMain.handle("settings:get", () => readSettings());
  ipcMain.handle("settings:set", (_e, patch: Partial<Settings>) =>
    writeSettings({
      webApiKey: typeof patch.webApiKey === "string" ? patch.webApiKey.trim() : undefined,
      riskAccepted: typeof patch.riskAccepted === "boolean" ? patch.riskAccepted : undefined,
      autoCloseOnVacGame:
        typeof patch.autoCloseOnVacGame === "boolean" ? patch.autoCloseOnVacGame : undefined,
    }),
  );

  ipcMain.handle("games:list", async () => {
    if (!context.steamRoot) {
      return { games: [], error: "Could not find your Steam installation." };
    }

    const byId = new Map<string, GameInfo>();
    for (const game of refreshGames()) byId.set(game.appid, game);

    const running = await isSteamRunning();
    const { webApiKey } = readSettings();
    let ownedSource: "webapi" | "local" | "none" = webApiKey ? "none" : "local";
    let ownedError: string | null = null;

    if (webApiKey) {
      const account = readAccount(context.steamRoot);
      const appInfo = readAppInfo(context.steamRoot);
      const result = await fetchOwnedGames(account?.steamId64 ?? null, webApiKey);
      ownedSource = result.source === "webapi" ? "webapi" : "none";
      ownedError = result.error;
      for (const game of result.games) {
        const existing = byId.get(game.appid);
        if (existing) {
          existing.playtime = game.playtime;
          if (!existing.name || /^App \d+$/.test(existing.name)) existing.name = game.name;
        } else {
          const info = appInfo.get(game.appid);
          byId.set(game.appid, {
            appid: game.appid,
            name: game.name,
            installed: false,
            vac: info?.vac ?? false,
            onlineTier: info?.onlineTier ?? "none",
            ...imageUrls(game.appid, info),
            playtime: game.playtime,
          });
        }
      }
    }

    const games = [...byId.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
    context.games = games;

    return { games, ownedSource, ownedError, hasKey: !!webApiKey, steamRunning: running };
  });

  ipcMain.handle("game:achievements", async (_e, appid: string) => {
    if (!context.steamRoot) {
      return { available: false, achievements: [], error: "Steam installation not found." };
    }

    const schema = readSchema(context.steamRoot, appid);
    const vac = isVacGame(appid);
    const tier = onlineTier(appid);
    const wholeGameRisky = isFullyOnlineGame(appid);

    let list = schema.achievements;
    let available = schema.available;

    // Fall back to the Web API for games Steam has not cached locally.
    if (!available) {
      const fetched = await fetchSchema(appid, readSettings().webApiKey);
      if (fetched.length) {
        list = fetched;
        available = true;
      }
    }

    const decorate = (states: Record<string, boolean>): AchievementState[] =>
      list.map((a) => ({
        ...a,
        unlocked: !!states[a.apiName],
        risky: wholeGameRisky || isRiskyAchievement(a.displayName, a.description),
      }));

    // Never connect to a VAC game: init would mark it "running". Reference only.
    if (vac) {
      const achievements = decorate({});
      return {
        available,
        error: schema.error ?? null,
        connected: false,
        connectError: null,
        owned: null,
        steamId: null,
        editingEnabled: context.editingEnabled,
        vac: true,
        onlineTier: tier,
        achievements,
        total: achievements.length,
        unlocked: 0,
      };
    }

    let connected = false;
    let owned: boolean | null = null;
    let steamId: string | null = null;
    let connectError: string | null = null;

    if (available && list.length) {
      const ready = await ensureWorker(Number(appid));
      if (ready.ok) {
        connected = true;
        owned = ready.owned;
        steamId = ready.steamId;
      } else {
        connectError = ready.error || "Steam is not running.";
      }
    } else {
      connected = await isSteamRunning();
    }

    let states: Record<string, boolean> = {};
    if (connected && list.length) {
      try {
        const res = await workerRequest({ type: "states", names: list.map((a) => a.apiName) });
        if (res.type === "states") states = res.data;
      } catch (e) {
        connectError = String((e as Error).message || e);
      }
    }

    const achievements = decorate(states);
    return {
      available,
      error: schema.error ?? null,
      connected,
      connectError,
      owned,
      steamId,
      editingEnabled: context.editingEnabled,
      vac: false,
      onlineTier: tier,
      achievements,
      total: achievements.length,
      unlocked: achievements.filter((a) => a.unlocked).length,
    };
  });

  ipcMain.handle(
    "achievement:set",
    async (_e, args: { appid: string; apiName: string; unlocked: boolean; force?: boolean }) => {
      if (!context.editingEnabled) return { ok: false, error: "Editing is turned off." };
      if (isVacGame(args.appid)) {
        return { ok: false, error: "Blocked: this game uses Valve Anti-Cheat.", vac: true };
      }

      if (!args.force) {
        const achievement = context.steamRoot
          ? readSchema(context.steamRoot, args.appid).achievements.find(
              (a) => a.apiName === args.apiName,
            )
          : undefined;
        const risky =
          isFullyOnlineGame(args.appid) ||
          (achievement
            ? isRiskyAchievement(achievement.displayName, achievement.description)
            : false);
        if (risky) return { ok: false, error: "risky", risky: true };
      }

      const ready = await ensureWorker(Number(args.appid));
      if (!ready.ok) return { ok: false, error: ready.error || "Steam is not running." };
      if (ready.owned === false) {
        return { ok: false, error: "This Steam account does not own this game." };
      }

      try {
        const res = await workerRequest({
          type: "set",
          name: args.apiName,
          unlocked: args.unlocked,
          armed: true,
        });
        if (res.type === "set") return { ok: res.ok, unlocked: res.unlocked, error: res.error };
        return { ok: false, error: "unexpected worker reply" };
      } catch (e) {
        return { ok: false, error: String((e as Error).message || e) };
      }
    },
  );

  ipcMain.handle(
    "game:setAll",
    async (
      _e,
      args: { appid: string; apiNames: string[]; unlocked: boolean; includeRisky?: boolean },
    ) => {
      if (!context.editingEnabled) return { ok: false, error: "Editing is turned off." };
      if (isVacGame(args.appid)) {
        return { ok: false, error: "Blocked: this game uses Valve Anti-Cheat.", vac: true };
      }

      let names = args.apiNames;
      let skippedRisky = 0;
      if (!args.includeRisky) {
        if (isFullyOnlineGame(args.appid)) {
          skippedRisky = names.length;
          names = [];
        } else if (context.steamRoot) {
          const risky = new Set(
            readSchema(context.steamRoot, args.appid)
              .achievements.filter((a) => isRiskyAchievement(a.displayName, a.description))
              .map((a) => a.apiName),
          );
          const safe = names.filter((n) => !risky.has(n));
          skippedRisky = names.length - safe.length;
          names = safe;
        }
      }

      const ready = await ensureWorker(Number(args.appid));
      if (!ready.ok) return { ok: false, error: ready.error || "Steam is not running." };
      if (ready.owned === false) {
        return { ok: false, error: "This Steam account does not own this game." };
      }

      const results: Record<string, boolean | null> = {};
      let failed = 0;
      for (const name of names) {
        try {
          const res = await workerRequest({
            type: "set",
            name,
            unlocked: args.unlocked,
            armed: true,
          });
          results[name] = res.type === "set" ? res.unlocked : null;
          if (res.type !== "set" || !res.ok) failed++;
        } catch {
          results[name] = null;
          failed++;
        }
      }
      return { ok: failed === 0, failed, skippedRisky, changed: names.length, results };
    },
  );
}

// Populate the game cache once at startup so the VAC guard has a watch list
// before the renderer asks for anything.
export function primeGameCache(): void {
  try {
    refreshGames();
  } catch {
    // filled in on the first games:list
  }
}
