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
// Terima banyak field/file sekaligus (single maupun folder upload) agar
// tidak muncul error "Unexpected field" saat pengguna memilih folder/foto.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1000 },
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Ambil file pertama yang diunggah (mendukung single & multiple/folder).
function getUploadedFile(req) {
  if (req.file) return req.file;
  if (Array.isArray(req.files) && req.files.length) return req.files[0];
  return null;
}

// Helper: baca gambar upload -> {data Uint8Array, width, height}
async function readImage(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    const e = new Error('File gambar kosong');
    e.status = 400;
    throw e;
  }
  let info;
  let data;
  try {
    const out = await sharp(buffer)
      .rotate()                 // hormati orientasi EXIF (foto kamera)
      .toColorspace('srgb')
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    data = out.data;
    info = out.info;
  } catch (e) {
    const err = new Error('Format gambar tidak didukung atau file rusak');
    err.status = 400;
    throw err;
  }
  if (!info || !info.width || !info.height) {
    const e = new Error('Dimensi gambar tidak valid');
    e.status = 400;
    throw e;
  }
  if (info.channels !== 3) {
    const e = new Error('Format gambar tidak didukung (bukan RGB)');
    e.status = 400;
    throw e;
  }
  return { data: new Uint8Array(data), width: info.width, height: info.height };
}

// ---------- EMBED ----------
app.post('/api/embed', upload.any(), async (req, res) => {
  try {
    const file = getUploadedFile(req);
    if (!file) return res.status(400).json({ error: 'Gambar tidak ditemukan' });
    if (!file.buffer || file.buffer.length === 0) {
      return res.status(400).json({ error: 'File gambar kosong' });
    }
    const message = (req.body.message || '').trim();
    if (!message) return res.status(400).json({ error: 'Pesan watermark kosong' });
    const delta = parseFloat(req.body.strength) || 30;

    const { data, width, height } = await readImage(file.buffer);
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
    const status = e && e.status ? e.status : 500;
    res.status(status >= 400 && status < 600 ? status : 500).json({ error: e.message });
  }
});

// ---------- EXTRACT ----------
app.post('/api/extract', upload.any(), async (req, res) => {
  try {
    const file = getUploadedFile(req);
    if (!file) return res.status(400).json({ error: 'Gambar tidak ditemukan' });
    if (!file.buffer || file.buffer.length === 0) {
      return res.status(400).json({ error: 'File gambar kosong' });
    }
    const delta = parseFloat(req.body.strength) || 30;

    const { data, width, height } = await readImage(file.buffer);
    const message = extract(data, width, height, delta);
    res.json({ message, length: message.length });
  } catch (e) {
    console.error(e);
    const status = e && e.status ? e.status : 500;
    res.status(status >= 400 && status < 600 ? status : 500).json({ error: e.message });
  }
});

// ---------- TEST JPEG ----------
app.post('/api/test-jpeg', upload.any(), async (req, res) => {
  try {
    const file = getUploadedFile(req);
    if (!file) return res.status(400).json({ error: 'Gambar tidak ditemukan' });
    if (!file.buffer || file.buffer.length === 0) {
      return res.status(400).json({ error: 'File gambar kosong' });
    }
    const message = (req.body.message || '').trim();
    if (!message) return res.status(400).json({ error: 'Pesan watermark kosong' });
    const delta = parseFloat(req.body.strength) || 30;
    const quality = parseInt(req.body.quality, 10) || 70;

    const { data, width, height } = await readImage(file.buffer);
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
    const status = e && e.status ? e.status : 500;
    res.status(status >= 400 && status < 600 ? status : 500).json({ error: e.message });
  }
});

// ---------- Middleware error multer/umum (balas JSON, bukan HTML) ----------
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(400).json({ error: (err && err.message) ? err.message : 'Upload gagal' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
module.exports = { readImage, getUploadedFile };
