import { $, achievementIcon, escapeHtml, toast } from "./dom";
import { state, canEdit } from "./state";
import { renderSidebar } from "./sidebar";

function renderBanner(): void {
  const banner = $("#banner");
  const set = (cls: string, text: string) => {
    banner.hidden = false;
    banner.className = "banner " + cls;
    banner.textContent = text;
  };

  if (state.vac) {
    set(
      "banner--bad",
      "This game uses Valve Anti-Cheat. Steam Achiever will not connect to it or change its achievements. The list below is for reference only.",
    );
  } else if (!state.available) {
    set(
      "banner--info",
      "No achievement list for this game. Steam has not cached it (launch the game once, or open its achievements page in Steam), or add a Web API key in Settings to fetch it.",
    );
  } else if (!state.steamRunning || !state.connected) {
    set("banner--bad", "Steam is not connected, so achievements are read-only. Start Steam to change them.");
  } else if (state.owned === false) {
    set("banner--bad", "The signed-in Steam account does not own this game, so changes cannot be saved.");
  } else if (state.onlineTier === "pvp" || state.onlineTier === "mp-only") {
    set(
      "banner--warn",
      "This is an online game. Every achievement here needs an extra confirmation and Unlock all is disabled, because granting these manually is the most likely to trigger a game-specific ban.",
    );
  } else if (state.onlineTier === "online-pvp") {
    set(
      "banner--warn",
      "This game has online and PvP modes. Achievements tied to them are flagged individually. Check each description before granting it.",
    );
  } else if (!state.editing) {
    set("banner--info", 'Read-only. Use the "Read-only" button in the top bar to make changes.');
  } else {
    banner.hidden = true;
  }
}

function renderProgress(): void {
  const total = state.achievements.length;
  if (state.vac) {
    $("#progressBar").style.width = "0%";
    $("#progressLabel").textContent = `${total} achievements, progress hidden for VAC games`;
    return;
  }
  const unlocked = state.achievements.filter((a) => a.unlocked).length;
  const pct = total ? Math.round((unlocked / total) * 100) : 0;
  $("#progressBar").style.width = pct + "%";
  $("#progressLabel").textContent = total
    ? `${unlocked} / ${total} unlocked (${pct}%)`
    : "No achievements";
}

export function updateControls(): void {
  const editable = canEdit();
  $<HTMLButtonElement>("#unlockAllBtn").disabled = !editable || state.busy;
  $<HTMLButtonElement>("#lockAllBtn").disabled = !editable || state.busy;
  document.querySelectorAll<HTMLInputElement>(".ach-list .switch input").forEach((input) => {
    input.disabled = !editable || state.busy;
  });
}

function renderRows(): void {
  const list = $("#achList");
  const empty = $("#achEmpty");
  const query = state.achFilter.trim().toLowerCase();

  let rows = state.achievements;
  if (state.view === "unlocked") rows = rows.filter((a) => a.unlocked);
  else if (state.view === "locked") rows = rows.filter((a) => !a.unlocked);
  if (query) {
    rows = rows.filter(
      (a) =>
        a.displayName.toLowerCase().includes(query) ||
        a.description.toLowerCase().includes(query) ||
        a.apiName.toLowerCase().includes(query),
    );
  }

  list.innerHTML = "";
  empty.hidden = rows.length > 0 || !state.available;
  if (!empty.hidden) {
    empty.textContent = state.achievements.length
      ? "Nothing matches this filter."
      : "This game has no achievements.";
  }

  const editable = canEdit();

  for (const a of rows) {
    const row = document.createElement("div");
    row.className = "ach-row" + (a.unlocked ? "" : " locked") + (a.risky ? " risky" : "");

    const text = document.createElement("div");
    text.className = "ach-text";
    const description =
      a.description && (!a.hidden || a.unlocked)
        ? a.description
        : a.hidden
          ? "Hidden achievement"
          : "";
    const riskyTag = a.risky
      ? '<span class="ach-flag" title="Looks online or multiplayer. Extra confirmation required.">online?</span>'
      : "";
    text.innerHTML =
      `<div class="ach-name">${escapeHtml(a.displayName)}${riskyTag}` +
      `<span class="ach-api">${escapeHtml(a.apiName)}</span></div>` +
      `<div class="ach-desc">${escapeHtml(description)}</div>`;

    const toggle = document.createElement("label");
    toggle.className = "switch";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = a.unlocked;
    input.disabled = !editable || state.busy;
    input.addEventListener("change", () => void onToggle(a, input));
    const slider = document.createElement("span");
    slider.className = "slider";
    toggle.append(input, slider);

    row.append(achievementIcon(a), text, toggle);
    list.appendChild(row);
  }
}

