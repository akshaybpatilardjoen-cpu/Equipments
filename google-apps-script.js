/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NSL Equipment History — Google Apps Script Backend
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * SETUP INSTRUCTIONS:
 *  1. Open your Google Spreadsheet
 *  2. Go to Extensions → Apps Script
 *  3. Delete any existing code and paste this entire file
 *  4. Save (Ctrl+S)
 *  5. Click Deploy → New Deployment
 *     - Type: Web App
 *     - Execute as: Me
 *     - Who has access: Anyone
 *  6. Copy the Web App URL
 *  7. Paste it into js/config.js as API_BASE_URL
 *
 * SHEET STRUCTURE (auto-created on first use):
 *  - "Equipment"  → master list of all equipment
 *  - "Records"    → approved maintenance records
 *  - "Pending"    → records awaiting admin approval
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── Sheet Names ──────────────────────────────────────────────────────────────
const SHEETS = {
  EQUIPMENT: 'Equipment',
  RECORDS:   'Records',
  PENDING:   'Pending',
};

// ── Admin Password (must match CONFIG.ADMIN_PASSWORD in config.js) ───────────
const ADMIN_PASSWORD = 'NSL2024';

// ── Column Definitions (order matters for appendRow) ─────────────────────────
const COLS = {
  EQUIPMENT: ['id','name','kw','hp','rpm','frame','deBearing','ndeBearing','serial','location','status','createdAt'],
  RECORDS:   ['id','equipmentId','equipmentName','date','task','status','technician','hours','parts','notes','nextService','submittedAt','submittedBy','approvedAt','approvedBy'],
  PENDING:   ['id','equipmentId','equipmentName','date','task','status','technician','hours','parts','notes','nextService','submittedAt','submittedBy','_adminDirect'],
};

// ════════════════════════════════════════════════════════════════════════════
//  Entry Points
// ════════════════════════════════════════════════════════════════════════════

function doGet(e) {
  const p      = e.parameter || {};
  const action = p.action || 'ping';

  let result;

  try {
    switch (action) {

      // ── Public (no auth needed) ──────────────────────────────────────────
      case 'ping':
        result = { status: 'ok', message: 'NSL Equipment API running', ts: new Date().toISOString() };
        break;

      case 'getEquipment':
        result = getEquipmentById(p.id);
        break;

      case 'list':
        result = listEquipment();
        break;

      // ── Write operations (encoded as GET for CORS compatibility) ─────────
      case 'submitRecord':
        result = submitRecord(parseData(p.data), p);
        break;

      // ── Admin-only ────────────────────────────────────────────────────────
      case 'getPending':
        requireAdmin(p.pwd);
        result = getPendingRecords();
        break;

      case 'approveRecord':
        requireAdmin(p.pwd);
        result = approveRecord(p.id, p.by || 'Admin');
        break;

      case 'rejectRecord':
        requireAdmin(p.pwd);
        result = rejectRecord(p.id);
        break;

      case 'addEquipment':
        requireAdmin(p.pwd);
        result = addEquipment(parseData(p.data));
        break;

      case 'updateEquipment':
        requireAdmin(p.pwd);
        result = updateEquipment(p.id, parseData(p.data));
        break;

      default:
        result = { error: `Unknown action: ${action}` };
    }
  } catch (err) {
    result = { error: err.message };
  }

  return jsonOut(result);
}

// ════════════════════════════════════════════════════════════════════════════
//  Auth
// ════════════════════════════════════════════════════════════════════════════

function requireAdmin(pwd) {
  if (pwd !== ADMIN_PASSWORD) throw new Error('Unauthorized');
}

// ════════════════════════════════════════════════════════════════════════════
//  Equipment CRUD
// ════════════════════════════════════════════════════════════════════════════

function getEquipmentById(id) {
  if (!id) return { error: 'id parameter is required' };

  const equipment = sheetToObjects(SHEETS.EQUIPMENT);
  const equip     = equipment.find(e => e.id === id);

  if (!equip) return { error: `Equipment "${id}" not found` };

  const records = sheetToObjects(SHEETS.RECORDS)
    .filter(r => r.equipmentId === id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return { equipment: equip, records, ts: new Date().toISOString() };
}

function listEquipment() {
  const rows = sheetToObjects(SHEETS.EQUIPMENT);
  return rows.map(e => ({ id: e.id, name: e.name, location: e.location || '' }));
}

function addEquipment(data) {
  if (!data.id || !data.name) return { error: 'id and name are required' };

  data.id = String(data.id).toUpperCase();

  const existing = sheetToObjects(SHEETS.EQUIPMENT);
  if (existing.find(e => e.id === data.id)) {
    return { error: `Equipment "${data.id}" already exists` };
  }

  data.status    = data.status    || 'Active';
  data.createdAt = data.createdAt || new Date().toISOString();

  ensureSheet(SHEETS.EQUIPMENT, COLS.EQUIPMENT);
  appendRow(SHEETS.EQUIPMENT, COLS.EQUIPMENT, data);

  return { success: true, id: data.id };
}

function updateEquipment(id, updates) {
  if (!id) return { error: 'id is required' };

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.EQUIPMENT);
  if (!sheet) return { error: 'Equipment sheet not found' };

  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol   = headers.indexOf('id');

  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === id) {
      Object.entries(updates).forEach(([key, val]) => {
        const col = headers.indexOf(key);
        if (col >= 0) sheet.getRange(i + 1, col + 1).setValue(val);
      });
      return { success: true };
    }
  }
  return { error: `Equipment "${id}" not found` };
}

