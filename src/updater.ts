import { app, dialog, shell } from "electron";
import { autoUpdater } from "electron-updater";

const RELEASES_URL = "https://github.com/DanielSpasov/steam-achiever/releases/latest";
const LATEST_RELEASE_API =
  "https://api.github.com/repos/DanielSpasov/steam-achiever/releases/latest";

// electron-updater's silent update/apply step requires a real (paid) Developer
// ID signature on macOS; our builds are only ad-hoc signed (see adhoc-sign.js),
// so on macOS we just check GitHub's latest release and point the user at it.
export function initUpdater(): void {
  if (!app.isPackaged) return;

  if (process.platform === "darwin") {
    void checkForUpdateOnMac();
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-downloaded", (info) => {
    const choice = dialog.showMessageBoxSync({
      type: "info",
      title: "Update ready",
      message: `Steam Achiever ${info.version} has been downloaded.`,
      detail:
        "Restart now to install it, or it will install automatically the next time you quit.",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
    });
    // Without these flags the assisted NSIS installer shows its window and Finish page.
    if (choice === 0) autoUpdater.quitAndInstall(true, true);
  });

  autoUpdater.on("error", (err) => console.error("updater:", err));

  void autoUpdater.checkForUpdates();
}

async function checkForUpdateOnMac(): Promise<void> {
  try {
    const res = await fetch(LATEST_RELEASE_API);
    if (!res.ok) return;

    const { tag_name } = (await res.json()) as { tag_name?: string };
    const latest = tag_name?.replace(/^v/, "");
    if (!latest || latest === app.getVersion()) return;

    const choice = dialog.showMessageBoxSync({
      type: "info",
      title: "Update available",
      message: `Steam Achiever ${latest} is available (you have ${app.getVersion()}).`,
      detail:
        "In-app updates aren't available on macOS yet. Open the GitHub releases page to download it?",
      buttons: ["Open download page", "Later"],
      defaultId: 0,
    });
    if (choice === 0) await shell.openExternal(RELEASES_URL);
  } catch (err) {
    console.error("mac update check:", err);
  }
}
