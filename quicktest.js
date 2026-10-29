// quicktest.js  --  Smoke test cepat (jalankan: node quicktest.js)
const sharp = require('sharp');
const { embed } = require('./src/embed');
const { extract } = require('./src/extract');
(async () => {
  const W = 128, H = 128;
  const buf = Buffer.alloc(W * H * 3, 128);
  const pngBuf = await sharp(buf, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
  const { data, info } = await sharp(pngBuf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = embed(new Uint8Array(data), info.width, info.height, 'test', 30);
  const { data: d2 } = await sharp(Buffer.from(out.buffer), { raw: { width: out.width, height: out.height, channels: 3 } }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const msg = extract(new Uint8Array(d2), out.width, out.height, 30);
  console.log('extracted:', msg);
  if (msg !== 'test') process.exit(1);
  console.log('OK');
})().catch((e) => { console.error(e); process.exit(1); });
