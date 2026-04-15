/**
 * admin.js — admin.html logic
 * Password gate → pending approvals → add equipment → stats
 */

// ── State ─────────────────────────────────────────────────────────────────────
let _authed = false;

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('pwdInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') login();
  });
  // Prefill today's date in add-equipment form
  document.getElementById('addRecordDate').value = new Date().toISOString().split('T')[0];
});

// ── Auth ──────────────────────────────────────────────────────────────────────
function login() {
  const pwd = document.getElementById('pwdInput').value;
  if (pwd === CONFIG.ADMIN_PASSWORD) {
    _authed = true;
    document.getElementById('pwdGate').style.display    = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    loadDashboard();
    loadPending();
  } else {
    document.getElementById('pwdError').textContent = '❌ Incorrect password.';
  }
}

function logout() {
  _authed = false;
  document.getElementById('pwdInput').value = '';
  document.getElementById('pwdError').textContent = '';
  document.getElementById('pwdGate').style.display    = 'block';
  document.getElementById('adminPanel').style.display = 'none';
}

function requireAuth() {
  if (!_authed) throw new Error('Not authenticated');
}

// ── Tab Navigation ─────────────────────────────────────────────────────────────
function setAdminTab(name) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-section').forEach(s => s.style.display = 'none');

  const tab = document.querySelector(`.nav-tab[data-tab="${name}"]`);
  const sec = document.getElementById(`asec-${name}`);
  if (tab) tab.classList.add('active');
  if (sec) sec.style.display = 'block';
  window.scrollTo(0, 0);
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const list = await API.listEquipment();
    document.getElementById('statEquipCount').textContent = list.length;
  } catch (_) { /* silent */ }

  try {
    const pending = await API.getPending(CONFIG.ADMIN_PASSWORD);
    const count   = Array.isArray(pending) ? pending.length : 0;
    document.getElementById('statPendingCount').textContent = count;
    document.getElementById('pendingBadge').textContent = count;
    document.getElementById('pendingBadge').style.display = count > 0 ? 'inline-flex' : 'none';
  } catch (_) { /* silent */ }

  document.getElementById('lastUpdated').textContent = new Date().toLocaleString('en-IN');
}

