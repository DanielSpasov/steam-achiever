import { $, toast } from "./dom";
import { state } from "./state";
import { renderSidebar, wireSidebar, onGamePicked } from "./sidebar";
import { openGame, wireDetail } from "./detail";
import { wireDialogs, showRiskGate } from "./dialogs";

function renderStatus(): void {
  const pill = $("#statusPill");
  pill.classList.remove("pill--ok", "pill--bad");
  pill.classList.add(state.steamRunning ? "pill--ok" : "pill--bad");
  $("#statusText").textContent = state.steamRunning ? "Steam is running" : "Steam not running";
}

function renderEditButton(): void {
  const btn = $<HTMLButtonElement>("#editToggle");
  btn.classList.toggle("editing", state.editing);
  btn.disabled = !state.steamRunning;
  if (!state.steamRunning) {
    btn.textContent = "Read-only";
    btn.title = "Start Steam to enable editing.";
    return;
  }
  btn.textContent = state.editing ? "Editing enabled" : "Read-only";
  btn.title = state.editing
    ? "Changes take effect on Steam immediately. Click to lock."
    : "Click to allow changes.";
}

async function toggleEditing(): Promise<void> {
  if (!state.editing) {
    const ok = confirm(
      "Enable editing?\n\n" +
        "While editing is on, flipping a switch or using Unlock all / Lock all takes " +
        "effect on your Steam account straight away. Nothing changes until you do that.",
    );
    if (!ok) return;
  }
  const res = await window.steam.setEditing(!state.editing);
  state.editing = res.editingEnabled;
  renderEditButton();
  if (state.selected) void openGame(state.selected);
  toast(state.editing ? "Editing enabled" : "Back to read-only", state.editing ? "" : "ok");
}

async function loadGames(): Promise<void> {
  const res = await window.steam.listGames();
  if (res.error) toast(res.error, "error");
  state.games = res.games || [];
  renderSidebar();

  const note = $("#ownedNote");
  const uninstalled = state.games.filter((g) => !g.installed).length;
  if (res.hasKey && res.ownedSource === "none") {
    note.hidden = false;
    note.textContent = `Web API key did not work (${res.ownedError || "unknown error"}). Showing games from Steam's local cache.`;
  } else if (res.ownedSource === "local" && uninstalled > 0) {
    note.hidden = false;
    note.textContent = `${uninstalled} not-installed game(s) from your local Steam library. Add a Web API key in Settings for exact ownership and playtime.`;
  } else if (res.ownedSource === "local") {
    note.hidden = false;
    note.textContent = "Showing games from Steam's local cache. Add a Web API key in Settings if any owned games are missing.";
  } else {
    note.hidden = true;
  }
}

function wire(): void {
  wireSidebar();
  wireDetail();
  wireDialogs(loadGames);
  onGamePicked((appid) => void openGame(appid));

  $("#rescanBtn").addEventListener("click", () => void loadGames());
  $("#editToggle").addEventListener("click", () => void toggleEditing());

  window.steam.onStatus((status) => {
    const was = state.steamRunning;
    state.steamRunning = status.running;
    renderStatus();
    renderEditButton();
    if (was !== status.running) {
      void loadGames();
      if (state.selected) void openGame(state.selected);
    }
  });
}

async function boot(): Promise<void> {
  wire();
  const info = await window.steam.init();
  state.steamRunning = info.running;
  state.editing = info.editingEnabled;
  renderStatus();
  renderEditButton();

  if (!info.riskAccepted) showRiskGate();
  if (!info.hasSteamRoot) toast("Could not find your Steam installation.", "error");
  await loadGames();
}

void boot();
