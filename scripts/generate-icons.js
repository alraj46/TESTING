'use strict';

/* مولّد أيقونات PWA — يُنشئ ملفات PNG حقيقية بدون أي اعتماديات خارجية.
   يرسم خيمة بسيطة على خلفية بلون التطبيق. */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---- CRC32 ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  // صفوف مع بايت فلتر = 0 في بداية كل صف
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- رسم ----
function makeIcon(size, maskable) {
  const buf = Buffer.alloc(size * size * 4);
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a;
  };

  // خلفية متدرجة عمودية من #0f766e إلى #134e4a
  const top = [15, 118, 110];
  const bot = [19, 78, 74];
  for (let y = 0; y < size; y++) {
    const t = y / (size - 1);
    const r = Math.round(top[0] + (bot[0] - top[0]) * t);
    const g = Math.round(top[1] + (bot[1] - top[1]) * t);
    const b = Math.round(top[2] + (bot[2] - top[2]) * t);
    for (let x = 0; x < size; x++) set(x, y, r, g, b);
  }

  // منطقة الرسم (padding أكبر للـ maskable)
  const pad = maskable ? size * 0.28 : size * 0.18;
  const cx = size / 2;
  const apexY = pad;
  const baseY = size - pad;
  const halfW = (size - 2 * pad) / 2;
  const leftX = cx - halfW;
  const rightX = cx + halfW;

  // مثلث الخيمة (أبيض كريمي)
  const inTri = (px, py, ax, ay, bx, by, ccx, ccy) => {
    const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
    const d2 = (px - ccx) * (by - ccy) - (bx - ccx) * (py - ccy);
    const d3 = (px - ax) * (ccy - ay) - (ccx - ax) * (py - ay);
    const neg = d1 < 0 || d2 < 0 || d3 < 0;
    const pos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(neg && pos);
  };

  const cream = [248, 250, 249];
  const door = [15, 118, 110];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (inTri(x, y, cx, apexY, leftX, baseY, rightX, baseY)) {
        set(x, y, cream[0], cream[1], cream[2]);
      }
    }
  }

  // باب الخيمة (مثلث صغير بلون الخلفية في المنتصف السفلي)
  const doorHalf = halfW * 0.22;
  const doorTop = apexY + (baseY - apexY) * 0.42;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (inTri(x, y, cx, doorTop, cx - doorHalf, baseY, cx + doorHalf, baseY)) {
        set(x, y, door[0], door[1], door[2]);
      }
    }
  }

  // عمود/علم صغير في القمة
  const flagH = size * 0.09;
  for (let y = apexY - flagH; y < apexY; y++) {
    set(Math.round(cx), Math.round(y), cream[0], cream[1], cream[2]);
    set(Math.round(cx) + 1, Math.round(y), cream[0], cream[1], cream[2]);
  }

  return encodePNG(size, size, buf);
}

const outDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(path.join(outDir, 'icon-192.png'), makeIcon(192, false));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), makeIcon(512, false));
fs.writeFileSync(path.join(outDir, 'icon-maskable-512.png'), makeIcon(512, true));

console.log('تم إنشاء الأيقونات في', outDir);
