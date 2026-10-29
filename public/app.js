// ============================================================
// app.js  --  Frontend logic (Vanilla JS)
// Satu foto -> embed + extract + uji JPEG, semua otomatis.
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
  return !!f && !!f.type && f.type.indexOf('image/') === 0;
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
}

// ---------- Dropzone ----------
const dropzone = $('dropzone');
const fileInput = $('fileInput');

dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const f = fileInput.files && fileInput.files[0];
  if (f && isImageFile(f)) { selectedFile = f; showPreview(f); }
});

dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag');
  const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (f && isImageFile(f)) { selectedFile = f; showPreview(f); }
});

// ---------- Process ----------
$('btnProcess').addEventListener('click', async () => {
  if (!selectedFile) return alert('Pilih gambar dulu');
  const msg = $('msg').value.trim();
  if (!msg) return alert('Pesan watermark kosong');
  const strength = $('strength').value;
  const quality = $('quality').value;

  const status = $('status');
  const results = $('results');
  status.textContent = 'Memproses...';
  results.hidden = true;

  try {
    // 1. Embed
    const fd = new FormData();
    fd.append('image', selectedFile);
    fd.append('message', msg);
    fd.append('strength', strength);
    const res = await postForm('/api/embed', fd);
    const blob = await res.blob();
    const wmUrl = URL.createObjectURL(blob);
    const wmImg = $('wmPreview');
    wmImg.src = wmUrl;
    const dl = $('wmDownload');
    dl.href = wmUrl;
    dl.download = 'watermarked_' + (selectedFile.name || 'image.png');

    // 2. Extract (tanpa kompresi) dari hasil watermark
    const wmFile = new File([blob], 'watermarked.png', { type: 'image/png' });
    const fd2 = new FormData();
    fd2.append('image', wmFile);
    fd2.append('strength', strength);
    const res2 = await postForm('/api/extract', fd2);
    const j2 = await res2.json();
    $('extractMsg').textContent = '"' + j2.message + '" (panjang ' + j2.length + ')';
    setBadge($('extractBadge'), j2.message === msg);

    // 3. Uji tahan JPEG
    const fd3 = new FormData();
    fd3.append('image', selectedFile);
    fd3.append('message', msg);
    fd3.append('quality', quality);
    fd3.append('strength', strength);
    const res3 = await postForm('/api/test-jpeg', fd3);
    const j3 = await res3.json();
    $('jpegInfo').textContent =
      'Pesan ekstrak: "' + j3.extracted + '"\n' +
      'Quality JPEG : ' + j3.quality + '\n' +
      'Ukuran JPEG  : ' + j3.jpegBytes + ' bytes';
    setBadge($('jpegBadge'), j3.success);

    results.hidden = false;
    status.textContent = 'Selesai! ✓';
  } catch (e) {
    status.textContent = 'Error: ' + e.message;
  }
});