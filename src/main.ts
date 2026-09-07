import { app, BrowserWindow, shell } from "electron";
import path from "path";
import { context } from "./context";
import { findSteamRoot } from "./steam/paths";
import { isSteamRunning } from "./steam/detect";
import { registerIpc, primeGameCache } from "./ipc";
import { checkForVacGame } from "./vac-guard";
import { stopWorker } from "./worker-pool";

let win: BrowserWindow | null = null;
let statusTimer: NodeJS.Timeout | null = null;
let vacTimer: NodeJS.Timeout | null = null;

function createWindow(): void {
  win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 960,
    minHeight: 620,
    backgroundColor: "#0f1117",
    title: "Steam Achiever",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

  win.webContents.on("console-message", (...args: unknown[]) => {
    const first = args[0] as { level?: string; message?: string } | undefined;
    if (first && typeof first === "object" && "level" in first) {
      if (first.level === "error" || first.level === "warning") {
        console.error("renderer:", first.message);
      }
    } else if (typeof args[1] === "number" && args[1] >= 2) {
      console.error("renderer:", args[2]);
    }
  });
  win.webContents.on("did-fail-load", (_e, code, desc) =>
    console.error("renderer failed to load:", code, desc),
  );

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

async function pushStatus(): Promise<void> {
  if (!win || win.isDestroyed()) return;
  win.webContents.send("steam:status", { running: await isSteamRunning() });
}

app.whenReady().then(() => {
  context.steamRoot = findSteamRoot();
  registerIpc();
  primeGameCache();
  createWindow();

  void pushStatus();
  statusTimer = setInterval(() => void pushStatus(), 4000);
  vacTimer = setInterval(() => void checkForVacGame(), 2000);
  void checkForVacGame();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (statusTimer) clearInterval(statusTimer);
  if (vacTimer) clearInterval(vacTimer);
  stopWorker();
  app.quit();
});

app.on("before-quit", () => stopWorker());