// ════════════════════════════════════════════════════════════════════════════
//  Records
// ════════════════════════════════════════════════════════════════════════════

function submitRecord(data, params) {
  if (!data) return { error: 'data parameter is required' };
  if (!data.equipmentId) return { error: 'equipmentId is required' };

  data.id          = 'REC-' + Date.now();
  data.submittedAt = new Date().toISOString();

  // Admin direct save: bypass pending queue
  if (data._adminDirect && data.pwd === ADMIN_PASSWORD) {
    data.status     = data.status || 'Completed';
    data.approvedAt = new Date().toISOString();
    data.approvedBy = 'Admin';
    ensureSheet(SHEETS.RECORDS, COLS.RECORDS);
    appendRow(SHEETS.RECORDS, COLS.RECORDS, data);
    return { success: true, id: data.id, savedTo: 'Records' };
  }

  // Normal submission: goes to Pending
  data.status = 'Pending';
  delete data._adminDirect;
  delete data.pwd;
  ensureSheet(SHEETS.PENDING, COLS.PENDING);
  appendRow(SHEETS.PENDING, COLS.PENDING, data);
  return { success: true, id: data.id, savedTo: 'Pending' };
}

function getPendingRecords() {
  return sheetToObjects(SHEETS.PENDING);
}

function approveRecord(recordId, approvedBy) {
  if (!recordId) return { error: 'id is required' };

  const pending = sheetToObjects(SHEETS.PENDING);
  const record  = pending.find(r => r.id === recordId);

  if (!record) return { error: `Pending record "${recordId}" not found` };

  record.status     = 'Completed'; // or preserve original status
  record.approvedAt = new Date().toISOString();
  record.approvedBy = approvedBy || 'Admin';

  ensureSheet(SHEETS.RECORDS, COLS.RECORDS);
  appendRow(SHEETS.RECORDS, COLS.RECORDS, record);
  deleteRowById(SHEETS.PENDING, recordId);

  return { success: true };
}

function rejectRecord(recordId) {
  if (!recordId) return { error: 'id is required' };
  const deleted = deleteRowById(SHEETS.PENDING, recordId);
  return { success: deleted, deleted };
}

// ════════════════════════════════════════════════════════════════════════════
//  Sheet Helpers
// ════════════════════════════════════════════════════════════════════════════

/** Convert a sheet to an array of objects using row 1 as headers. */
function sheetToObjects(sheetName) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0];
  return data.slice(1)
    .filter(row => row.some(cell => cell !== '' && cell !== null))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] === null ? '' : String(row[i]); });
      return obj;
    });
}

/** Append a row to a sheet using given column order. */
function appendRow(sheetName, columns, obj) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);
  const row = columns.map(col => obj[col] !== undefined ? obj[col] : '');
  sheet.appendRow(row);
}

/** Create sheet with header row if it doesn't exist or is empty. */
function ensureSheet(sheetName, columns) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let sheet   = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(columns);
    // Style the header row
    const headerRange = sheet.getRange(1, 1, 1, columns.length);
    headerRange.setBackground('#FF6B35').setFontColor('#ffffff').setFontWeight('bold');
    sheet.setFrozenRows(1);
    return;
  }

  // Sheet exists but might be empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(columns);
    const headerRange = sheet.getRange(1, 1, 1, columns.length);
    headerRange.setBackground('#FF6B35').setFontColor('#ffffff').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

/** Delete a row by the value in its "id" column. Returns true if found+deleted. */
function deleteRowById(sheetName, id) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return false;

  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol   = headers.indexOf('id');
  if (idCol < 0) return false;

  // Iterate backwards to avoid row-shift issues
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][idCol] === id) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

/** Parse JSON safely from a string parameter. */
function parseData(dataStr) {
  if (!dataStr) return {};
  try { return JSON.parse(dataStr); }
  catch (_) { return {}; }
}

/** Return a CORS-friendly JSON response. */
function jsonOut(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
