import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'icons');
mkdirSync(OUT_DIR, { recursive: true });

// ---- Pure-Node PNG Encoder ----
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[i] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter None
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- Math / SDF Helpers (normalized coords in [-1, 1]) ----
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const mixColor = (c1, c2, t) => [
  mix(c1[0], c2[0], t),
  mix(c1[1], c2[1], t),
  mix(c1[2], c2[2], t),
  mix(c1[3] ?? 1, c2[3] ?? 1, t),
];

function blendOver(dst, src) {
  const sa = clamp(src[3], 0, 1);
  if (sa <= 0) return dst;
  const da = clamp(dst[3], 0, 1);
  const outA = sa + da * (1 - sa);
  if (outA <= 0) return [0, 0, 0, 0];
  return [
    (src[0] * sa + dst[0] * da * (1 - sa)) / outA,
    (src[1] * sa + dst[1] * da * (1 - sa)) / outA,
    (src[2] * sa + dst[2] * da * (1 - sa)) / outA,
    outA,
  ];
}

function sdRoundedBox(px, py, bx, by, r) {
  const qx = Math.abs(px) - bx + r;
  const qy = Math.abs(py) - by + r;
  const dx = Math.max(qx, 0);
  const dy = Math.max(qy, 0);
  return Math.hypot(dx, dy) + Math.min(Math.max(qx, qy), 0) - r;
}

function sdCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}

function sdSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay), 0, 1);
  return Math.hypot(pax - bax * h, pay - bay * h);
}

function sdHexagon(px, py, r) {
  const kx = -0.866025404;
  const ky = 0.5;
  const kz = 0.577350269;
  let x = Math.abs(px);
  let y = Math.abs(py);
  const d = 2 * Math.min(kx * x + ky * y, 0);
  x -= d * kx;
  y -= d * ky;
  x -= clamp(x, -kz * r, kz * r);
  y -= r;
  return Math.hypot(x, y) * Math.sign(y);
}

// Palette (Atom One Dark + Lemon Gold + Emerald + Cobalt)
const C_BG_TOP = [33, 37, 43, 1];      // #21252b
const C_BG_BOT = [44, 49, 58, 1];      // #2c313a
const C_LEMON = [229, 192, 123, 1];    // #e5c07b
const C_LEMON_BRIGHT = [247, 224, 138, 1]; // #f7e08a
const C_AMBER = [209, 154, 102, 1];    // #d19a66
const C_EMERALD = [80, 161, 79, 1];    // #50a14f
const C_EMERALD_GLOW = [152, 195, 121, 1]; // #98c379
const C_COBALT = [64, 120, 242, 1];    // #4078f2
const C_SKY = [97, 175, 239, 1];       // #61afef
const C_SLATE_INNER = [50, 56, 68, 1]; // #323844

function cov(d, aa) {
  return 1 - smoothstep(-aa, aa, d);
}

