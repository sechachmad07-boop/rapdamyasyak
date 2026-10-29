// ============================================================
// dct.js  --  Transformasi DCT 2D (Discrete Cosine Transform)
// Tujuan Tubes: menyisipkan watermark pada domain frekuensi
// agar tahan terhadap kompresi JPEG (JPEG sendiri pakai DCT).
//
// Komentar ditulis untuk pemula: setiap rumus diberi penjelasan.
// ============================================================

// Konstanta pi
const PI = Math.PI;

// Faktor skala C(u) pada rumus DCT:
//   C(0) = 1/sqrt(2)   (untuk frekuensi DC)
//   C(u) = 1            (untuk frekuensi AC, u>0)
// Ini adalah bagian dari definisi DCT tipe II standar.
function C(u) {
  return u === 0 ? 1 / Math.sqrt(2) : 1;
}

// ------------------------------------------------------------
// DCT 1D (satu dimensi) pada array sepanjang N.
// Rumus:  F(u) = sqrt(2/N) * C(u) * sum_{x=0}^{N-1} f(x) * cos((2x+1)*u*pi/(2N))
// Kita pakai bentuk yang sudah digabung: (1/4)*C(u)... untuk 2D.
// Untuk 1D murni kita pakai normalisasi sqrt(2/N).
// ------------------------------------------------------------
function dct1d(input) {
  const N = input.length;
  const out = new Array(N).fill(0);
  for (let u = 0; u < N; u++) {
    let sum = 0;
    for (let x = 0; x < N; x++) {
      sum += input[x] * Math.cos(((2 * x + 1) * u * PI) / (2 * N));
    }
    out[u] = Math.sqrt(2 / N) * C(u) * sum;
  }
  return out;
}

// ------------------------------------------------------------
// IDCT 1D (kebalikan DCT 1D)
// Rumus:  f(x) = sqrt(2/N) * sum_{u=0}^{N-1} C(u) * F(u) * cos((2x+1)*u*pi/(2N))
// ------------------------------------------------------------
function idct1d(input) {
  const N = input.length;
  const out = new Array(N).fill(0);
  for (let x = 0; x < N; x++) {
    let sum = 0;
    for (let u = 0; u < N; u++) {
      sum += C(u) * input[u] * Math.cos(((2 * x + 1) * u * PI) / (2 * N));
    }
    out[x] = Math.sqrt(2 / N) * sum;
  }
  return out;
}

// ------------------------------------------------------------
// DCT 2D pada blok N x N (biasanya 8x8).
// Cara kerja: terapkan DCT 1D pada setiap BARIS, lalu pada setiap KOLOM.
// Ini ekuivalen dengan rumus DCT 2D penuh, tapi lebih mudah dibaca.
// ------------------------------------------------------------
function dct2d(block) {
  const N = block.length;          // tinggi blok (8)
  const M = block[0].length;       // lebar blok (8)
  // Step 1: DCT pada setiap baris
  const rowDct = block.map((row) => dct1d(row));
  // Step 2: DCT pada setiap kolom (transpose -> dct -> transpose)
  const result = Array.from({ length: N }, () => new Array(M).fill(0));
  for (let c = 0; c < M; c++) {
    const col = rowDct.map((r) => r[c]);
    const colDct = dct1d(col);
    for (let r = 0; r < N; r++) result[r][c] = colDct[r];
  }
  return result;
}

// ------------------------------------------------------------
// IDCT 2D pada blok N x N (kebalikan dct2d).
// Terapkan IDCT 1D pada kolom, lalu pada baris.
// ------------------------------------------------------------
function idct2d(block) {
  const N = block.length;
  const M = block[0].length;
  // Step 1: IDCT pada setiap kolom
  const colIdct = Array.from({ length: N }, () => new Array(M).fill(0));
  for (let c = 0; c < M; c++) {
    const col = block.map((r) => r[c]);
    const out = idct1d(col);
    for (let r = 0; r < N; r++) colIdct[r][c] = out[r];
  }
  // Step 2: IDCT pada setiap baris
  return colIdct.map((row) => idct1d(row));
}

// ------------------------------------------------------------
// Helper: buat matriks kosong N x M
// ------------------------------------------------------------
function zeros(N, M) {
  return Array.from({ length: N }, () => new Array(M).fill(0));
}

// Ekspor fungsi agar bisa dipakai modul lain
module.exports = { dct1d, idct1d, dct2d, idct2d, zeros, C };
