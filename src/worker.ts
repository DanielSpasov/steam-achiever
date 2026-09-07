// Forked child process. Owns one Steamworks connection for one appid.
//
// Read-only unless a message carries `armed: true`. It never calls
// activate()/clear() on its own, only in reply to an armed `set` message, which
// the main process only sends when the user has turned editing on.
//
// Runs under ELECTRON_RUN_AS_NODE, so it must not import electron.

import * as steamworks from "steamworks.js";
import type { WorkerIn, WorkerOut } from "./types";

type Client = ReturnType<typeof steamworks.init>;

const appid = parseInt(process.argv[2] ?? "0", 10);
let client: Client | null = null;

function send(message: WorkerOut): void {
  process.send?.(message);
}

function isActivated(name: string, fallback = false): boolean {
  try {
    return !!client?.achievement.isActivated(name);
  } catch {
    return fallback;
  }
}

try {
  client = steamworks.init(appid);
  setTimeout(() => {
    let steamId: string | null = null;
    let owned = true;
    try {
      steamId = client!.localplayer.getSteamId().steamId64.toString();
    } catch {
      // ignore
    }
    try {
      owned = client!.apps.isSubscribedApp(appid);
    } catch {
      // ignore
    }
    send({ type: "ready", ok: true, appid, steamId, owned });
  }, 300);
} catch (e) {
  send({ type: "ready", ok: false, appid, error: String((e as Error).message || e) });
  setTimeout(() => process.exit(0), 50);
}

process.on("message", (msg: WorkerIn) => {
  if (!client || !msg) return;

  if (msg.type === "states") {
    const data: Record<string, boolean> = {};
    for (const name of msg.names || []) data[name] = isActivated(name);
    send({ type: "states", reqId: msg.reqId, data });
    return;
  }

  if (msg.type === "set") {
    if (msg.armed !== true) {
      send({
        type: "set",
        reqId: msg.reqId,
        name: msg.name,
        ok: false,
        unlocked: isActivated(msg.name),
        error: "write rejected: not armed",
      });
      return;
    }

    let ok = false;
    let error: string | null = null;
    try {
      ok = msg.unlocked
        ? client.achievement.activate(msg.name)
        : client.achievement.clear(msg.name);
      client.stats.store();
    } catch (e) {
      error = String((e as Error).message || e);
    }
    send({
      type: "set",
      reqId: msg.reqId,
      name: msg.name,
      ok: ok && !error,
      unlocked: isActivated(msg.name, msg.unlocked),
      error,
    });
  }
});

process.on("disconnect", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
