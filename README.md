# ⚙️ NSL Equipment History — v3.0

**Professional equipment maintenance tracking. QR-scannable. Google Sheets backend. Vercel hosted.**

---

## 📁 Project Structure

```
nsl-equipment/
├── index.html              ← Home: QR scanner + search
├── equipment.html          ← Dynamic equipment page (?id=EQ001)
├── admin.html              ← Admin panel (password protected)
├── qr-generator.html       ← Print QR labels for equipment
├── css/
│   └── styles.css          ← All shared styles
├── js/
│   ├── config.js           ← ⚡ Central config (API URL, password)
│   ├── api.js              ← All backend calls (swap backend here)
│   ├── home.js             ← index.html logic
│   ├── app.js              ← equipment.html logic
│   └── admin.js            ← admin.html logic
├── google-apps-script.js   ← Paste into Google Apps Script
├── vercel.json             ← Vercel deployment config
└── manifest.json           ← PWA manifest
```

---

## 🚀 Step-by-Step Setup

### Step 1 — Set Up Google Sheets

1. Open [Google Sheets](https://sheets.google.com) and create a new spreadsheet
2. Name it: **NSL Equipment Database**
3. That's it — the script will auto-create the sheets on first use

### Step 2 — Deploy Google Apps Script

1. In your spreadsheet: **Extensions → Apps Script**
2. Delete any existing code
3. Copy the entire contents of **`google-apps-script.js`** and paste it
4. Press **Ctrl+S** to save
5. Click **Deploy → New Deployment**
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Click **Deploy**, authorize permissions when prompted
7. **Copy the Web App URL** — it looks like:
   `https://script.google.com/macros/s/AKfyc.../exec`

### Step 3 — Configure the Frontend

Open **`js/config.js`** and update these two lines:

```javascript
API_BASE_URL: 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec',
//                                              ^^^^^^^^^^^^ paste your URL here

APP_BASE_URL: 'https://YOUR-PROJECT.vercel.app',
//                      ^^^^^^^^^^^^ your Vercel domain (fill after Step 4)
```

### Step 4 — Deploy to Vercel

**Option A: GitHub + Vercel (recommended)**

1. Push this project to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import the GitHub repo
4. Leave all settings as default (no build step needed)
5. Click **Deploy**
6. Copy your Vercel URL (e.g. `https://nsl-equipment.vercel.app`)
7. Paste it into `APP_BASE_URL` in `js/config.js` and redeploy

**Option B: Vercel CLI**

```bash
npm i -g vercel
cd nsl-equipment
vercel --prod
```

### Step 5 — Add First Equipment (Admin Panel)

1. Open `https://your-domain.vercel.app/admin.html`
2. Password: `NSL2024` (change in `js/config.js`)
3. Go to **Add Equipment** tab
4. Fill in the details and save

### Step 6 — Generate QR Codes

1. Go to `https://your-domain.vercel.app/qr-generator.html`
2. Enter equipment IDs (or paste a bulk list)
3. Print and stick on equipment!

---

## 🔄 How It Works

```
Technician scans QR code
        ↓
Opens equipment.html?id=EQ001
        ↓
   Fetches from Google Sheets API
        ↓
   Views history + specs
        ↓
   Submits maintenance record
        ↓
   → Goes to "Pending" sheet
        ↓
Admin opens admin.html → Pending tab
        ↓
   Approve ✓ → Saved to "Records" sheet
   Reject  ✕ → Deleted
```

---

## ⚡ How to Switch Backends Later

The entire API is isolated in **`js/api.js`**.

To move to Firebase, Supabase, or a custom server:
1. Change `API_BASE_URL` in `js/config.js`
2. Update the functions inside `js/api.js` to match the new endpoint format
3. **Nothing else changes** — all HTML files and other JS files stay identical

---

## 🔐 Credentials

| Item | Default | Where to Change |
|------|---------|-----------------|
| Admin password | `NSL2024` | `js/config.js` → `ADMIN_PASSWORD` |
| API URL | (your GAS URL) | `js/config.js` → `API_BASE_URL` |
| App URL | (your Vercel URL) | `js/config.js` → `APP_BASE_URL` |

> ⚠️ **Change the admin password** before sharing the app publicly!

---

## 📊 Google Sheets Structure

The script auto-creates 3 sheets:

**Equipment** (master list)
| id | name | kw | hp | rpm | frame | deBearing | ndeBearing | serial | location | status | createdAt |

**Records** (approved maintenance history)
| id | equipmentId | equipmentName | date | task | status | technician | hours | parts | notes | nextService | submittedAt | submittedBy | approvedAt | approvedBy |

**Pending** (awaiting admin approval)
Same columns as Records.

---

## 🛠 Troubleshooting

**"Equipment not found" error**
→ Check that the Equipment ID in the QR URL exactly matches the ID in your Sheets (case-sensitive, e.g. `EQ001`)

**API calls failing / CORS errors**
→ Make sure the Apps Script is deployed with "Who has access: Anyone"
→ After any code change in GAS, create a **New Deployment** (don't just save — you must re-deploy)

**QR codes not scanning**
→ Allow camera permission in browser settings
→ Make sure the QR label URL matches your current Vercel domain
→ Try the "Upload QR Image" option as a fallback

**Admin password not working**
→ Default is `NSL2024`
→ Check `js/config.js` — the password in config.js must match `ADMIN_PASSWORD` in google-apps-script.js

---

## 📈 Roadmap

- **Phase 1 (now):** Google Sheets + Apps Script backend
- **Phase 2:** Switch to Firebase Realtime DB for instant sync
- **Phase 3:** Email notifications on new records
- **Phase 4:** Photo upload per maintenance record
- **Phase 5:** Analytics dashboard + cost tracking

---

**Developer:** Akshay B Patil  
**Email:** akshaybpatil575@gmail.com  
**Org:** NSL Unit 2 — MRN Group
