/**
 * app.js — equipment.html logic
 * Reads ?id= from URL → fetches data → renders details & history → handles record submission
 */

// ── State ────────────────────────────────────────────────────────────────────
let _equipmentId   = null;
let _equipmentData = null;

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  _equipmentId = params.get('id');

  if (!_equipmentId) {
    renderError('No equipment ID provided in the URL.');
    return;
  }

  // Pre-fill the record form with this equipment's ID
  document.getElementById('recEquipId').value   = _equipmentId;
  document.getElementById('recDate').value       = new Date().toISOString().split('T')[0];

  await loadEquipment();
});

// ── Load Equipment ────────────────────────────────────────────────────────────
async function loadEquipment() {
  renderLoading(true);

  try {
    const result = await API.getEquipment(_equipmentId);
    _equipmentData = result.equipment;
    renderHero(result.equipment);
    renderDetails(result.equipment);
    renderHistory(result.records);
    // Pre-fill equipment name in form
    document.getElementById('recEquipName').value = result.equipment.name || '';
  } catch (err) {
    renderError(`Could not load equipment "${_equipmentId}": ${err.message}`);
  } finally {
    renderLoading(false);
  }
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderLoading(show) {
  document.getElementById('loadingState').style.display = show ? 'block' : 'none';
  document.getElementById('mainContent').style.display  = show ? 'none'  : 'block';
}

function renderError(message) {
  renderLoading(false);
  document.getElementById('errorState').style.display = 'block';
  document.getElementById('errorMsg').textContent = message;
  document.getElementById('mainContent').style.display = 'none';
}

function renderHero(eq) {
  document.title = `${eq.name} — NSL Equipment`;
  document.getElementById('eqId').textContent   = eq.id;
  document.getElementById('eqName').textContent = eq.name;

  const specs = [];
  if (eq.kw)    specs.push(`${eq.kw} KW`);
  if (eq.hp)    specs.push(`${eq.hp} HP`);
  if (eq.rpm)   specs.push(`${eq.rpm} RPM`);
  if (eq.frame) specs.push(`Frame: ${eq.frame}`);

  document.getElementById('eqSpecs').innerHTML = specs
    .map(s => `<span class="spec-chip">${s}</span>`)
    .join('');
}

function renderDetails(eq) {
  const fields = [
    { label: 'Equipment ID',   value: eq.id },
    { label: 'Power',          value: [eq.kw && `${eq.kw} KW`, eq.hp && `${eq.hp} HP`].filter(Boolean).join(' / ') || '—' },
    { label: 'RPM',            value: eq.rpm    || '—' },
    { label: 'Frame Size',     value: eq.frame  || '—' },
    { label: 'DE Bearing',     value: eq.deBearing  || '—' },
    { label: 'NDE Bearing',    value: eq.ndeBearing || '—' },
    { label: 'Serial No.',     value: eq.serial   || '—' },
    { label: 'Location',       value: eq.location || '—' },
  ];

  document.getElementById('detailGrid').innerHTML = fields.map(f => `
    <div class="detail-field">
      <div class="lbl">${f.label}</div>
      <div class="val">${f.value}</div>
    </div>
  `).join('');
}

function renderHistory(records) {
  const container = document.getElementById('historyList');
  const countEl   = document.getElementById('historyCount');

  if (!records || records.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📋</div>
      <p>No approved maintenance records yet.<br>Add the first record below.</p>
    </div>`;
    countEl.textContent = '0 records';
    return;
  }

  countEl.textContent = `${records.length} record${records.length !== 1 ? 's' : ''}`;

  container.innerHTML = records.map(r => {
    const statusClass = {
      'Completed': 'status-completed',
      'Pending':   'status-pending',
      'Failed':    'status-failed',
      'Partial':   'status-partial',
    }[r.status] || '';

    const badgeClass = {
      'Completed': 'badge-green',
      'Pending':   'badge-yellow',
      'Failed':    'badge-red',
      'Partial':   'badge-blue',
    }[r.status] || 'badge-orange';

    return `
    <div class="record-item ${statusClass} fade-in">
      <div class="record-task">${r.task}</div>
      <div class="record-meta">
        <span class="record-field"><strong>${formatDate(r.date)}</strong></span>
        <span class="record-field">Tech: <strong>${r.technician}</strong></span>
        ${r.hours ? `<span class="record-field"><strong>${r.hours}h</strong></span>` : ''}
        <span class="badge ${badgeClass}">${r.status}</span>
      </div>
      ${r.parts ? `<div class="record-field" style="margin-top:6px;">Parts: <strong>${r.parts}</strong></div>` : ''}
      ${r.notes ? `<div class="record-field" style="margin-top:4px;color:var(--text-muted);">${r.notes}</div>` : ''}
      ${r.nextService ? `<div class="record-field" style="margin-top:4px;">Next service: <strong>${formatDate(r.nextService)}</strong></div>` : ''}
      <div class="record-field" style="margin-top:6px;font-size:0.7rem;opacity:0.5;">
        Approved ${formatDate(r.approvedAt)} by ${r.approvedBy}
      </div>
    </div>`;
  }).join('');
}

// ── Record Submission ─────────────────────────────────────────────────────────
async function submitRecord(e) {
  e.preventDefault();

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting…';

  const record = {
    equipmentId:   _equipmentId,
    equipmentName: document.getElementById('recEquipName').value.trim(),
    date:          document.getElementById('recDate').value,
    task:          document.getElementById('recTask').value.trim(),
    status:        document.getElementById('recStatus').value,
    technician:    document.getElementById('recTechnician').value.trim(),
    hours:         document.getElementById('recHours').value || '0',
    parts:         document.getElementById('recParts').value.trim(),
    notes:         document.getElementById('recNotes').value.trim(),
    nextService:   document.getElementById('recNextService').value,
    submittedBy:   document.getElementById('recTechnician').value.trim(),
  };

  try {
    await API.submitRecord(record);
    showAlert('✓ Record submitted for admin approval!', 'success');
    document.getElementById('addRecordForm').reset();
    document.getElementById('recEquipId').value   = _equipmentId;
    document.getElementById('recEquipName').value = _equipmentData?.name || '';
    document.getElementById('recDate').value       = new Date().toISOString().split('T')[0];
    // Collapse the form
    toggleForm(false);
  } catch (err) {
    showAlert(`Error: ${err.message}`, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '📤 Submit for Approval';
  }
}

// ── UI Helpers ────────────────────────────────────────────────────────────────
function toggleForm(show) {
  const form = document.getElementById('formWrapper');
  const btn  = document.getElementById('toggleFormBtn');
  if (show === undefined) show = form.style.display === 'none';
  form.style.display = show ? 'block' : 'none';
  btn.textContent = show ? '✕ Cancel' : '➕ Add Maintenance Record';
  if (show) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showAlert(message, type = 'info') {
  const el = document.getElementById('alert');
  el.className = `alert show alert-${type}`;
  el.textContent = message;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => el.classList.remove('show'), 5000);
}

// ── Utilities ──────────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch (_) { return dateStr; }
}
