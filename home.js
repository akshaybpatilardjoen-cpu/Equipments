/**
 * home.js — index.html logic
 * QR scanning, search, and navigation to equipment.html?id=
 */

// ── State ────────────────────────────────────────────────────────────────────
let _scanInterval = null;
let _equipmentList = [];

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setActiveTab('home');
  loadStats();
  loadEquipmentList();

  // Enter key on search field
  document.getElementById('searchInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') doSearch();
  });
});

// ── Tab Navigation ────────────────────────────────────────────────────────────
function setActiveTab(name) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-section').forEach(s => s.style.display = 'none');

  const tab = document.querySelector(`.nav-tab[data-tab="${name}"]`);
  const section = document.getElementById(`tab-${name}`);
  if (tab) tab.classList.add('active');
  if (section) section.style.display = 'block';

  if (name === 'scan') initScanSection();
  if (name === 'browse') renderEquipmentList();
  window.scrollTo(0, 0);
}

// ── Stats ─────────────────────────────────────────────────────────────────────
async function loadStats() {
  try {
    const list = await API.listEquipment();
    document.getElementById('statEquip').textContent = list.length;
  } catch (_) { /* silent */ }
}

// ── Equipment List ─────────────────────────────────────────────────────────────
async function loadEquipmentList() {
  try {
    _equipmentList = await API.listEquipment();
  } catch (err) {
    console.warn('Could not load equipment list:', err.message);
  }
}

function renderEquipmentList(filter = '') {
  const container = document.getElementById('equipList');
  const filtered = filter
    ? _equipmentList.filter(e =>
        e.name.toLowerCase().includes(filter) ||
        e.id.toLowerCase().includes(filter)
      )
    : _equipmentList;

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">🔍</div>
      <p>${filter ? 'No matching equipment' : 'No equipment found — add some in the Admin panel.'}</p>
    </div>`;
    return;
  }

  container.innerHTML = filtered.map(e => `
    <a class="equip-item" href="equipment.html?id=${encodeURIComponent(e.id)}">
      <div class="equip-icon">⚙️</div>
      <div class="equip-info">
        <div class="equip-name">${e.name}</div>
        <div class="equip-meta">${e.id}${e.location ? ' · ' + e.location : ''}</div>
      </div>
      <span class="equip-arrow">›</span>
    </a>
  `).join('');
}

document.getElementById('browseSearch').addEventListener('input', e => {
  renderEquipmentList(e.target.value.trim().toLowerCase());
});

// ── Search ────────────────────────────────────────────────────────────────────
function doSearch() {
  const raw = document.getElementById('searchInput').value.trim();
  if (!raw) { showAlert('Enter an equipment ID', 'warning'); return; }
  goToEquipment(raw);
}

function goToEquipment(id) {
  window.location.href = `equipment.html?id=${encodeURIComponent(id.trim())}`;
}

// ── QR Scanning ───────────────────────────────────────────────────────────────
function initScanSection() {
  stopScan(); // ensure clean state
}

async function startScan() {
  const video = document.getElementById('video');
  const startBtn = document.getElementById('startScanBtn');
  const stopBtn  = document.getElementById('stopScanBtn');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    video.srcObject = stream;
    await video.play();

    startBtn.style.display = 'none';
    stopBtn.style.display  = 'flex';

    _scanInterval = setInterval(() => _processFrame(video), 150);
  } catch (err) {
    showAlert('Camera access denied — try uploading a QR image instead', 'error');
  }
}

function stopScan() {
  if (_scanInterval) { clearInterval(_scanInterval); _scanInterval = null; }
  const video = document.getElementById('video');
  if (video && video.srcObject) {
    video.srcObject.getTracks().forEach(t => t.stop());
    video.srcObject = null;
  }
  const startBtn = document.getElementById('startScanBtn');
  const stopBtn  = document.getElementById('stopScanBtn');
  if (startBtn) startBtn.style.display = 'flex';
  if (stopBtn)  stopBtn.style.display  = 'none';
}

function _processFrame(video) {
  if (video.readyState !== video.HAVE_ENOUGH_DATA) return;
  const canvas  = document.createElement('canvas');
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
  if (code) {
    stopScan();
    _handleQRResult(code.data);
  }
}

function scanFromFile() {
  const file = document.getElementById('qrFileInput').files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code) _handleQRResult(code.data);
      else showAlert('No QR code found in that image', 'error');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function _handleQRResult(value) {
  // QR codes encode the full URL: https://domain/equipment.html?id=EQ001
  // OR just the equipment ID: EQ001
  try {
    const url = new URL(value);
    const id  = url.searchParams.get('id');
    if (id) { goToEquipment(id); return; }
  } catch (_) { /* not a URL — treat as raw ID */ }
  goToEquipment(value);
}

// ── Utility ───────────────────────────────────────────────────────────────────
function showAlert(message, type = 'info') {
  const el = document.getElementById('alert');
  el.className = `alert show alert-${type}`;
  el.textContent = message;
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => el.classList.remove('show'), 4000);
}

// Clean up camera when leaving the page
window.addEventListener('beforeunload', stopScan);
