import { app, BrowserWindow, ipcMain, shell } from "electron";
import { autoUpdater } from "electron-updater";
import type { UpdateStatus } from "./types";

const RELEASES_URL = "https://github.com/DanielSpasov/steam-achiever/releases/latest";
const LATEST_RELEASE_API =
  "https://api.github.com/repos/DanielSpasov/steam-achiever/releases/latest";

let status: UpdateStatus = { state: "none" };

function setStatus(next: UpdateStatus): void {
  status = next;
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("update:status", status);
  }
}

// electron-updater's install step requires a real (paid) Developer ID signature
// on macOS; our builds are only ad-hoc signed (see adhoc-sign.js), so on macOS
// we only check GitHub's latest release and send the user to the download page.
export function initUpdater(): void {
  ipcMain.handle("update:get", () => status);
  ipcMain.handle("update:act", () => runUpdateAction());

  if (!app.isPackaged) return;

  if (process.platform === "darwin") {
    void checkForUpdateOnMac();
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    setStatus({ state: "available", version: info.version });
  });
  autoUpdater.on("download-progress", (progress) => {
    if (status.state !== "downloading") return;
    setStatus({ ...status, percent: Math.round(progress.percent) });
  });
  autoUpdater.on("update-downloaded", (info) => {
    setStatus({ state: "ready", version: info.version });
  });
  autoUpdater.on("error", (err) => console.error("updater:", err));

  autoUpdater.checkForUpdates().catch((err) => console.error("update check:", err));
}

async function runUpdateAction(): Promise<void> {
  if (process.platform === "darwin") {
    await shell.openExternal(RELEASES_URL);
    return;
  }

  if (status.state === "ready") {
    // Without these flags the assisted NSIS installer shows its window and Finish page.
    autoUpdater.quitAndInstall(true, true);
    return;
  }

  if (status.state !== "available" && status.state !== "failed") return;

  const { version } = status;
  setStatus({ state: "downloading", version, percent: 0 });
  try {
    await autoUpdater.downloadUpdate();
  } catch (err) {
    console.error("update download:", err);
    setStatus({ state: "failed", version });
  }
}

async function checkForUpdateOnMac(): Promise<void> {
  try {
    const res = await fetch(LATEST_RELEASE_API);
    if (!res.ok) return;

    const { tag_name } = (await res.json()) as { tag_name?: string };
    const latest = tag_name?.replace(/^v/, "");
    if (!latest || latest === app.getVersion()) return;

    setStatus({ state: "available", version: latest });
  } catch (err) {
    console.error("mac update check:", err);
  }
}
