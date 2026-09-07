import fs from "fs";
import path from "path";
import type { OnlineTier } from "../types";

// Reads appcache/appinfo.vdf (binary "v29", magic 0x07564429) to get each app's
// name, type, VAC flag and online classification without a network call.
//
// Per-app entry: u32 appid, u32 size, u32 infoState, u32 lastUpdated,
// u64 token, 20b sha1, u32 changeNumber, 20b sha1, then a key-values blob whose
// keys are u32 indices into a string table at the end of the file.

export interface AppInfo {
  name: string;
  type: string;
  vac: boolean;
  installDir: string;
  onlineTier: OnlineTier;
  // Relative asset paths from `common`. Newer games prefix them with a content
  // hash (e.g. "27abb15.../header.jpg"); older ones are just "header.jpg".
  headerPath: string;
  capsulePath: string;
}

const MAGIC_V29 = 0x07564429;

type Node = { [key: string]: string | number | bigint | Node };

// Steam store category ids.
const CAT = {
  multiPlayer: "category_1",
  singlePlayer: "category_2",
  mmo: "category_20",
  onlinePvp: "category_36",
  pvp: "category_49",
  vac: "category_8",
};

function classify(category: Node): OnlineTier {
  const has = (k: string) => category[k] === 1;
  const pvp = has(CAT.pvp) || has(CAT.onlinePvp) || has(CAT.mmo);
  if (has(CAT.singlePlayer)) return pvp ? "online-pvp" : "none";
  if (pvp) return "pvp";
  if (has(CAT.multiPlayer)) return "mp-only";
  return "none";
}

export function readAppInfo(steamRoot: string): Map<string, AppInfo> {
  const out = new Map<string, AppInfo>();

  let buf: Buffer;
  try {
    buf = fs.readFileSync(path.join(steamRoot, "appcache", "appinfo.vdf"));
  } catch {
    return out;
  }
  if (buf.readUInt32LE(0) !== MAGIC_V29) return out;

  try {
    const stringTableOffset = Number(buf.readBigInt64LE(8));

    const strings: string[] = [];
    let p = stringTableOffset;
    const count = buf.readUInt32LE(p);
    p += 4;
    for (let i = 0; i < count; i++) {
      const end = buf.indexOf(0x00, p);
      strings.push(buf.toString("utf8", p, end));
      p = end + 1;
    }

    const readNode = (start: number): { node: Node; next: number } => {
      const node: Node = {};
      let o = start;
      for (;;) {
        const type = buf[o++];
        if (type === 0x08) break;
        const key = strings[buf.readUInt32LE(o)] ?? "";
        o += 4;
        if (type === 0x00) {
          const child = readNode(o);
          node[key] = child.node;
          o = child.next;
        } else if (type === 0x01) {
          const end = buf.indexOf(0x00, o);
          node[key] = buf.toString("utf8", o, end);
          o = end + 1;
        } else if (type === 0x02) {
          node[key] = buf.readInt32LE(o);
          o += 4;
        } else if (type === 0x07) {
          node[key] = buf.readBigUInt64LE(o);
          o += 8;
        } else {
          throw new Error(`appinfo: unexpected type ${type} at ${o - 5}`);
        }
      }
      return { node, next: o };
    };

    const asNode = (v: unknown): Node => (v && typeof v === "object" ? (v as Node) : {});
    const firstString = (v: unknown): string => {
      if (typeof v === "string") return v;
      if (v && typeof v === "object") {
        const node = v as Node;
        if (typeof node.english === "string") return node.english;
        const found = Object.values(node).find((x) => typeof x === "string");
        if (typeof found === "string") return found;
      }
      return "";
    };

    let off = 16;
    while (off < stringTableOffset) {
      const appid = buf.readUInt32LE(off);
      if (appid === 0) break;
      const size = buf.readUInt32LE(off + 4);
      const next = off + 8 + size;
      const kvStart = off + 8 + 4 + 4 + 8 + 20 + 4 + 20;
      try {
        const { node } = readNode(kvStart);
        const common = asNode(asNode(node.appinfo).common);
        const config = asNode(asNode(node.appinfo).config);
        const name = typeof common.name === "string" ? common.name : "";
        if (name) {
          const capsule = asNode(asNode(common.library_assets_full).library_capsule);
          out.set(String(appid), {
            name,
            type: typeof common.type === "string" ? common.type : "",
            vac:
              asNode(common.category)[CAT.vac] === 1 ||
              typeof config.vacmodulefilename === "string" ||
              typeof config.vacmodulefilename_macos === "string" ||
              typeof config.vacmodulefilename_linux === "string",
            installDir: typeof config.installdir === "string" ? config.installdir : "",
            onlineTier: classify(asNode(common.category)),
            headerPath: firstString(common.header_image),
            capsulePath: firstString(capsule.image),
          });
        }
      } catch {
        // skip a malformed entry
      }
      off = next;
    }
  } catch {
    // return whatever parsed cleanly
  }

  return out;
}
