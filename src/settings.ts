import fs from "fs";
import path from "path";
import { app } from "electron";
import type { Settings } from "./types";

const DEFAULTS: Settings = {
  webApiKey: "",
  riskAccepted: false,
  autoCloseOnVacGame: true,
};

function file(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

export function readSettings(): Settings {
  try {
    const raw = JSON.parse(fs.readFileSync(file(), "utf8")) as Partial<Settings>;
    return { ...DEFAULTS, ...raw };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeSettings(patch: Partial<Settings>): Settings {
  const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  const next = { ...readSettings(), ...defined };
  try {
    fs.writeFileSync(file(), JSON.stringify(next, null, 2), "utf8");
  } catch (e) {
    console.error("settings: could not save", (e as Error).message);
  }
  return next;
}
