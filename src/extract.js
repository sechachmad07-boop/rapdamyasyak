// ============================================================
// extract.js  --  Ekstraksi (Extraction) watermark teks
//
// Kebalikan embed: baca koefisien (u,v) dari tiap blok,
// terapkan QIM decode: bit = (round(coef/delta) mod 2).
// Tiap bit di-REDUNDANCY blok -> majority vote.
// Baca 32 bit pertama sebagai panjang pesan, lalu payload.
// ============================================================

const { dct2d } = require('./dct');
const { splitChannels, padToMultipleOf8 } = require('./imageUtils');

const BLOCK = 8;
const REDUNDANCY = 3;
const COEF_U = 3;
const COEF_V = 3;

function qimExtract(coef, delta) {
  const q = Math.round(coef / delta);
  return (q % 2 + 2) % 2;
}

// Majority vote: array of bits -> 0/1
function majority(bits) {
  let ones = bits.filter((b) => b === 1).length;
  return ones >= bits.length / 2 ? 1 : 0;
}

// ------------------------------------------------------------
// Ekstrak pesan dari buffer RGB
// return string (UTF-8) atau '' jika gagal
// ------------------------------------------------------------
function extract(rgbBuffer, width, height, delta = 30) {
  if (!delta || delta <= 0) delta = 30;
  const padded = padToMultipleOf8(rgbBuffer, width, height);
  const W = padded.width, H = padded.height;
  const buf = padded.data;

  const { Y } = splitChannels(buf, W, H);
  const blocksX = W / BLOCK;
  const blocksY = H / BLOCK;

  // daftar blok row-major
  const blockList = [];
  for (let by = 0; by < blocksY; by++)
    for (let bx = 0; bx < blocksX; bx++) blockList.push({ bx, by });

  // helper: baca 1 bit dari blok index i (dengan redundansi)
  function readBitAt(blockStart) {
    const votes = [];
    for (let r = 0; r < REDUNDANCY; r++) {
      const { bx, by } = blockList[blockStart + r];
      const block = Array.from({ length: BLOCK }, (_, dy) =>
        Array.from({ length: BLOCK }, (_, dx) => Y[by * BLOCK + dy][bx * BLOCK + dx])
      );
      const dct = dct2d(block);
      votes.push(qimExtract(dct[COEF_U][COEF_V], delta));
    }
    return majority(votes);
  }

  // 1. Baca 32 bit panjang
  const totalBlocks = blockList.length;
  let cursor = 0;
  const lenBits = [];
  for (let i = 0; i < 32; i++) {
    if (cursor + REDUNDANCY > totalBlocks) return '';
    lenBits.push(readBitAt(cursor));
    cursor += REDUNDANCY;
  }
  let len = 0;
  for (let b of lenBits) len = (len << 1) | b;

  if (len < 0 || len > 100000) return '';   // sanity check
  if (cursor + len * 8 * REDUNDANCY > totalBlocks) return '';

  // 2. Baca payload
  const payloadBits = [];
  for (let i = 0; i < len * 8; i++) {
    if (cursor + REDUNDANCY > totalBlocks) return '';
    payloadBits.push(readBitAt(cursor));
    cursor += REDUNDANCY;
  }

  // 3. Bits -> bytes -> string
  const bytes = [];
  for (let i = 0; i < payloadBits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | payloadBits[i + j];
    bytes.push(byte);
  }
  try {
    return Buffer.from(bytes).toString('utf8');
  } catch (e) {
    return '';
  }
}

module.exports = { extract, qimExtract, majority };
