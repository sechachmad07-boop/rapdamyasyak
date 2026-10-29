// test_fixed.js  --  Uji robust embed/extract (jalankan: node test_fixed.js)
const sharp = require('sharp');
const { embed } = require('./src/embed');
const { extract } = require('./src/extract');

async function makeImage(w, h) {
  const buf = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      buf[i] = (x * 3 + y * 5) % 256;
      buf[i + 1] = (x * 7 + y * 2) % 256;
      buf[i + 2] = (x * 2 + y * 9) % 256;
    }
  }
  const pngBuf = await sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
  const { data, info } = await sharp(pngBuf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
}

async function run() {
  const cases = [
    { w: 256, h: 256, msg: 'nama_kreator' },
    { w: 300, h: 200, msg: 'halo' },
    { w: 128, h: 128, msg: 'a' },
  ];
  for (const c of cases) {
    const img = await makeImage(c.w, c.h);
    const delta = 30;
    const out = embed(img.data, img.width, img.height, c.msg, delta);
    const { data: d2 } = await sharp(Buffer.from(out.buffer), { raw: { width: out.width, height: out.height, channels: 3 } }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const got = extract(new Uint8Array(d2), out.width, out.height, delta);
    if (got !== c.msg) throw new Error('Roundtrip gagal: ' + JSON.stringify(got) + ' != ' + JSON.stringify(c.msg));
    // JPEG
    const jpegBuf = await sharp(Buffer.from(out.buffer), { raw: { width: out.width, height: out.height, channels: 3 } }).jpeg({ quality: 70 }).toBuffer();
    const { data: d3, info: i3 } = await sharp(jpegBuf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const got2 = extract(new Uint8Array(d3), i3.width, i3.height, delta);
    console.log(c.w + 'x' + c.h, '->', JSON.stringify(got), '| JPEG:', JSON.stringify(got2));
  }
  console.log('ALL OK');
}

run().catch((e) => { console.error(e); process.exit(1); });