// ── Pending Approvals ─────────────────────────────────────────────────────────
async function loadPending() {
  const container = document.getElementById('pendingList');
  container.innerHTML = '<div class="spinner"></div>';

  try {
    const items = await API.getPending(CONFIG.ADMIN_PASSWORD);

    if (!Array.isArray(items) || items.length === 0) {
      container.innerHTML = `<div class="empty-state">
        <div class="empty-icon">✅</div>
        <p>No pending records — all clear!</p>
      </div>`;
      return;
    }

    container.innerHTML = items.map(item => `
      <div class="pending-item fade-in" id="pending-${item.id}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
          <div>
            <div style="font-weight:700; font-size:0.95rem;">${item.equipmentName} — ${item.task}</div>
            <div style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono); margin-top:2px;">${item.equipmentId}</div>
          </div>
          <span class="badge badge-yellow">Pending</span>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:0.8rem; margin-bottom:10px;">
          <div style="color:var(--text-muted);">Date: <strong style="color:var(--text);">${item.date}</strong></div>
          <div style="color:var(--text-muted);">Tech: <strong style="color:var(--text);">${item.technician}</strong></div>
          <div style="color:var(--text-muted);">Hours: <strong style="color:var(--text);">${item.hours || 0}h</strong></div>
          <div style="color:var(--text-muted);">Status: <strong style="color:var(--text);">${item.status}</strong></div>
        </div>
        ${item.parts ? `<div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">Parts: <strong style="color:var(--text);">${item.parts}</strong></div>` : ''}
        ${item.notes ? `<div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:8px;">${item.notes}</div>` : ''}
        <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:10px;">
          Submitted ${item.submittedAt ? new Date(item.submittedAt).toLocaleString('en-IN') : '—'} by ${item.submittedBy}
        </div>
        <div class="pending-actions">
          <button class="btn btn-success btn-sm" onclick="approveRecord('${item.id}')">✓ Approve</button>
          <button class="btn btn-danger btn-sm"  onclick="rejectRecord('${item.id}')">✕ Reject</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p style="color:var(--red);">Error: ${err.message}</p></div>`;
  }
}

async function approveRecord(id) {
  const el  = document.getElementById(`pending-${id}`);
  const btn = el.querySelector('.btn-success');
  btn.disabled = true; btn.textContent = 'Approving…';

  try {
    await API.approveRecord(id, 'Admin', CONFIG.ADMIN_PASSWORD);
    el.style.opacity = '0.4';
    el.querySelector('.pending-actions').innerHTML = '<span class="badge badge-green">✓ Approved</span>';
    showAlert('Record approved and saved!', 'success');
    loadDashboard();
  } catch (err) {
    showAlert(`Error: ${err.message}`, 'error');
    btn.disabled = false; btn.textContent = '✓ Approve';
  }
}

async function rejectRecord(id) {
  if (!confirm('Reject this record? It will be permanently deleted.')) return;
  const el  = document.getElementById(`pending-${id}`);
  const btn = el.querySelector('.btn-danger');
  btn.disabled = true; btn.textContent = 'Rejecting…';

  try {
    await API.rejectRecord(id, CONFIG.ADMIN_PASSWORD);
    el.style.opacity = '0.4';
    el.querySelector('.pending-actions').innerHTML = '<span class="badge badge-red">✕ Rejected</span>';
    showAlert('Record rejected.', 'warning');
    loadDashboard();
  } catch (err) {
    showAlert(`Error: ${err.message}`, 'error');
    btn.disabled = false; btn.textContent = '✕ Reject';
  }
}

// ── Add Equipment ─────────────────────────────────────────────────────────────
async function addEquipment(e) {
  e.preventDefault();

  const btn = document.getElementById('addEquipBtn');
  btn.disabled = true; btn.textContent = 'Saving…';

  const data = {
    id:          document.getElementById('eqId').value.trim().toUpperCase(),
    name:        document.getElementById('eqName').value.trim(),
    kw:          document.getElementById('eqKW').value || '',
    hp:          document.getElementById('eqHP').value || '',
    rpm:         document.getElementById('eqRPM').value || '',
    frame:       document.getElementById('eqFrame').value.trim(),
    deBearing:   document.getElementById('eqDEBearing').value.trim(),
    ndeBearing:  document.getElementById('eqNDEBearing').value.trim(),
    serial:      document.getElementById('eqSerial').value.trim(),
    location:    document.getElementById('eqLocation').value.trim(),
    status:      'Active',
  };

  try {
    await API.addEquipment(data, CONFIG.ADMIN_PASSWORD);
    showAlert(`✓ Equipment ${data.id} created!`, 'success');
    document.getElementById('addEquipForm').reset();
    loadDashboard();
    // Show QR link
    const qrLink = document.getElementById('newEquipQR');
    qrLink.href = `qr-generator.html?id=${data.id}`;
    qrLink.textContent = `Generate QR code for ${data.id}`;
    qrLink.style.display = 'block';
  } catch (err) {
    showAlert(`Error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '✓ Create Equipment';
  }
}

// ── Add Maintenance Record (Admin Direct) ─────────────────────────────────────
async function addDirectRecord(e) {
  e.preventDefault();

  const btn = document.getElementById('addRecordBtn');
  btn.disabled = true; btn.textContent = 'Saving…';

  const record = {
    equipmentId:   document.getElementById('addRecordEquipId').value.trim().toUpperCase(),
    equipmentName: document.getElementById('addRecordEquipName').value.trim(),
    date:          document.getElementById('addRecordDate').value,
    task:          document.getElementById('addRecordTask').value.trim(),
    status:        document.getElementById('addRecordStatus').value,
    technician:    document.getElementById('addRecordTech').value.trim(),
    hours:         document.getElementById('addRecordHours').value || '0',
    parts:         document.getElementById('addRecordParts').value.trim(),
    notes:         document.getElementById('addRecordNotes').value.trim(),
    nextService:   document.getElementById('addRecordNextService').value,
    submittedBy:   'Admin',
    _adminDirect:  true, // tells GAS to skip Pending and go straight to Records
    pwd:           CONFIG.ADMIN_PASSWORD,
  };

  try {
    await API.submitRecord(record);
    showAlert('✓ Record saved directly to database!', 'success');
    document.getElementById('addRecordForm').reset();
    document.getElementById('addRecordDate').value = new Date().toISOString().split('T')[0];
  } catch (err) {
    showAlert(`Error: ${err.message}`, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '💾 Save Record';
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────
function showAlert(message, type = 'info') {
  const el = document.getElementById('alert');
  el.className = `alert show alert-${type}`;
  el.textContent = message;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => el.classList.remove('show'), 5000);
}
