// ============================================================
// server.js  --  Express API Server
// Endpoint:
//   POST /api/embed      -> sisipkan watermark, balas PNG
//   POST /api/extract    -> ekstrak watermark, balas JSON
//   POST /api/test-jpeg  -> embed + kompresi JPEG + extract (uji)
// ============================================================

const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');

const { embed } = require('./src/embed');
const { extract } = require('./src/extract');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Helper: baca gambar upload -> {data Uint8Array, width, height}
async function readImage(buffer) {
  const { data, info } = await sharp(buffer)
    .toColorspace('srgb')
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 3) throw new Error('Format gambar tidak didukung (bukan RGB)');
  return { data: new Uint8Array(data), width: info.width, height: info.height };
}

// ---------- EMBED ----------
app.post('/api/embed', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Gambar tidak ditemukan' });
    const message = (req.body.message || '').trim();
    if (!message) return res.status(400).json({ error: 'Pesan watermark kosong' });
    const delta = parseFloat(req.body.strength) || 30;

    const { data, width, height } = await readImage(req.file.buffer);
    const out = embed(data, width, height, message, delta);

    const png = await sharp(Buffer.from(out.buffer), {
      raw: { width: out.width, height: out.height, channels: 3 },
    }).png().toBuffer();

    res.type('image/png');
    res.set('X-Width', String(out.width));
    res.set('X-Height', String(out.height));
    res.send(png);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ---------- EXTRACT ----------
app.post('/api/extract', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Gambar tidak ditemukan' });
    const delta = parseFloat(req.body.strength) || 30;

    const { data, width, height } = await readImage(req.file.buffer);
    const message = extract(data, width, height, delta);
    res.json({ message, length: message.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// ---------- TEST JPEG ----------
app.post('/api/test-jpeg', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Gambar tidak ditemukan' });
    const message = (req.body.message || '').trim();
    if (!message) return res.status(400).json({ error: 'Pesan watermark kosong' });
    const delta = parseFloat(req.body.strength) || 30;
    const quality = parseInt(req.body.quality, 10) || 70;

    const { data, width, height } = await readImage(req.file.buffer);
    const out = embed(data, width, height, message, delta);

    // Kompresi ke JPEG dengan quality tertentu (simulasi kompresi JPEG)
    const jpegBuf = await sharp(Buffer.from(out.buffer), {
      raw: { width: out.width, height: out.height, channels: 3 },
    }).jpeg({ quality }).toBuffer();

    // Ekstrak dari JPEG yang sudah terkompresi
    const { data: jData, width: jW, height: jH } = await readImage(jpegBuf);
    const extracted = extract(jData, jW, jH, delta);

    res.json({
      original: message,
      extracted,
      success: message === extracted,
      quality,
      jpegBytes: jpegBuf.length,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
