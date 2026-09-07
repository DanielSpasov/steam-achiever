import { app, dialog } from "electron";
import { context, gameById } from "./context";
import { findRunningGame } from "./steam/detect";
import { readSettings } from "./settings";
import { stopWorker } from "./worker-pool";

let quitting = false;

// Closes the app when an installed VAC-secured game is running, so it can never
// sit alongside anti-cheat. Reacts within one poll interval, not before launch.
export async function checkForVacGame(): Promise<void> {
  if (quitting || !readSettings().autoCloseOnVacGame) return;

  const targets = context.games
    .filter((g) => g.vac && g.installed && g.installDir)
    .map((g) => ({ appid: g.appid, installDir: g.installDir as string }));
  if (!targets.length) return;

  const runningAppid = await findRunningGame(targets);
  if (!runningAppid) return;

  quitting = true;
  stopWorker();
  const game = gameById(runningAppid);
  dialog.showMessageBoxSync({
    type: "warning",
    title: "Steam Achiever closed",
    message: `${game?.name ?? "A VAC-secured game"} just started.`,
    detail:
      "Steam Achiever closed itself so it is not running next to a game that uses Valve Anti-Cheat. Reopen it once you are done playing.",
    buttons: ["OK"],
  });
  app.exit(0);
}
