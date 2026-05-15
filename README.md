# MLWC - Mobile Legends World Championship

Website turnamen Mobile Legends modern, full responsive, **pure HTML/CSS/JS** (tanpa framework, tanpa backend, tanpa database). Semua data disimpan di **localStorage**.

## 📁 Struktur File

```
ml-tournament/
├── index.html      # Public view (landing, jadwal, klasemen, bracket, dll)
├── admin.html      # Admin dashboard
├── style.css       # Design system + komponen UI
├── admin.css       # Style khusus admin (sidebar, modal, login)
├── script.js       # Engine: storage, standings, bracket, render publik
└── admin.js        # Login, CRUD, input skor, simulasi, export/import
```

## 🚀 Cara Menjalankan

Buka `index.html` langsung di browser. Semua jalan offline.

## 🔐 Login Admin

- URL: `admin.html`
- Username: `admin`
- Password: `admin123`

## 🏆 Format Turnamen

- 32 tim → 8 grup (A–H, 4 tim/grup)
- Grup: Round Robin **BO1** (6 match per grup)
- 2 tim teratas tiap grup lolos ke playoff
- Playoff: **16 Besar → QF → SF → (Bronze + Final), semua BO3**

## 💾 Contoh Struktur Data Local Storage

Key: `mlwc_data`

```json
{
  "teams": [
    { "id":"t1", "name":"ONIC", "tag":"Esports", "region":"ID", "group":"A", "logoColor":"linear-gradient(...)" }
  ],
  "matches": [
    { "id":"m1", "group":"A", "teamA":"t1", "teamB":"t2",
      "scoreA":1, "scoreB":0, "played":true, "date":"2026-..." }
  ],
  "bracket": {
    "r16":   [{ "id":"r16-1","teamA":"t1","teamB":"t6","scoreA":2,"scoreB":1,"winner":"t1" }],
    "qf":    [...],
    "sf":    [...],
    "bronze":[...],
    "final": [...]
  },
  "grandFinalDate": "2026-...",
  "meta": { "createdAt":"..." }
}
```

## 🔧 Fungsi Penting

| Fungsi | File | Kegunaan |
|---|---|---|
| `loadData() / saveData()` | script.js | Sinkronisasi localStorage |
| `generateInitialData()` | script.js | Seed 32 tim dummy + jadwal |
| `generateGroupSchedule()` | script.js | Round-robin BO1 untuk 8 grup |
| `computeStandings()` | script.js | Hitung W/L/Pts tiap grup + tie-breaker |
| `buildBracketFromStandings()` | script.js | Cross-seed top-2 grup ke 16 besar |
| `advanceBracket()` | script.js | Auto-promote winner BO3 ke round berikutnya |
| `simulateAll()` | admin.js | Simulasi acak seluruh turnamen |
| `exportData() / importData()` | admin.js | Backup ke JSON |

## 🎨 Tema Visual

- Dark gaming UI (default)
- Neon **blue / purple / gold** accents
- Glassmorphism cards
- Gradient esports premium (MPL/M-Series style)
- Smooth scroll + reveal animation
- Toast notification, modal popup, hover glow

## ✨ Fitur

**Public:**
- Hero + countdown grand final
- Jadwal dgn search & filter (grup/status)
- Klasemen 8 grup (highlight 2 teratas)
- Hasil pertandingan
- Bracket playoff interaktif (horizontal scroll di mobile)
- Daftar tim + search
- Statistik global + Top 10

**Admin:**
- Login dummy (sessionStorage)
- Sidebar responsive + hamburger
- CRUD tim (modal form)
- Generate ulang jadwal grup
- Input skor BO1 (validasi 1-0/0-1)
- Generate bracket otomatis dari standings
- Input skor BO3 via modal (validasi first-to-2)
- Auto-advance pemenang
- Simulasi cepat 1-klik
- Export / Import JSON
- Reset seluruh data
