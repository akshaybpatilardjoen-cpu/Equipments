/**
 * api.js — NSL Equipment History v3.0
 * ─────────────────────────────────────────────────────────────────────────────
 * All backend communication is isolated in this file.
 *
 * CURRENT BACKEND: Google Apps Script (Google Sheets as database)
 *
 * TO SWITCH TO FIREBASE / SUPABASE / CUSTOM API LATER:
 *   • Only modify the functions in this file.
 *   • All HTML and app.js / admin.js code stays identical.
 *   • The public API signature (function names + return shape) never changes.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── In-Memory Cache ─────────────────────────────────────────────────────────
// Prevents repeat API calls for the same equipment within the TTL window.
const _cache = {};

function _cacheGet(key) {
  const item = _cache[key];
  if (!item) return null;
  if (Date.now() - item.ts > CONFIG.CACHE_TTL_MS) { delete _cache[key]; return null; }
  return item.data;
}

function _cacheSet(key, data) {
  _cache[key] = { data, ts: Date.now() };
}

function _cacheClear(keyPrefix) {
  Object.keys(_cache).forEach(k => { if (k.startsWith(keyPrefix)) delete _cache[k]; });
}

// ── Core Request Helper ──────────────────────────────────────────────────────
// Google Apps Script only supports GET with JSONP/plain JSON.
// All operations (reads AND writes) are encoded as GET query parameters.
// This avoids CORS preflight issues entirely.

async function _request(params) {
  const url = new URL(CONFIG.API_BASE_URL);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.error) throw new Error(data.error);

  return data;
}

// ── Public API ───────────────────────────────────────────────────────────────

const API = {

  /**
   * Check if the API is reachable.
   * @returns {Promise<{status: string}>}
   */
  async ping() {
    return _request({ action: 'ping' });
  },

  /**
   * Fetch one equipment record + its full maintenance history by ID.
   * Result is cached for CONFIG.CACHE_TTL_MS milliseconds.
   *
   * @param {string} id - Equipment ID, e.g. "EQ001"
   * @returns {Promise<{ equipment: object, records: object[] }>}
   */
  async getEquipment(id) {
    const key = `eq:${id}`;
    const cached = _cacheGet(key);
    if (cached) return cached;

    const data = await _request({ action: 'getEquipment', id });
    _cacheSet(key, data);
    return data;
  },

  /**
   * Fetch a lightweight list of all equipment (id + name only).
   * Used for the search / browse list on index.html.
   *
   * @returns {Promise<Array<{id: string, name: string, location: string}>>}
   */
  async listEquipment() {
    const cached = _cacheGet('list');
    if (cached) return cached;

    const data = await _request({ action: 'list' });
    _cacheSet('list', data);
    return data;
  },

  /**
   * Submit a new maintenance record for admin approval.
   * Goes to the "Pending" sheet — not saved directly.
   *
   * @param {object} record - Form data from the technician
   * @returns {Promise<{success: boolean, id: string}>}
   */
  async submitRecord(record) {
    // Encode the record as a JSON string in a single URL param
    const data = await _request({
      action: 'submitRecord',
      data:   JSON.stringify(record),
    });
    // Invalidate equipment cache so refreshed history shows correctly
    _cacheClear(`eq:${record.equipmentId}`);
    return data;
  },

  /**
   * [ADMIN] Fetch all pending approval records.
   *
   * @param {string} password - Admin password (validated server-side)
   * @returns {Promise<object[]>}
   */
  async getPending(password) {
    return _request({ action: 'getPending', pwd: password });
  },

  /**
   * [ADMIN] Approve a pending record — moves it to the Records sheet.
   *
   * @param {string} recordId
   * @param {string} approvedBy
   * @param {string} password
   */
  async approveRecord(recordId, approvedBy, password) {
    const data = await _request({ action: 'approveRecord', id: recordId, by: approvedBy, pwd: password });
    _cacheClear('eq:'); // invalidate all equipment caches
    return data;
  },

  /**
   * [ADMIN] Reject and delete a pending record.
   *
   * @param {string} recordId
   * @param {string} password
   */
  async rejectRecord(recordId, password) {
    return _request({ action: 'rejectRecord', id: recordId, pwd: password });
  },

  /**
   * [ADMIN] Add a new piece of equipment to the Equipment sheet.
   *
   * @param {object} equipment
   * @param {string} password
   */
  async addEquipment(equipment, password) {
    const data = await _request({
      action: 'addEquipment',
      data:   JSON.stringify(equipment),
      pwd:    password,
    });
    _cacheClear('list'); // invalidate list cache
    return data;
  },

  /**
   * [ADMIN] Update equipment details.
   * The edit is saved immediately (admin-only action, no pending queue).
   *
   * @param {string} id
   * @param {object} updates
   * @param {string} password
   */
  async updateEquipment(id, updates, password) {
    const data = await _request({
      action: 'updateEquipment',
      id,
      data:   JSON.stringify(updates),
      pwd:    password,
    });
    _cacheClear(`eq:${id}`);
    _cacheClear('list');
    return data;
  },

};
