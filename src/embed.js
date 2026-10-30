// ============================================================
// embed.js  --  Penyisipan (Embedding) watermark teks
//
// Algoritma:
//   1. Konversi pesan teks -> bit stream (32-bit panjang + 8-bit per char).
//   2. Ubah gambar ke YCbCr, ambil channel Y (luminance).
//   3. Bagi Y menjadi blok 8x8, DCT tiap blok.
//   4. Pada koefisien frekuensi menengah (3,3) sisipkan 1 bit
//      menggunakan QIM (Quantization Index Modulation):
//        q = round(coef / delta);  if (q mod 2 != bit) q += 1;  coef' = q*delta
//      QIM tahan kompresi karena perubahan terkuantisasi.
//   5. IDCT, gabung kembali, konversi ke RGB.
//
// Redundansi: tiap bit disisipkan di R blok (majority vote saat ekstraksi).
// ============================================================

const { dct2d, idct2d } = require('./dct');
const { splitChannels, mergeChannels, padToMultipleOf8, cropToOriginal } = require('./imageUtils');

const BLOCK = 8;
const REDUNDANCY = 5;          // tiap bit di 5 blok
const COEF_U = 3;              // koefisien frekuensi menengah
const COEF_V = 3;

// ------------------------------------------------------------
// Teks -> array bit (0/1)
// Format: [32 bit panjang pesan][8 bit per karakter]
// ------------------------------------------------------------
function textToBits(text) {
  const bytes = Buffer.from(text, 'utf8');
  const bits = [];
  // 32-bit panjang (jumlah karakter)
  const len = bytes.length;
  for (let i = 31; i >= 0; i--) bits.push((len >> i) & 1);
  // 8 bit per byte
  for (let b of bytes) {
    for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
  }
  return bits;
}

// ------------------------------------------------------------
// QIM embed satu bit ke satu koefisien
// ------------------------------------------------------------
function qimEmbed(coef, bit, delta) {
  let q = Math.round(coef / delta);
  if ((q % 2 + 2) % 2 !== bit) q += 1;   // sesuaikan paritas
  return q * delta;
}

// ------------------------------------------------------------
// Fungsi utama embedding
// input: rgbBuffer (Uint8Array), width, height
// output: { buffer, width, height } (padded dims == original if already multiple of 8)
// ------------------------------------------------------------
function embed(rgbBuffer, width, height, message, delta = 30) {
  if (!delta || delta <= 0) delta = 30;
  if (!message) throw new Error('Pesan watermark kosong');

  // 1. Pad ke kelipatan 8
  const padded = padToMultipleOf8(rgbBuffer, width, height);
  const W = padded.width, H = padded.height;
  const buf = padded.data;

  // 2. Bit stream
  const bits = textToBits(message);
  const blocksX = W / BLOCK;
  const blocksY = H / BLOCK;
  const totalBlocks = blocksX * blocksY;
  const needed = bits.length * REDUNDANCY;
  if (needed > totalBlocks) {
    const minSide = Math.ceil(Math.sqrt(needed)) * BLOCK;
    throw new Error(
      `Gambar terlalu kecil. Butuh ${needed} blok, tersedia ${totalBlocks}. ` +
      `Perkecil pesan atau gunakan gambar lebih besar (minimal sekitar ${minSide}x${minSide} piksel).`
    );
  }

  // 3. Split channel
  const { Y, Cb, Cr } = splitChannels(buf, W, H);

  // 4. Enumerasi blok & sisipkan
  const blockList = [];
  for (let by = 0; by < blocksY; by++) {
    for (let bx = 0; bx < blocksX; bx++) {
      blockList.push({ bx, by });
    }
  }

  for (let i = 0; i < bits.length; i++) {
    const bit = bits[i];
    for (let r = 0; r < REDUNDANCY; r++) {
      const { bx, by } = blockList[i * REDUNDANCY + r];
      // ambil blok 8x8 dari Y
      const block = Array.from({ length: BLOCK }, (_, dy) =>
        Array.from({ length: BLOCK }, (_, dx) => Y[by * BLOCK + dy][bx * BLOCK + dx])
      );
      const dct = dct2d(block);
      // sisipkan pada koefisien (COEF_U, COEF_V)
      dct[COEF_U][COEF_V] = qimEmbed(dct[COEF_U][COEF_V], bit, delta);
      const idct = idct2d(dct);
      // tulis kembali
      for (let dy = 0; dy < BLOCK; dy++) {
        for (let dx = 0; dx < BLOCK; dx++) {
          Y[by * BLOCK + dy][bx * BLOCK + dx] = idct[dy][dx];
        }
      }
    }
  }

  // 5. Merge (keep padded dimensions so extract sees same blocks)
  const outBuf = mergeChannels(Y, Cb, Cr, W, H);
  return { buffer: outBuf, width: W, height: H };
}

module.exports = { embed, textToBits, qimEmbed, REDUNDANCY };