function renderIcon(size, kind, maskable) {
  const rgba = Buffer.alloc(size * size * 4);
  const aa = 2.4 / size;
  const scale = maskable ? 1.24 : 1.0; // keep symbol inside maskable 80% safe zone

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const nx = ((px + 0.5) / size) * 2 - 1;
      const ny = ((py + 0.5) / size) * 2 - 1;

      // Base background
      let col = [0, 0, 0, 0];
      const bgGrad = mixColor(C_BG_TOP, C_BG_BOT, clamp((ny + 1) * 0.5, 0, 1));
      const dBox = maskable ? -1 : sdRoundedBox(nx, ny, 0.92, 0.92, 0.24);
      const aBox = cov(dBox, aa);

      if (aBox > 0) {
        col = [bgGrad[0], bgGrad[1], bgGrad[2], aBox];

        // Subtle radial glow behind emblem
        const distCenter = Math.hypot(nx, ny);
        const glowColor = kind === 'core' ? C_SKY : kind === 'projectarium' ? C_EMERALD_GLOW : C_LEMON;
        const glowStrength = Math.max(0, 1 - distCenter / 1.1) * 0.14;
        col = blendOver(col, [glowColor[0], glowColor[1], glowColor[2], glowStrength * aBox]);

        // Subtle inner rim highlight (non-maskable)
        if (!maskable) {
          const rimDist = Math.abs(dBox + 0.018) - 0.008;
          const rimAlpha = cov(rimDist, aa) * 0.35;
          const rimCol = kind === 'core' ? C_SKY : C_LEMON;
          col = blendOver(col, [rimCol[0], rimCol[1], rimCol[2], rimAlpha]);
        }
      }

      // Scaled coordinates for emblem
      const x = nx * scale;
      const y = ny * scale;
      const saa = aa * scale;

      if (kind === 'projectarium') {
        // Projectarium: Cockpit Hexagon + Port Shield Core + 3 Live Stand Nodes
        const dHexOuter = Math.abs(sdHexagon(x, y, 0.52)) - 0.042;
        const aHex = cov(dHexOuter, saa);
        if (aHex > 0) {
          const hexCol = mixColor(C_LEMON_BRIGHT, C_AMBER, clamp((y + 0.5) / 1.0, 0, 1));
          col = blendOver(col, [hexCol[0], hexCol[1], hexCol[2], aHex]);
        }

        // Inner dark plate
        const dHexInner = sdHexagon(x, y, 0.44);
        col = blendOver(col, [C_SLATE_INNER[0], C_SLATE_INNER[1], C_SLATE_INNER[2], cov(dHexInner, saa) * 0.85]);

        // 3 spokes connecting center to stand nodes
        const nodes = [
          [0, -0.34, C_EMERALD_GLOW],
          [-0.30, 0.19, C_LEMON_BRIGHT],
          [0.30, 0.19, C_SKY],
        ];
        for (const [tx, ty] of nodes) {
          const dSeg = sdSegment(x, y, 0, 0, tx, ty) - 0.026;
          col = blendOver(col, [C_LEMON[0], C_LEMON[1], C_LEMON[2], cov(dSeg, saa) * 0.85]);
        }

        // Outer nodes
        for (const [tx, ty, nc] of nodes) {
          const dNodeBorder = sdCircle(x, y, tx, ty, 0.105);
          col = blendOver(col, [C_BG_TOP[0], C_BG_TOP[1], C_BG_TOP[2], cov(dNodeBorder, saa)]);
          const dNode = sdCircle(x, y, tx, ty, 0.075);
          col = blendOver(col, [nc[0], nc[1], nc[2], cov(dNode, saa)]);
        }

        // Center live hub
        const dCenterRing = sdCircle(x, y, 0, 0, 0.155);
        col = blendOver(col, [C_LEMON_BRIGHT[0], C_LEMON_BRIGHT[1], C_LEMON_BRIGHT[2], cov(dCenterRing, saa)]);
        const dCenterCore = sdCircle(x, y, 0, 0, 0.085);
        col = blendOver(col, [C_EMERALD[0], C_EMERALD[1], C_EMERALD[2], cov(dCenterCore, saa)]);
      } else if (kind === 'core') {
        // Core Combinator: Reactive Hub + 4 Combinator Flow Streams
        const arms = [
          [-0.42, -0.30, C_SKY],
          [0.42, -0.30, C_LEMON_BRIGHT],
          [-0.42, 0.30, C_EMERALD_GLOW],
          [0.42, 0.30, C_SKY],
        ];

        // Orbit ring
        const dOrbit = Math.abs(sdCircle(x, y, 0, 0, 0.44)) - 0.022;
        col = blendOver(col, [C_SKY[0], C_SKY[1], C_SKY[2], cov(dOrbit, saa) * 0.35]);

        // Flow beams
        for (const [tx, ty, ac] of arms) {
          const dSeg = sdSegment(x, y, 0, 0, tx, ty) - 0.032;
          const beamCol = mixColor(C_LEMON, ac, 0.55);
          col = blendOver(col, [beamCol[0], beamCol[1], beamCol[2], cov(dSeg, saa) * 0.92]);
        }

        // Satellite channel nodes
        for (const [tx, ty, ac] of arms) {
          const dOuter = sdRoundedBox(x - tx, y - ty, 0.115, 0.115, 0.045);
          col = blendOver(col, [C_BG_TOP[0], C_BG_TOP[1], C_BG_TOP[2], cov(dOuter, saa)]);
          const dInner = sdRoundedBox(x - tx, y - ty, 0.082, 0.082, 0.032);
          col = blendOver(col, [ac[0], ac[1], ac[2], cov(dInner, saa)]);
        }

        // Central Combinator Hub
        const dHubBg = sdCircle(x, y, 0, 0, 0.22);
        col = blendOver(col, [C_BG_TOP[0], C_BG_TOP[1], C_BG_TOP[2], cov(dHubBg, saa)]);
        const dHub = sdCircle(x, y, 0, 0, 0.175);
        const hubCol = mixColor(C_LEMON_BRIGHT, C_AMBER, clamp((y + 0.18) / 0.36, 0, 1));
        col = blendOver(col, [hubCol[0], hubCol[1], hubCol[2], cov(dHub, saa)]);
        const dHubDot = sdCircle(x, y, 0, 0, 0.075);
        col = blendOver(col, [C_COBALT[0], C_COBALT[1], C_COBALT[2], cov(dHubDot, saa)]);
      } else {
        // Lemon Actions Suite: Stylized Lemon + Leaf
        const rx = x * 0.85 + y * 0.52;
        const ry = -x * 0.52 + y * 0.85;
        const dLemon = Math.hypot(rx / 0.48, ry / 0.34) - 1;
        // Scale SDF approx to world units
        const dLemonW = dLemon * 0.34;
        const lemonCol = mixColor(C_LEMON_BRIGHT, C_AMBER, clamp((y + 0.4) / 0.8, 0, 1));
        col = blendOver(col, [lemonCol[0], lemonCol[1], lemonCol[2], cov(dLemonW, saa)]);
        // Leaf
        const dLeaf = Math.hypot((x - 0.16) / 0.18, (y + 0.36) / 0.10) - 1;
        col = blendOver(col, [C_EMERALD_GLOW[0], C_EMERALD_GLOW[1], C_EMERALD_GLOW[2], cov(dLeaf * 0.1, saa)]);
      }

      const idx = (py * size + px) * 4;
      rgba[idx] = clamp(Math.round(col[0]), 0, 255);
      rgba[idx + 1] = clamp(Math.round(col[1]), 0, 255);
      rgba[idx + 2] = clamp(Math.round(col[2]), 0, 255);
      rgba[idx + 3] = clamp(Math.round(col[3] * 255), 0, 255);
    }
  }

  return encodePng(size, size, rgba);
}

