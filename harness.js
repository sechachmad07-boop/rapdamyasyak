// harness.js  --  Test harness (jalankan: node harness.js)
const { embed } = require('./src/embed');
const { extract } = require('./src/extract');
const sharp = require('sharp');

(async () => {
  const W = 64, H = 64;
  const buf = Buffer.alloc(W * H * 3);
  for (let i = 0; i < buf.length; i++) buf[i] = (i * 37) % 256;
  const pngBuf = await sharp(buf, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer();
  const { data, info } = await sharp(pngBuf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  // image too small for message -> should throw
  let threw = false;
  try { embed(new Uint8Array(data), info.width, info.height, 'hello world this is long', 30); }
  catch (e) { threw = true; }
  if (!threw) { console.error('Expected throw for too-small image'); process.exit(1); }
  console.log('harness OK');
})().catch((e) => { console.error(e); process.exit(1); });
