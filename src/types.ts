// Online classification derived from Steam store categories.
//   none        no meaningful online play
//   mp-only     multiplayer with no single-player mode
//   pvp         PvP / MMO with no single-player mode
//   online-pvp  has PvP / MMO but also a single-player mode
export type OnlineTier = "none" | "mp-only" | "pvp" | "online-pvp";

export interface GameInfo {
  appid: string;
  name: string;
  installed: boolean;
  vac: boolean;
  onlineTier: OnlineTier;
  headerUrl: string;
  capsuleUrl: string;
  installDir?: string;
  playtime?: number;
}

export interface Achievement {
  apiName: string;
  displayName: string;
  description: string;
  hidden: boolean;
  bit: number;
  icon: string;
  iconGray: string;
}

export interface AchievementState extends Achievement {
  unlocked: boolean;
  risky: boolean;
}

export interface Schema {
  available: boolean;
  achievements: Achievement[];
  error?: string;
}

export interface Settings {
  webApiKey: string;
  riskAccepted: boolean;
  autoCloseOnVacGame: boolean;
}

export type GamesResult = {
  games: GameInfo[];
  error?: string;
  ownedSource: "webapi" | "local" | "none";
  ownedError: string | null;
  hasKey: boolean;
  steamRunning: boolean;
};

export type AchievementsResult = {
  available: boolean;
  error: string | null;
  connected: boolean;
  connectError: string | null;
  owned: boolean | null;
  steamId: string | null;
  editingEnabled: boolean;
  vac: boolean;
  onlineTier: OnlineTier;
  achievements: AchievementState[];
  total: number;
  unlocked: number;
};

export type SetResult = {
  ok: boolean;
  unlocked?: boolean;
  error?: string | null;
  risky?: boolean;
  vac?: boolean;
};

export type SetAllResult = {
  ok: boolean;
  failed?: number;
  skippedRisky?: number;
  changed?: number;
  vac?: boolean;
  error?: string;
  results?: Record<string, boolean | null>;
};

// Messages between the main process and a Steamworks worker.
export type WorkerOut =
  | { type: "ready"; ok: true; appid: number; steamId: string | null; owned: boolean }
  | { type: "ready"; ok: false; appid: number; error: string }
  | { type: "states"; reqId: number; data: Record<string, boolean> }
  | { type: "set"; reqId: number; name: string; ok: boolean; unlocked: boolean; error: string | null }
  | { type: "error"; reqId: number; error: string };

export type WorkerIn =
  | { type: "states"; reqId: number; names: string[] }
  | { type: "set"; reqId: number; name: string; unlocked: boolean; armed: boolean };

// A worker request before the pool assigns it a reqId.
export type WorkerRequest =
  | { type: "states"; names: string[] }
  | { type: "set"; name: string; unlocked: boolean; armed: boolean };