async function onToggle(a: AchievementState, input: HTMLInputElement): Promise<void> {
  const want = input.checked;
  input.disabled = true;
  let res = await window.steam.setAchievement(state.selected as string, a.apiName, want);

  if (!res.ok && res.risky) {
    const proceed = confirm(
      `"${a.displayName}" looks like an online or multiplayer achievement.\n\n` +
        "Granting these by hand is more likely to be noticed by the game and, for some " +
        "games, can lead to a developer ban. Only continue if you are sure this one is safe.\n\n" +
        "Unlock it anyway?",
    );
    if (!proceed) {
      input.checked = !want;
      input.disabled = false;
      return;
    }
    res = await window.steam.setAchievement(state.selected as string, a.apiName, want, true);
  }
  input.disabled = false;

  if (!res.ok) {
    input.checked = !want;
    toast(res.error || "Steam rejected the change", "error");
    return;
  }

  a.unlocked = !!res.unlocked;
  input.checked = a.unlocked;
  const row = input.closest(".ach-row");
  row?.classList.toggle("locked", !a.unlocked);
  row?.querySelector(".ach-icon")?.replaceWith(achievementIcon(a));
  renderProgress();
  toast(`${a.displayName} ${a.unlocked ? "unlocked" : "locked"}`, a.unlocked ? "ok" : "");
}

async function bulkSet(unlocked: boolean): Promise<void> {
  if (!canEdit() || state.busy) return;
  const names = state.achievements.filter((a) => a.unlocked !== unlocked).map((a) => a.apiName);
  if (!names.length) {
    toast(`Nothing to ${unlocked ? "unlock" : "lock"}`);
    return;
  }
  if (!confirm(`${unlocked ? "Unlock" : "Lock"} ${names.length} achievement(s) on your Steam account now?`)) {
    return;
  }

  state.busy = true;
  updateControls();
  const res = await window.steam.setAll(state.selected as string, names, unlocked, false);
  state.busy = false;

  if (res.results) {
    for (const a of state.achievements) {
      const value = res.results[a.apiName];
      if (value != null) a.unlocked = value;
    }
  }
  renderProgress();
  renderRows();
  updateControls();

  const changed = res.changed ?? names.length;
  if (res.ok) toast(`Done, ${changed} changed`, "ok");
  else toast(`${res.failed || "Some"} change(s) failed`, "error");
  if (res.skippedRisky) {
    toast(`Skipped ${res.skippedRisky} online achievement(s). Toggle those one by one if you are sure.`);
  }
}

export async function openGame(appid: string): Promise<void> {
  state.selected = appid;
  renderSidebar();

  const game = state.games.find((g) => g.appid === appid);
  $("#detailEmpty").hidden = true;
  $("#detailView").hidden = false;
  $("#loadingLabel").textContent = game ? `Loading ${game.name}` : "Loading achievements";
  $("#detailLoading").hidden = false;
  $("#gameTitle").textContent = game ? game.name : appid;
  $("#gameAppid").textContent = "App " + appid;
  $("#gameSteamId").textContent = "";

  const header = $<HTMLImageElement>("#gameHeaderImg");
  header.style.visibility = "visible";
  header.src = game ? game.headerUrl : "";
  header.onerror = () => {
    if (game && header.src !== game.capsuleUrl && game.capsuleUrl) {
      header.src = game.capsuleUrl;
    } else {
      header.style.visibility = "hidden";
    }
  };

  $("#achList").innerHTML = "";
  $("#achEmpty").hidden = true;
  $("#progressLabel").textContent = "";
  $("#progressBar").style.width = "0%";
  $("#banner").hidden = true;

  const data = await window.steam.achievements(appid);
  if (state.selected !== appid) return;
  $("#detailLoading").hidden = true;

  state.achievements = data.achievements || [];
  state.available = data.available;
  state.connected = data.connected;
  state.owned = data.owned;
  state.vac = data.vac;
  state.onlineTier = data.onlineTier;
  state.editing = data.editingEnabled;

  if (data.steamId) $("#gameSteamId").textContent = "SteamID " + data.steamId;
  if (data.connectError && data.available) toast(data.connectError, "error");

  renderBanner();
  renderProgress();
  renderRows();
  updateControls();
}

export function refreshDetail(): void {
  renderBanner();
  renderRows();
  updateControls();
}

export function wireDetail(): void {
  $<HTMLInputElement>("#achSearch").addEventListener("input", (e) => {
    state.achFilter = (e.target as HTMLInputElement).value;
    renderRows();
    updateControls();
  });

  $("#filterSeg").addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("button");
    if (!btn) return;
    state.view = btn.dataset.filter as AppStateView;
    [...$("#filterSeg").children].forEach((b) => b.classList.toggle("active", b === btn));
    renderRows();
    updateControls();
  });

  $("#unlockAllBtn").addEventListener("click", () => void bulkSet(true));
  $("#lockAllBtn").addEventListener("click", () => void bulkSet(false));
}

type AppStateView = "all" | "unlocked" | "locked";
