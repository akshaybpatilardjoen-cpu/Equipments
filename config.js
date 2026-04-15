/**
 * config.js — NSL Equipment History v3.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all configuration.
 *
 * ⚡ TO SWITCH BACKENDS LATER (Firebase, Supabase, custom API):
 *    1. Change API_BASE_URL to your new backend URL
 *    2. Update api.js to match the new endpoint format
 *    3. Nothing else needs to change
 * ─────────────────────────────────────────────────────────────────────────────
 */

const CONFIG = Object.freeze({

  // ── Backend ──────────────────────────────────────────────────────────────
  // Paste your Google Apps Script Web App URL here after deployment.
  // Format: https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
  API_BASE_URL: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',

  // ── App Identity ──────────────────────────────────────────────────────────
  APP_NAME:    'NSL Equipment History',
  ORG_NAME:    'MRN Group — NSL Unit 2',
  APP_VERSION: '3.0',

  // ── Admin ─────────────────────────────────────────────────────────────────
  // ⚠️  Change this before deploying to production!
  ADMIN_PASSWORD: 'NSL2024',

  // ── Performance ───────────────────────────────────────────────────────────
  // How long (ms) to cache equipment data in memory. 5 minutes = 300000.
  // Prevents hammering the API when the user navigates back to the same page.
  CACHE_TTL_MS: 5 * 60 * 1000,

  // ── Hosting ───────────────────────────────────────────────────────────────
  // Base URL of this app (used for building QR code URLs).
  // Replace with your Vercel domain after deploy.
  APP_BASE_URL: 'https://YOUR-PROJECT.vercel.app',

});
