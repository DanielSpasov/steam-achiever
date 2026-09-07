import { contextBridge, ipcRenderer } from "electron";
import type { Settings } from "./types";

const api = {
  init: () => ipcRenderer.invoke("app:init"),
  listGames: () => ipcRenderer.invoke("games:list"),
  achievements: (appid: string) => ipcRenderer.invoke("game:achievements", appid),
  setAchievement: (appid: string, apiName: string, unlocked: boolean, force?: boolean) =>
    ipcRenderer.invoke("achievement:set", { appid, apiName, unlocked, force }),
  setAll: (appid: string, apiNames: string[], unlocked: boolean, includeRisky?: boolean) =>
    ipcRenderer.invoke("game:setAll", { appid, apiNames, unlocked, includeRisky }),
  getEditing: () => ipcRenderer.invoke("edit:get"),
  setEditing: (enabled: boolean) => ipcRenderer.invoke("edit:set", enabled),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (patch: Partial<Settings>) => ipcRenderer.invoke("settings:set", patch),
  onStatus: (cb: (status: { running: boolean }) => void) => {
    const handler = (_e: unknown, status: { running: boolean }) => cb(status);
    ipcRenderer.on("steam:status", handler);
    return () => ipcRenderer.removeListener("steam:status", handler);
  },
};

contextBridge.exposeInMainWorld("steam", api);

export type SteamApi = typeof api;
