import type { GameInfo, OnlineTier } from "./types";

// Process-wide state shared between the IPC handlers and the VAC guard.

export const context = {
  steamRoot: null as string | null,

  // Refreshed on every games:list. Lets handlers look up a game by id without
  // re-scanning, and gives the VAC guard its watch list.
  games: [] as GameInfo[],

  // In memory only, always starts false. No write reaches Steam while it is off.
  editingEnabled: false,
};

export function gameById(appid: string): GameInfo | undefined {
  return context.games.find((g) => g.appid === String(appid));
}

export function isVacGame(appid: string): boolean {
  return gameById(appid)?.vac === true;
}

export function onlineTier(appid: string): OnlineTier {
  return gameById(appid)?.onlineTier ?? "none";
}

// True when the whole game is online with no single-player mode: every
// achievement is then treated as risky and bulk unlock is disabled.
export function isFullyOnlineGame(appid: string): boolean {
  const tier = onlineTier(appid);
  return tier === "pvp" || tier === "mp-only";
}
