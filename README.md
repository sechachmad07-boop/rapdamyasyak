# DCT Watermark — Tak Kasat Mata Tahan Kompresi JPEG

Tugas Besar: Sistem Watermark Tak Kasat Mata Tahan Kompresi JPEG untuk Melindungi Karya Digital Kreator.

## Cara Menjalankan

1. Install Node.js (LTS) dari https://nodejs.org
2. Buka terminal di folder `dct-watermark`
3. Install dependencies (jika diperlukan):
   ```
   npm install
   ```
   Jika `npm` diblokir PowerShell, gunakan `npm.cmd install`.

4. Jalankan server (disarankan, tidak bergantung npm):
   ```
   node server.js
   ```
   Atau dari folder `dct-watermark`:
   ```
   node server.js
   ```
   Jika ingin memakai npm: `npm.cmd start`.

5. Buka browser: http://localhost:3000

## Struktur Folder

```
dct-watermark/
├── package.json
├── server.js              # Express API server
├── src/
│   ├── dct.js             # DCT/IDCT 2D (matematika matriks)
│   ├── imageUtils.js      # RGB<->YCbCr, blok 8x8
│   ├── embed.js           # Penyisipan watermark (QIM)
│   └── extract.js         # Ekstraksi watermark
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
└── README.md
```

## Alur Kerja

1. Upload gambar → backend baca piksel RGB.
2. Konversi RGB → YCbCr, ambil channel Y (luminance).
3. Pad dimensi ke kelipatan 8, bagi menjadi blok 8×8.
4. Tiap blok: DCT 2D → sisipkan 1 bit pada koefisien (3,3) via QIM (delta).
5. IDCT 2D → gabung blok → konversi balik ke RGB → simpan PNG.
6. Ekstraksi: baca koefisien (3,3) tiap blok → QIM decode → majority vote.
7. Uji JPEG: embed → kompresi JPEG (quality q) → extract → bandingkan.

## Parameter Penting

- **delta (kekuatan)**: semakin besar → lebih tahan kompresi, tapi lebih terlihat (trade-off PSNR).
- **Koefisien (3,3)**: frekuensi menengah, tahan JPEG (JPEG membuang frekuensi tinggi).
- **Redundansi 3x**: tiap bit di 3 blok, majority vote meningkatkan robustness.

## Catatan

- Channel Y dipilih karena mata manusia kurang sensitif terhadap perubahan luminance halus.
- Kompresi JPEG memakai DCT 8×8 juga, sehingga watermark pada koefisien frekuensi menengah ikut "terkompresi" bersama gambar.
