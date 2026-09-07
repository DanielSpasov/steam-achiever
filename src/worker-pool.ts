import path from "path";
import { fork, ChildProcess } from "child_process";
import type { WorkerIn, WorkerOut, WorkerRequest } from "./types";

type ReadyMessage = Extract<WorkerOut, { type: "ready" }>;

let child: ChildProcess | null = null;
let currentAppid: number | null = null;
let lastReady: { appid: number; at: number; message: ReadyMessage } | null = null;
let seq = 0;
const pending = new Map<number, (message: WorkerOut) => void>();

export function stopWorker(): void {
  if (child) {
    try {
      child.removeAllListeners();
      child.kill();
    } catch {
      // ignore
    }
  }
  for (const [id, resolve] of pending) {
    resolve({ type: "error", reqId: id, error: "connection reset" });
  }
  pending.clear();
  child = null;
  currentAppid = null;
  lastReady = null;
}

function spawn(appid: number): Promise<ReadyMessage> {
  const proc = fork(path.join(__dirname, "worker.js"), [String(appid)], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  child = proc;
  currentAppid = appid;

  proc.stdout?.on("data", (d: Buffer) => console.log("worker:", d.toString().trim()));
  proc.stderr?.on("data", (d: Buffer) => console.error("worker:", d.toString().trim()));
  proc.on("exit", () => {
    if (child === proc) {
      child = null;
      currentAppid = null;
    }
  });

  return new Promise<ReadyMessage>((resolve) => {
    let settled = false;
    const finish = (message: ReadyMessage) => {
      if (settled) return;
      settled = true;
      lastReady = { appid, at: Date.now(), message };
      resolve(message);
    };

    proc.on("message", (msg: WorkerOut) => {
      if (!msg) return;
      if (msg.type === "ready") {
        finish(msg);
        return;
      }
      const handler = pending.get(msg.reqId);
      if (handler) {
        pending.delete(msg.reqId);
        handler(msg);
      }
    });
    proc.on("exit", () => finish({ type: "ready", ok: false, appid, error: "worker exited" }));
  });
}

export async function ensureWorker(appid: number): Promise<ReadyMessage> {
  appid = Number(appid);
  if (child && currentAppid === appid && lastReady && lastReady.appid === appid) {
    if (lastReady.message.ok) return lastReady.message;
    if (Date.now() - lastReady.at < 2500) return lastReady.message;
  }
  stopWorker();
  return spawn(appid);
}

export function workerRequest(payload: WorkerRequest, timeoutMs = 10000): Promise<WorkerOut> {
  return new Promise((resolve, reject) => {
    if (!child) {
      reject(new Error("Steam is not connected"));
      return;
    }
    const reqId = ++seq;
    pending.set(reqId, resolve);
    try {
      child.send({ ...payload, reqId } as WorkerIn);
    } catch (e) {
      pending.delete(reqId);
      reject(e);
      return;
    }
    setTimeout(() => {
      if (pending.has(reqId)) {
        pending.delete(reqId);
        reject(new Error("Steam did not respond in time"));
      }
    }, timeoutMs);
  });
}
