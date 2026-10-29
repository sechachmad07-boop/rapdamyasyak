// test.js  --  Uji round-trip embed/extract (jalankan: node test.js)
// Membuat gambar sintetis, embed pesan, extract, lalu simulasikan kompresi JPEG
// dengan mengkuantisasi koefisien DCT (pendekatan) dan cek ketahanan.

const sharp = require('sharp');
const { embed } = require('./src/embed');
const { extract } = require('./src/extract');

async function main() {
  // Buat gambar sintetis 256x256 (gradient) sebagai PNG buffer
  const W = 256, H = 256;
  const buf = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      buf[i] = (x * 3 + y * 5) % 256;
      buf[i + 1] = (x * 7 + y * 2) % 256;
      buf[i + 2] = (x * 2 + y * 9) % 256;
    }
  }
  const pngBuf = await sharp(buf, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();

  const msg = 'nama_kreator';
  const delta = 30;

  // 1. Embed
  const { data, info } = await sharp(pngBuf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = info.width, height = info.height;
  const out = embed(new Uint8Array(data), width, height, msg, delta);
  console.log('Embed OK, dimensi:', out.width, 'x', out.height);

  // 2. Extract tanpa kompresi
  const { data: d2 } = await sharp(Buffer.from(out.buffer), { raw: { width: out.width, height: out.height, channels: 3 } }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  console.log('Tanpa kompresi:', JSON.stringify(extract(new Uint8Array(d2), out.width, out.height, delta)));

  // 3. Simulasi JPEG: kompresi ke JPEG quality 70 lalu extract
  const jpegBuf = await sharp(Buffer.from(out.buffer), { raw: { width: out.width, height: out.height, channels: 3 } }).jpeg({ quality: 70 }).toBuffer();
  const { data: d3, info: i3 } = await sharp(jpegBuf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const w3 = i3.width, h3 = i3.height;
  console.log('JPEG q=70:', JSON.stringify(extract(new Uint8Array(d3), w3, h3, delta)));
  console.log('Ukuran JPEG:', jpegBuf.length, 'bytes');
}

main().catch((e) => { console.error(e); process.exit(1); });
