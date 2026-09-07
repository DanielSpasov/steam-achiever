export type GameTag = "vac" | "pvp" | "online" | "has-pvp";

export interface AppState {
  games: GameInfo[];
  gameFilter: string;
  showInstalled: boolean;
  showUninstalled: boolean;
  safeOnly: boolean;
  tags: Set<GameTag>;

  selected: string | null;
  achievements: AchievementState[];
  achFilter: string;
  view: "all" | "unlocked" | "locked";

  steamRunning: boolean;
  connected: boolean;
  available: boolean;
  owned: boolean | null;
  vac: boolean;
  onlineTier: OnlineTier;
  editing: boolean;
  busy: boolean;
}

export const state: AppState = {
  games: [],
  gameFilter: "",
  showInstalled: true,
  showUninstalled: true,
  safeOnly: false,
  tags: new Set(),

  selected: null,
  achievements: [],
  achFilter: "",
  view: "all",

  steamRunning: false,
  connected: false,
  available: false,
  owned: null,
  vac: false,
  onlineTier: "none",
  editing: false,
  busy: false,
};

// Editing is only possible for a non-VAC, owned game while Steam is connected
// and the user has turned editing on.
export function canEdit(): boolean {
  return (
    !state.vac &&
    state.editing &&
    state.steamRunning &&
    state.connected &&
    state.owned !== false &&
    state.available
  );
}
