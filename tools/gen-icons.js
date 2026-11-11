/* Generator ikon PWA KuliahKu (dijalankan sekali: node tools/gen-icons.js) */
'use strict';

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

/* ---------- Encoder PNG minimalis (RGBA 8-bit) ---------- */
const CRC_T = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_T[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

function pngEncode(w, h, rgba) {
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- Geometri dalam ruang koordinat 512x512 ---------- */
function inCircle(x, y, cx, cy, r) {
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.max(x0 + r, Math.min(x, x1 - r));
  const cy = Math.max(y0 + r, Math.min(y, y1 - r));
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

/* Siluet bel (lonceng) */
function inBell(x, y) {
  if (inCircle(x, y, 256, 110, 20)) return true;                 // tombol atas
  if (y >= 99 && y <= 232 && inCircle(x, y, 256, 217, 118)) return true; // kubah
  if (y > 232 && y <= 334) {                                      // badan melebar
    const half = 118 + (y - 232) * (44 / 102);
    return Math.abs(x - 256) <= half;
  }
  if (inRoundRect(x, y, 86, 334, 426, 368, 16)) return true;     // bibir
  if (inCircle(x, y, 256, 398, 27)) return true;                 // palu
  return false;
}

/* ---------- Render ---------- */
const G1 = [79, 70, 229];   // #4f46e5
const G2 = [124, 58, 237];  // #7c3aed

function drawIcon(size, maskable) {
  const img = Buffer.alloc(size * size * 4);
  const S = 512 / size;
  const gs = maskable ? 0.58 : 0.92;   // skala glyph (maskable perlu zona aman)
  const off = (1 - gs) / 2 * 512;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bgCov = 0, glCov = 0;
      for (let sy = 0; sy < 2; sy++) {
        for (let sx = 0; sx < 2; sx++) {
          const x = (px + (sx + 0.5) / 2) * S;
          const y = (py + (sy + 0.5) / 2) * S;
          const inBg = maskable ? true : inRoundRect(x, y, 16, 16, 496, 496, 112);
          if (inBg) {
            bgCov++;
            const gx = (x - off) / gs, gy = (y - off) / gs;
            if (gx >= 0 && gx <= 512 && gy >= 0 && gy <= 512 && inBell(gx, gy)) glCov++;
          }
        }
      }
      const i = (py * size + px) * 4;
      if (!bgCov) { img[i + 3] = 0; continue; }
      const t = py / (size - 1);
      const g = glCov / 4;
      img[i]     = Math.round((G1[0] + (G2[0] - G1[0]) * t) * (1 - g) + 255 * g);
      img[i + 1] = Math.round((G1[1] + (G2[1] - G1[1]) * t) * (1 - g) + 255 * g);
      img[i + 2] = Math.round((G1[2] + (G2[2] - G1[2]) * t) * (1 - g) + 255 * g);
      img[i + 3] = Math.round(255 * bgCov / 4);
    }
  }
  return pngEncode(size, size, img);
}

const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon-192.png'), drawIcon(192, false));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), drawIcon(512, false));
fs.writeFileSync(path.join(outDir, 'icon-180.png'), drawIcon(180, true)); // apple-touch-icon (penuh)
fs.writeFileSync(path.join(outDir, 'maskable-192.png'), drawIcon(192, true));
fs.writeFileSync(path.join(outDir, 'maskable-512.png'), drawIcon(512, true));
console.log('Ikon dibuat di', outDir);
