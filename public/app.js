// ============================================================
// app.js  --  Frontend logic (Vanilla JS)
// Satu foto -> embed + extract + uji JPEG, semua otomatis.
// ============================================================

const $ = (id) => document.getElementById(id);

// Base URL API: jika halaman dibuka langsung dari file (file://),
// arahkan ke server lokal agar proses tetap bisa berjalan.
const API_BASE = (location.protocol === 'file:') ? 'http://localhost:3000' : '';

// ---------- Slider sync ----------
function syncSlider(rangeId, outId) {
  const r = $(rangeId), o = $(outId);
  if (!r || !o) return;
  const update = () => (o.textContent = r.value);
  r.addEventListener('input', update);
  update();
}
syncSlider('strength', 'strOut');
syncSlider('quality', 'qOut');

// ---------- Helper fetch ----------
async function postForm(url, formData) {
  const bases = [];
  if (API_BASE) bases.push(API_BASE);
  bases.push('');
  if (location.protocol === 'file:') bases.push('http://localhost:3000');
  // unique
  const tried = [];
  let lastErr = null;
  for (const base of bases) {
    if (tried.includes(base)) continue;
    tried.push(base);
    try {
      const res = await fetch(base + url, { method: 'POST', body: formData });
      if (!res.ok) {
        let msg = 'Gagal';
        const ct = res.headers.get('content-type') || '';
        try {
          if (ct.indexOf('application/json') !== -1) {
            const j = await res.json();
            msg = (j && j.error) ? j.error : msg;
          } else {
            const t = await res.text();
            if (t) msg = t.slice(0, 200);
          }
        } catch (e) {}
        const err = new Error(msg);
        err.status = res.status;
        throw err;
      }
      return res;
    } catch (e) {
      lastErr = e;
      // coba base berikutnya
    }
  }
  if (lastErr) {
    if (lastErr.message === 'Failed to fetch') {
      throw new Error('Tidak dapat terhubung ke server. Jalankan "node server.js" lalu buka http://localhost:3000');
    }
    throw lastErr;
  }
  throw new Error('Gagal mengirim data');
}

function isImageFile(f) {
  // Terima semua file; validasi format dilakukan di server.
  return !!f;
}

function formatBytes(n) {
  if (!n) return '-';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(2) + ' MB';
}

async function fetchImageInfo(file) {
  const box = $('imageInfo');
  if (!box) return;
  box.hidden = false;
  $('infoW').textContent = '-';
  $('infoH').textContent = '-';
  $('infoFmt').textContent = '-';
  $('infoSize').textContent = '-';
  $('infoStatus').textContent = 'Memeriksa...';
  try {
    const fd = new FormData();
    fd.append('image', file, file.name || 'image.png');
    const res = await postForm('/api/info', fd);
    const j = await res.json();
    $('infoW').textContent = j.width != null ? j.width : '-';
    $('infoH').textContent = j.height != null ? j.height : '-';
    $('infoFmt').textContent = (j.format || '-').toUpperCase();
    $('infoSize').textContent = formatBytes(j.size);
    const st = j.status || '-';
    $('infoStatus').textContent = st + (j.reason ? ' — ' + j.reason : '');
    $('infoStatus').style.color = st === 'Bagus' ? 'var(--ok)' : 'var(--bad)';
  } catch (e) {
    $('infoStatus').textContent = 'Rusak — ' + e.message;
    $('infoStatus').style.color = 'var(--bad)';
  }
}

function setBadge(el, ok) {
  el.textContent = ok ? 'BERTAHAN ✓' : 'RUSAK ✗';
  el.className = 'badge ' + (ok ? 'ok' : 'bad');
}

// ---------- State ----------
let selectedFile = null;

function showPreview(file) {
  const url = URL.createObjectURL(file);
  const img = $('origPreview');
  img.src = url;
  img.classList.add('show');
  $('dropContent').style.display = 'none';
  fetchImageInfo(file);
}

// ---------- Dropzone ----------
const dropzone = $('dropzone');
const fileInput = $('fileInput');

dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const f = fileInput.files && fileInput.files[0];
  if (f && isImageFile(f)) { selectedFile = f; showPreview(f); }
  else if (f) alert('File bukan gambar yang didukung');
});

dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag');
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (f && isImageFile(f)) { selectedFile = f; showPreview(f); }
  else if (f) alert('File bukan gambar yang didukung');
});

// ---------- Process ----------
$('btnProcess').addEventListener('click', async () => {
  if (!selectedFile) return alert('Pilih gambar dulu');
  const msg = $('msg').value.trim();
  if (!msg) return alert('Pesan watermark kosong');
  const strength = $('strength').value;

  const status = $('status');
  const results = $('results');
  status.textContent = 'Memproses...';
  results.hidden = true;

  try {
    // 1. Embed
    const fd = new FormData();
    fd.append('image', selectedFile, selectedFile.name || 'image.png');
    fd.append('message', msg);
    fd.append('strength', strength);
    const res = await postForm('/api/embed', fd);
    const w = res.headers.get('X-Width');
    const h = res.headers.get('X-Height');
    const st = res.headers.get('X-Status') || 'Bagus';
    const blob = await res.blob();
    const wmUrl = URL.createObjectURL(blob);
    const wmImg = $('wmPreview');
    wmImg.src = wmUrl;
    const dl = $('wmDownload');
    dl.href = wmUrl;
    dl.download = 'watermarked_' + (selectedFile.name || 'image.png');

    // Update info gambar dari hasil proses
    if (w) $('infoW').textContent = w;
    if (h) $('infoH').textContent = h;
    $('infoStatus').textContent = st + ' — Watermark berhasil disisipkan';
    $('infoStatus').style.color = 'var(--ok)';

    // 2. Extract (tanpa kompresi) dari hasil watermark (verifikasi, tidak menggagalkan unduh)
    try {
      const fd2 = new FormData();
      fd2.append('image', blob, 'watermarked.png');
      fd2.append('strength', strength);
      const res2 = await postForm('/api/extract', fd2);
      const j2 = await res2.json();
      $('extractMsg').textContent = 'Pesan: ' + (j2.message || '').trim() + ' (panjang ' + j2.length + ')';
      setBadge($('extractBadge'), j2.message === msg);
    } catch (e) {
      $('extractMsg').textContent = 'Verifikasi tidak tersedia: ' + e.message;
      setBadge($('extractBadge'), false);
    }

    results.hidden = false;
    status.textContent = 'Selesai! ✓ Foto bisa diunduh.';
  } catch (e) {
    status.textContent = 'Error: ' + e.message;
    $('infoStatus').textContent = 'Rusak — ' + e.message;
    $('infoStatus').style.color = 'var(--bad)';
  }
});
// ---------- Catatan jika dibuka dari file ----------
(function () {
  if (location.protocol === 'file:') {
    const note = document.createElement('p');
    note.className = 'status';
    note.style.color = '#ff6b6b';
    note.textContent = 'Catatan: halaman dibuka dari file. Pastikan server berjalan (node server.js) agar proses bisa berjalan.';
    const btn = $('btnProcess');
    if (btn && btn.parentNode) btn.parentNode.insertBefore(note, btn);
  }
})();
