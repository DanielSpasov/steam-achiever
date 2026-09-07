type OnlineTier = "none" | "mp-only" | "pvp" | "online-pvp";

interface GameInfo {
  appid: string;
  name: string;
  installed: boolean;
  vac: boolean;
  onlineTier: OnlineTier;
  headerUrl: string;
  capsuleUrl: string;
  playtime?: number;
}

interface AchievementState {
  apiName: string;
  displayName: string;
  description: string;
  hidden: boolean;
  bit: number;
  icon: string;
  iconGray: string;
  unlocked: boolean;
  risky: boolean;
}

interface Settings {
  webApiKey: string;
  riskAccepted: boolean;
  autoCloseOnVacGame: boolean;
}

interface GamesResult {
  games: GameInfo[];
  error?: string;
  ownedSource?: "webapi" | "local" | "none";
  ownedError?: string | null;
  hasKey?: boolean;
  steamRunning?: boolean;
}

interface AchievementsResult {
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
}

interface SetResult {
  ok: boolean;
  unlocked?: boolean;
  error?: string | null;
  risky?: boolean;
  vac?: boolean;
}

interface SetAllResult {
  ok: boolean;
  failed?: number;
  skippedRisky?: number;
  changed?: number;
  vac?: boolean;
  error?: string;
  results?: Record<string, boolean | null>;
}

interface SteamApi {
  init(): Promise<{
    hasSteamRoot: boolean;
    running: boolean;
    editingEnabled: boolean;
    riskAccepted: boolean;
    autoCloseOnVacGame: boolean;
  }>;
  listGames(): Promise<GamesResult>;
  achievements(appid: string): Promise<AchievementsResult>;
  setAchievement(appid: string, apiName: string, unlocked: boolean, force?: boolean): Promise<SetResult>;
  setAll(
    appid: string,
    apiNames: string[],
    unlocked: boolean,
    includeRisky?: boolean,
  ): Promise<SetAllResult>;
  getEditing(): Promise<{ editingEnabled: boolean }>;
  setEditing(enabled: boolean): Promise<{ editingEnabled: boolean }>;
  getSettings(): Promise<Settings>;
  setSettings(patch: Partial<Settings>): Promise<Settings>;
  onStatus(cb: (status: { running: boolean }) => void): () => void;
}

interface Window {
  steam: SteamApi;
}
