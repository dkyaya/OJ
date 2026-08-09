const encoder = new TextEncoder();

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function write16(view: DataView, offset: number, value: number) { view.setUint16(offset, value, true); }
function write32(view: DataView, offset: number, value: number) { view.setUint32(offset, value, true); }

export function createZip(files: Record<string, string>) {
  const entries = Object.entries(files).map(([name, content]) => ({ name: encoder.encode(name), body: encoder.encode(content) }));
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const crc = crc32(entry.body);
    const local = new Uint8Array(30 + entry.name.length + entry.body.length);
    const localView = new DataView(local.buffer);
    write32(localView, 0, 0x04034b50); write16(localView, 4, 20); write16(localView, 6, 0x0800); write16(localView, 8, 0);
    write32(localView, 14, crc); write32(localView, 18, entry.body.length); write32(localView, 22, entry.body.length); write16(localView, 26, entry.name.length);
    local.set(entry.name, 30); local.set(entry.body, 30 + entry.name.length); localParts.push(local);

    const central = new Uint8Array(46 + entry.name.length);
    const centralView = new DataView(central.buffer);
    write32(centralView, 0, 0x02014b50); write16(centralView, 4, 20); write16(centralView, 6, 20); write16(centralView, 8, 0x0800);
    write32(centralView, 16, crc); write32(centralView, 20, entry.body.length); write32(centralView, 24, entry.body.length); write16(centralView, 28, entry.name.length); write32(centralView, 42, offset);
    central.set(entry.name, 46); centralParts.push(central); offset += local.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22); const endView = new DataView(end.buffer);
  write32(endView, 0, 0x06054b50); write16(endView, 8, entries.length); write16(endView, 10, entries.length); write32(endView, 12, centralSize); write32(endView, 16, offset);
  const total = offset + centralSize + end.length; const output = new Uint8Array(total); let cursor = 0;
  for (const part of [...localParts, ...centralParts, end]) { output.set(part, cursor); cursor += part.length; }
  return output;
}
