// ============================================================
// app.js  --  Frontend logic (Vanilla JS)
// Memanggil API backend: /api/embed, /api/extract, /api/test-jpeg
// ============================================================

const $ = (id) => document.getElementById(id);

// ---------- Slider sync ----------
function syncSlider(rangeId, outId) {
  const r = $(rangeId), o = $(outId);
  if (!r || !o) return;
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
    const ct = res.headers.get('content-type') || '';
    try {
      if (ct.indexOf('application/json') !== -1) {
        const j = await res.json();
        msg = (j && j.error) ? j.error : msg;
      } else {
        const t = await res.text();
        if (t) msg = t;
      }
    } catch (e) {}
    throw new Error(msg);
  }
  return res;
}

function isImageFile(f) {
  return f && f.type && f.type.indexOf('image/') === 0;
}

// ---------- EMBED (single / multi) ----------
async function embedOne(file, msg, strength) {
  const fd = new FormData();
  fd.append('image', file);
  fd.append('message', msg);
  fd.append('strength', strength);
  const res = await postForm('/api/embed', fd);
  return res.blob();
}

$('btnEmbed').addEventListener('click', async () => {
  const files = Array.from($('embedFile').files || []);
  if (!files.length) return alert('Pilih gambar dulu');
  const msg = $('embedMsg').value;
  const strength = $('strength').value;
  $('embedStatus').textContent = 'Memproses...';
  let ok = 0;
  try {
    for (const file of files) {
      if (!isImageFile(file)) continue;
      const blob = await embedOne(file, msg, strength);
      const url = URL.createObjectURL(blob);
      if (files.length === 1) {
        const img = $('embedPreview');
        img.src = url;
        img.classList.add('show');
      }
      const a = document.createElement('a');
      a.href = url;
      a.download = 'watermarked_' + (file.name || 'image.png');
      a.click();
      ok++;
    }
    $('embedStatus').textContent = 'Berhasil! ' + ok + ' file watermarked diunduh.';
    const s = strength;
    $('strength2').value = s; $('strOut2').textContent = s;
    $('strength3').value = s; $('strOut3').textContent = s;
    $('testMsg').value = msg;
  } catch (e) {
    $('embedStatus').textContent = 'Error: ' + e.message;
  }
});

// ---------- EXTRACT ----------
$('btnExtract').addEventListener('click', async () => {
  const files = Array.from($('extractFile').files || []);
  if (!files.length) return alert('Pilih gambar dulu');
  const strength = $('strength2').value;
  $('extractResult').textContent = 'Memproses...';
  const lines = [];
  for (const file of files) {
    if (!isImageFile(file)) continue;
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('strength', strength);
      const res = await postForm('/api/extract', fd);
      const j = await res.json();
      lines.push(file.name + ' -> "' + j.message + '" (panjang ' + j.length + ')');
    } catch (e) {
      lines.push(file.name + ' -> Error: ' + e.message);
    }
  }
  $('extractResult').textContent = lines.join('\n');
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
