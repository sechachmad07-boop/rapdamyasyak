// ============================================================
// app.js  --  Frontend logic (Vanilla JS)
// Memanggil API backend: /api/embed, /api/extract, /api/test-jpeg
// ============================================================

const $ = (id) => document.getElementById(id);

// ---------- Slider sync ----------
function syncSlider(rangeId, outId) {
  const r = $(rangeId), o = $(outId);
  const update = () => (o.textContent = r.value);
  r.addEventListener('input', update);
  update();
}
syncSlider('strength', 'strOut');
syncSlider('strength2', 'strOut2');
syncSlider('strength3', 'strOut3');
syncSlider('quality', 'qOut');

// ---------- Helper fetch ----------
async function postForm(url, formData) {
  const res = await fetch(url, { method: 'POST', body: formData });
  if (!res.ok) {
    let msg = 'Gagal';
    try { const j = await res.json(); msg = j.error || msg; } catch (e) {}
    throw new Error(msg);
  }
  return res;
}

// ---------- EMBED ----------
$('btnEmbed').addEventListener('click', async () => {
  const file = $('embedFile').files[0];
  if (!file) return alert('Pilih gambar dulu');
  const fd = new FormData();
  fd.append('image', file);
  fd.append('message', $('embedMsg').value);
  fd.append('strength', $('strength').value);
  $('embedStatus').textContent = 'Memproses...';
  try {
    const res = await postForm('/api/embed', fd);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const img = $('embedPreview');
    img.src = url;
    img.classList.add('show');
    // auto download
    const a = document.createElement('a');
    a.href = url;
    a.download = 'watermarked.png';
    a.click();
    $('embedStatus').textContent = 'Berhasil! File watermarked.png diunduh.';
    // sinkronkan kekuatan & pesan ke bagian extract/uji agar konsisten
    const s = $('strength').value;
    $('strength2').value = s; $('strOut2').textContent = s;
    $('strength3').value = s; $('strOut3').textContent = s;
    $('testMsg').value = $('embedMsg').value;
  } catch (e) {
    $('embedStatus').textContent = 'Error: ' + e.message;
  }
});

// ---------- EXTRACT ----------
$('btnExtract').addEventListener('click', async () => {
  const file = $('extractFile').files[0];
  if (!file) return alert('Pilih gambar dulu');
  const fd = new FormData();
  fd.append('image', file);
  fd.append('strength', $('strength2').value);
  $('extractResult').textContent = 'Memproses...';
  try {
    const res = await postForm('/api/extract', fd);
    const j = await res.json();
    $('extractResult').textContent = 'Pesan terdeteksi: "' + j.message + '" (panjang ' + j.length + ')';
  } catch (e) {
    $('extractResult').textContent = 'Error: ' + e.message;
  }
});

// ---------- TEST JPEG ----------
$('btnTest').addEventListener('click', async () => {
  const file = $('testFile').files[0];
  if (!file) return alert('Pilih gambar dulu');
  const fd = new FormData();
  fd.append('image', file);
  fd.append('message', $('testMsg').value);
  fd.append('quality', $('quality').value);
  fd.append('strength', $('strength3').value);
  $('testResult').textContent = 'Memproses...';
  try {
    const res = await postForm('/api/test-jpeg', fd);
    const j = await res.json();
    $('testResult').textContent =
      'Pesan asli   : ' + j.original + '\n' +
      'Pesan ekstrak: ' + j.extracted + '\n' +
      'Quality JPEG : ' + j.quality + '\n' +
      'Ukuran JPEG  : ' + j.jpegBytes + ' bytes\n' +
      'Status       : ' + (j.success ? 'BERTAHAN ✓' : 'RUSAK ✗');
  } catch (e) {
    $('testResult').textContent = 'Error: ' + e.message;
  }
});
