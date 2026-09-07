import { $, gameThumb } from "./dom";
import { state, GameTag } from "./state";

let onPick: (appid: string) => void = () => {};

export function onGamePicked(handler: (appid: string) => void): void {
  onPick = handler;
}

// Mirrors the badges shown on each game row.
function hasTag(game: GameInfo, tag: GameTag): boolean {
  if (tag === "vac") return game.vac;
  if (game.vac) return false;
  if (tag === "pvp") return game.onlineTier === "pvp";
  if (tag === "online") return game.onlineTier === "mp-only";
  return game.onlineTier === "online-pvp";
}

function isSafe(game: GameInfo): boolean {
  return !game.vac && game.onlineTier === "none";
}

function matches(game: GameInfo): boolean {
  if (game.installed ? !state.showInstalled : !state.showUninstalled) return false;
  if (state.safeOnly && !isSafe(game)) return false;
  if (state.tags.size && ![...state.tags].some((tag) => hasTag(game, tag))) return false;
  const query = state.gameFilter.trim().toLowerCase();
  return !query || game.name.toLowerCase().includes(query);
}

function badge(row: HTMLElement, cls: string, label: string, title: string): void {
  const el = document.createElement("span");
  el.className = "badge " + cls;
  el.textContent = label;
  el.title = title;
  row.appendChild(el);
}

export function renderSidebar(): void {
  const list = $("#gameList");
  const games = state.games.filter(matches);

  list.innerHTML = "";
  $("#gameListEmpty").hidden = games.length > 0;

  const installedCount = state.games.filter((g) => g.installed).length;
  $("#gameCount").textContent =
    games.length === state.games.length
      ? `${state.games.length} games, ${installedCount} installed`
      : `${games.length} of ${state.games.length} games`;

  for (const game of games) {
    const row = document.createElement("div");
    row.className = "game-row" + (game.appid === state.selected ? " active" : "");

    const meta = document.createElement("div");
    meta.className = "game-meta";

    const name = document.createElement("div");
    name.className = "game-name";
    name.textContent = game.name;
    name.title = game.name;
    meta.appendChild(name);

    const badges = document.createElement("div");
    badges.className = "badge-row";
    if (game.installed) badge(badges, "badge--installed", "Installed", "Installed on this computer");
    else badge(badges, "", "Not installed", "Owned but not installed here");

    if (game.vac) {
      badge(badges, "badge--vac", "VAC", "Uses Valve Anti-Cheat. Editing is blocked.");
    } else if (game.onlineTier === "pvp") {
      badge(badges, "badge--online", "PvP", "Online PvP game with no single-player mode.");
    } else if (game.onlineTier === "mp-only") {
      badge(badges, "badge--online", "Online", "Multiplayer-only game.");
    } else if (game.onlineTier === "online-pvp") {
      badge(badges, "badge--online", "Has PvP", "Has online and PvP modes alongside single-player.");
    }
    meta.appendChild(badges);

    row.append(gameThumb(game, "game-thumb"), meta);
    row.addEventListener("click", () => onPick(game.appid));
    list.appendChild(row);
  }
}

function activeFilterCount(): number {
  return (
    (state.showInstalled && state.showUninstalled ? 0 : 1) +
    (state.safeOnly ? 1 : 0) +
    state.tags.size
  );
}

function syncFilterUi(): void {
  const count = activeFilterCount();
  const badge = $("#filterCount");
  badge.hidden = count === 0;
  badge.textContent = String(count);

  // Tag filters are meaningless while "safe only" is on.
  $("#tagGroup").classList.toggle("disabled", state.safeOnly);
  $("#tagGroup")
    .querySelectorAll<HTMLInputElement>("input")
    .forEach((input) => (input.disabled = state.safeOnly));
}

export function wireSidebar(): void {
  $<HTMLInputElement>("#gameSearch").addEventListener("input", (e) => {
    state.gameFilter = (e.target as HTMLInputElement).value;
    renderSidebar();
  });

  const menu = $("#filterMenu");
  const filter = $("#filterBtn");

  filter.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
  });
  document.addEventListener("click", (e) => {
    if (!menu.hidden && !menu.contains(e.target as Node) && e.target !== filter) menu.hidden = true;
  });

  menu.addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement;
    if (input.id === "safeOnly") state.safeOnly = input.checked;
    else if (input.dataset.status === "installed") state.showInstalled = input.checked;
    else if (input.dataset.status === "uninstalled") state.showUninstalled = input.checked;
    else if (input.dataset.tag) {
      const tag = input.dataset.tag as GameTag;
      if (input.checked) state.tags.add(tag);
      else state.tags.delete(tag);
    }
    syncFilterUi();
    renderSidebar();
  });

  $("#filterClear").addEventListener("click", () => {
    state.showInstalled = true;
    state.showUninstalled = true;
    state.safeOnly = false;
    state.tags.clear();
    menu.querySelectorAll<HTMLInputElement>("input[type=checkbox]").forEach((input) => {
      input.checked = !!input.dataset.status;
    });
    syncFilterUi();
    renderSidebar();
  });
}
