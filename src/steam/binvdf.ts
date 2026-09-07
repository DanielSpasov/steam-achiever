// Parser for Valve's binary KeyValues format.
// Type bytes: 0x00 nested, 0x01 string, 0x02 int32, 0x03 float32, 0x04 int32,
// 0x05 wide string, 0x06 uint32, 0x07 uint64, 0x08 end, 0x0a int64.

export type BinValue = string | number | bigint | BinNode;
export interface BinNode {
  [key: string]: BinValue;
}

export function parseBinaryVdf(buf: Buffer): BinNode {
  let off = 0;

  const readCString = () => {
    const start = off;
    while (off < buf.length && buf[off] !== 0x00) off++;
    const s = buf.toString("utf8", start, off);
    off++;
    return s;
  };

  const readWString = () => {
    const start = off;
    while (off + 1 < buf.length && !(buf[off] === 0x00 && buf[off + 1] === 0x00)) off += 2;
    const s = buf.toString("utf16le", start, off);
    off += 2;
    return s;
  };

  const readNode = (): BinNode => {
    const node: BinNode = {};
    while (off < buf.length) {
      const type = buf[off++];
      if (type === 0x08) break;
      const key = readCString();
      let value: BinValue;
      switch (type) {
        case 0x00:
          value = readNode();
          break;
        case 0x01:
          value = readCString();
          break;
        case 0x05:
          value = readWString();
          break;
        case 0x02:
        case 0x04:
          value = buf.readInt32LE(off);
          off += 4;
          break;
        case 0x06:
          value = buf.readUInt32LE(off);
          off += 4;
          break;
        case 0x03:
          value = buf.readFloatLE(off);
          off += 4;
          break;
        case 0x07:
          value = buf.readBigUInt64LE(off);
          off += 8;
          break;
        case 0x0a:
          value = buf.readBigInt64LE(off);
          off += 8;
          break;
        default:
          throw new Error(`unknown type 0x${type.toString(16)} at ${off - 1}`);
      }
      if (!(key in node)) node[key] = value;
    }
    return node;
  };

  return readNode();
}
