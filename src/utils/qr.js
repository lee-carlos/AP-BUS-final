// Tiny QR Code generator (no dependencies): alphanumeric mode, error correction level M,
// versions 1-3. Enough for boarding passes such as "SM-K7M29QXA4TBC".
const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
const VERSIONS = [null, { data: 16, ec: 10, align: null }, { data: 28, ec: 16, align: 18 }, { data: 44, ec: 26, align: 22 }];

// Galois field GF(256) tables for Reed-Solomon.
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = x;
  LOG[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= 0x11d;
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function reedSolomon(data, ecLen) {
  let gen = [1];
  for (let i = 0; i < ecLen; i++) {
    const next = new Array(gen.length + 1).fill(0);
    for (let j = 0; j < gen.length; j++) {
      next[j] ^= gen[j];
      next[j + 1] ^= mul(gen[j], EXP[i]);
    }
    gen = next;
  }
  const rem = new Array(ecLen).fill(0);
  for (const byte of data) {
    const factor = byte ^ rem.shift();
    rem.push(0);
    for (let j = 0; j < ecLen; j++) rem[j] ^= mul(gen[j + 1], factor);
  }
  return rem;
}

function encodeData(text) {
  const bits = [];
  const put = (value, length) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  put(0b0010, 4);
  put(text.length, 9);
  for (let i = 0; i < text.length; i += 2) {
    const a = ALNUM.indexOf(text[i]);
    if (i + 1 < text.length) put(a * 45 + ALNUM.indexOf(text[i + 1]), 11);
    else put(a, 6);
  }
  const version = VERSIONS.findIndex((v) => v && bits.length <= v.data * 8);
  if (version < 0) throw new Error('Text too long for this QR generator');
  const capacity = VERSIONS[version].data * 8;
  put(0, Math.min(4, capacity - bits.length));
  while (bits.length % 8) bits.push(0);
  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0xec; bytes.length < VERSIONS[version].data; pad ^= 0xec ^ 0x11) bytes.push(pad);
  return { version, bytes };
}

const MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function build(version, codewords, mask) {
  const size = version * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    m[y][x] = dark;
    fn[y][x] = true;
  };
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(cx + dx, cy + dy, d !== 2 && d !== 4);
      }
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  for (let i = 0; i < size; i++) {
    if (!fn[6][i]) set(i, 6, i % 2 === 0);
    if (!fn[i][6]) set(6, i, i % 2 === 0);
  }
  const a = VERSIONS[version].align;
  if (a) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(a + dx, a + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);

  // Format information: level M (00) + mask, protected by a BCH code.
  let rem = mask;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const format = ((mask << 10) | rem) ^ 0x5412;
  const bit = (i) => ((format >>> i) & 1) === 1;
  for (let i = 0; i <= 5; i++) set(8, i, bit(i));
  set(8, 7, bit(6));
  set(8, 8, bit(7));
  set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
  set(8, size - 8, true);

  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        if (fn[y][x]) continue;
        const dark = i < codewords.length * 8 && ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
        m[y][x] = dark !== MASKS[mask](x, y);
        i++;
      }
    }
  }
  return m;
}

// Simplified mask scoring (long runs, 2x2 blocks, dark/light balance); every mask is decodable.
function penalty(m) {
  const size = m.length;
  let score = 0;
  let dark = 0;
  for (let y = 0; y < size; y++) {
    let runX = 1;
    let runY = 1;
    for (let x = 0; x < size; x++) {
      if (m[y][x]) dark++;
      if (x > 0) {
        runX = m[y][x] === m[y][x - 1] ? runX + 1 : 1;
        if (runX === 5) score += 3;
        else if (runX > 5) score++;
        runY = m[x][y] === m[x - 1][y] ? runY + 1 : 1;
        if (runY === 5) score += 3;
        else if (runY > 5) score++;
      }
      if (x > 0 && y > 0 && m[y][x] === m[y][x - 1] && m[y][x] === m[y - 1][x] && m[y][x] === m[y - 1][x - 1]) score += 3;
    }
  }
  return score + Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;
}

/** Returns a square matrix of booleans (true = dark module). Text must be upper-case alphanumeric. */
export function qrMatrix(text) {
  if (![...text].every((ch) => ALNUM.includes(ch))) throw new Error('Unsupported character for QR');
  const { version, bytes } = encodeData(text);
  const codewords = [...bytes, ...reedSolomon(bytes, VERSIONS[version].ec)];
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const m = build(version, codewords, mask);
    const score = penalty(m);
    if (!best || score < best.score) best = { m, score };
  }
  return best.m;
}

/** SVG markup with a 4-module quiet zone. */
export function qrSvg(text) {
  const m = qrMatrix(text);
  const n = m.length + 8;
  let path = '';
  m.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) path += `M${x + 4} ${y + 4}h1v1h-1z`;
  }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="Boarding pass QR code"><rect width="${n}" height="${n}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}