const SVG_TEMPLATES = {
  projectarium: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#21252b"/>
      <stop offset="100%" stop-color="#2c313a"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f7e08a"/>
      <stop offset="100%" stop-color="#d19a66"/>
    </linearGradient>
  </defs>
  <rect x="20" y="20" width="472" height="472" rx="112" fill="url(#bg)" stroke="#e5c07b" stroke-opacity="0.35" stroke-width="6"/>
  <polygon points="256,118 375,187 375,325 256,394 137,325 137,187" fill="#323844" fill-opacity="0.85" stroke="url(#gold)" stroke-width="18" stroke-linejoin="round"/>
  <line x1="256" y1="256" x2="256" y2="169" stroke="#e5c07b" stroke-width="14" stroke-linecap="round"/>
  <line x1="256" y1="256" x2="179" y2="305" stroke="#e5c07b" stroke-width="14" stroke-linecap="round"/>
  <line x1="256" y1="256" x2="333" y2="305" stroke="#e5c07b" stroke-width="14" stroke-linecap="round"/>
  <circle cx="256" cy="169" r="22" fill="#98c379" stroke="#21252b" stroke-width="8"/>
  <circle cx="179" cy="305" r="22" fill="#f7e08a" stroke="#21252b" stroke-width="8"/>
  <circle cx="333" cy="305" r="22" fill="#61afef" stroke="#21252b" stroke-width="8"/>
  <circle cx="256" cy="256" r="38" fill="#f7e08a"/>
  <circle cx="256" cy="256" r="20" fill="#50a14f"/>
</svg>`,
  core: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#21252b"/>
      <stop offset="100%" stop-color="#2c313a"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f7e08a"/>
      <stop offset="100%" stop-color="#d19a66"/>
    </linearGradient>
  </defs>
  <rect x="20" y="20" width="472" height="472" rx="112" fill="url(#bg)" stroke="#61afef" stroke-opacity="0.35" stroke-width="6"/>
  <circle cx="256" cy="256" r="112" fill="none" stroke="#61afef" stroke-opacity="0.35" stroke-width="10"/>
  <line x1="256" y1="256" x2="148" y2="179" stroke="#61afef" stroke-width="16" stroke-linecap="round"/>
  <line x1="256" y1="256" x2="364" y2="179" stroke="#e5c07b" stroke-width="16" stroke-linecap="round"/>
  <line x1="256" y1="256" x2="148" y2="333" stroke="#98c379" stroke-width="16" stroke-linecap="round"/>
  <line x1="256" y1="256" x2="364" y2="333" stroke="#61afef" stroke-width="16" stroke-linecap="round"/>
  <rect x="124" y="155" width="48" height="48" rx="14" fill="#61afef" stroke="#21252b" stroke-width="8"/>
  <rect x="340" y="155" width="48" height="48" rx="14" fill="#f7e08a" stroke="#21252b" stroke-width="8"/>
  <rect x="124" y="309" width="48" height="48" rx="14" fill="#98c379" stroke="#21252b" stroke-width="8"/>
  <rect x="340" y="309" width="48" height="48" rx="14" fill="#61afef" stroke="#21252b" stroke-width="8"/>
  <circle cx="256" cy="256" r="48" fill="url(#gold)" stroke="#21252b" stroke-width="10"/>
  <circle cx="256" cy="256" r="19" fill="#4078f2"/>
</svg>`,
  actions: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#21252b"/>
      <stop offset="100%" stop-color="#2c313a"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#f7e08a"/>
      <stop offset="100%" stop-color="#d19a66"/>
    </linearGradient>
  </defs>
  <rect x="20" y="20" width="472" height="472" rx="112" fill="url(#bg)" stroke="#e5c07b" stroke-opacity="0.35" stroke-width="6"/>
  <ellipse cx="256" cy="264" rx="122" ry="86" transform="rotate(-30 256 264)" fill="url(#gold)"/>
  <ellipse cx="298" cy="164" rx="46" ry="24" transform="rotate(-18 298 164)" fill="#98c379"/>
</svg>`,
};

for (const kind of ['projectarium', 'core', 'actions']) {
  writeFileSync(join(OUT_DIR, `${kind}.svg`), SVG_TEMPLATES[kind], 'utf8');
  writeFileSync(join(OUT_DIR, `${kind}-180.png`), renderIcon(180, kind, false));
  writeFileSync(join(OUT_DIR, `${kind}-192.png`), renderIcon(192, kind, false));
  writeFileSync(join(OUT_DIR, `${kind}-512.png`), renderIcon(512, kind, false));
  writeFileSync(join(OUT_DIR, `${kind}-maskable-512.png`), renderIcon(512, kind, true));
}

console.log('Generated PWA icons in', OUT_DIR);
