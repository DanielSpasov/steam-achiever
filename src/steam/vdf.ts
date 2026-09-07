// Parser for Valve's text KeyValues format (.acf, libraryfolders.vdf).

export type VdfNode = { [key: string]: string | VdfNode };

export function parseVdf(text: string): VdfNode {
  let i = 0;
  const n = text.length;

  const skipWs = () => {
    while (i < n) {
      const c = text[i];
      if (c === " " || c === "\t" || c === "\r" || c === "\n") {
        i++;
      } else if (c === "/" && text[i + 1] === "/") {
        while (i < n && text[i] !== "\n") i++;
      } else {
        break;
      }
    }
  };

  const readQuoted = () => {
    i++;
    let s = "";
    while (i < n) {
      const c = text[i++];
      if (c === "\\") {
        const e = text[i++];
        s += e === "n" ? "\n" : e === "t" ? "\t" : e;
      } else if (c === '"') {
        break;
      } else {
        s += c;
      }
    }
    return s;
  };

  const readBare = () => {
    let s = "";
    while (i < n && !' \t\r\n{}"'.includes(text[i] as string)) s += text[i++];
    return s;
  };

  const readValue = () => (text[i] === '"' ? readQuoted() : readBare());

  const parseObject = (): VdfNode => {
    const obj: VdfNode = {};
    while (i < n) {
      skipWs();
      if (i >= n || text[i] === "}") {
        i++;
        break;
      }
      const key = readValue();
      skipWs();
      obj[key] = text[i] === "{" ? (i++, parseObject()) : readValue();
    }
    return obj;
  };

  const result: VdfNode = {};
  while (i < n) {
    skipWs();
    if (i >= n) break;
    if (text[i] === "}") {
      i++;
      continue;
    }
    const key = readValue();
    skipWs();
    result[key] = text[i] === "{" ? (i++, parseObject()) : readValue();
  }
  return result;
}
