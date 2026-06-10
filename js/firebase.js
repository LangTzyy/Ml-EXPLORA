/* ============================================================
   firebase.js  —  EXPLORA Tournament Firebase Layer
   Menggantikan semua localStorage dengan Firestore.

   SETUP:
   1. Ganti nilai firebaseConfig di bawah dengan config project kamu
      (Firebase Console → Project Settings → Your apps → SDK setup)
   2. Pastikan Firestore sudah aktif di Firebase Console
   3. Pasang Firestore Security Rules (lihat bagian bawah file ini)
   4. Tambahkan tag <script> di HTML SEBELUM script.js & admin.js:
        <script src="./js/firebase.js"></script>
   ============================================================ */

// ─── 1. KONFIGURASI — GANTI DENGAN MILIK KAMU ───────────────

// Import the functions you need from the SDKs you need
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBlhtakjB_08UrMUJGfl_qLug7r78Wb3ik",
  authDomain: "mlbb-explora.firebaseapp.com",
  projectId: "mlbb-explora",
  storageBucket: "mlbb-explora.firebasestorage.app",
  messagingSenderId: "528734746217",
  appId: "1:528734746217:web:53e46ef66beb99af60d4f8"
};

// Initialize Firebase

// ─── 2. INISIALISASI FIREBASE ────────────────────────────────
// Menggunakan Firebase v9 compat (CDN) agar tidak perlu bundler
// Tambahkan di HTML (sebelum tag <script src="firebase.js">):
//   <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
//   <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>

if (typeof firebase === "undefined") {
  console.error(
    "[Firebase] SDK belum dimuat! Pastikan script Firebase CDN ada di HTML sebelum firebase.js"
  );
}

let _app, _db, _auth;

try {
  _app = firebase.apps.length
    ? firebase.app()
    : firebase.initializeApp(firebaseConfig);
  _db = firebase.firestore();
  _auth = firebase.auth();
} catch (e) {
  console.error("[Firebase] Gagal inisialisasi:", e);
}

// Helper akses db dari file lain
function getDB() {
  return _db;
}

// Helper akses auth dari file lain
function getAuth() {
  return _auth;
}

// ─── 3. KONSTANTA DOKUMEN FIRESTORE ─────────────────────────
const FS_COL          = "tournament";   // nama collection
const FS_MAIN_DOC     = "main";         // doc: teams, matches, bracket, timeline
const FS_SETTINGS_DOC = "settings";     // doc: tournamentName, logo, maxTeamsPerGroup
const FS_CREDS_DOC    = "credentials";  // doc: user, passHash
const FS_GROUP_ADMINS = "groupAdmins";  // doc: accounts array (admin per grup)

// ─── 4. SHA-256 HELPER ──────────────────────────────────────
/**
 * Hash string dengan SHA-256 menggunakan Web Crypto API.
 * Mengembalikan Promise<string> hex.
 */
async function sha256(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── 5. DATA UTAMA (teams, matches, bracket, timeline) ───────

/**
 * Ambil data utama dari Firestore.
 * Async — gunakan: const data = await loadDataAsync();
 */
async function loadDataAsync() {
  try {
    const doc = await _db.collection(FS_COL).doc(FS_MAIN_DOC).get();
    if (doc.exists) {
      const parsed = doc.data();
      // Pastikan timeline ada
      if (!parsed.timeline) {
        parsed.timeline = DEFAULT_TIMELINE.map((t) => ({ ...t }));
        await saveDataAsync(parsed);
      }
      return parsed;
    }
    // Dokumen belum ada → buat data awal
    const initial = generateInitialData();
    await saveDataAsync(initial);
    return initial;
  } catch (e) {
    console.error("[Firestore] loadDataAsync error:", e);
    // Fallback ke data kosong agar UI tidak crash
    return generateInitialData();
  }
}

/**
 * Simpan data utama ke Firestore.
 * Async — gunakan: await saveDataAsync(data);
 */
async function saveDataAsync(data) {
  try {
    await _db.collection(FS_COL).doc(FS_MAIN_DOC).set(data);
  } catch (e) {
    console.error("[Firestore] saveDataAsync error:", e);
    throw e; // lempar ulang agar caller bisa handle
  }
}

// ─── 6. SETTINGS ────────────────────────────────────────────

async function getSettingsAsync() {
  try {
    const doc = await _db.collection(FS_COL).doc(FS_SETTINGS_DOC).get();
    if (doc.exists) return doc.data();
  } catch (e) {
    console.error("[Firestore] getSettingsAsync error:", e);
  }
  return { tournamentName: "EXPLORA", logoDataUrl: "", maxTeamsPerGroup: 4 };
}

async function saveSettingsAsync(settings) {
  try {
    await _db.collection(FS_COL).doc(FS_SETTINGS_DOC).set(settings);
  } catch (e) {
    console.error("[Firestore] saveSettingsAsync error:", e);
    throw e;
  }
}

// ─── 7. CREDENTIALS (SHA-256) ───────────────────────────────

/**
 * Ambil credentials dari Firestore.
 * Mengembalikan { user, passHash }.
 * Jika belum ada, buat default: admin / hash("admin123")
 */
async function getAdminCredentialsAsync() {
  try {
    const doc = await _db.collection(FS_COL).doc(FS_CREDS_DOC).get();
    if (doc.exists) return doc.data();
  } catch (e) {
    console.error("[Firestore] getAdminCredentialsAsync error:", e);
  }
  // Default credentials pertama kali
  const defaultHash = await sha256("admin123");
  return { user: "admin", passHash: defaultHash };
}

/**
 * Simpan credentials baru.
 * Pass `plainPass` → otomatis di-hash sebelum disimpan.
 */
async function saveAdminCredentialsAsync(user, plainPass) {
  try {
    const passHash = await sha256(plainPass);
    await _db.collection(FS_COL).doc(FS_CREDS_DOC).set({ user, passHash });
  } catch (e) {
    console.error("[Firestore] saveAdminCredentialsAsync error:", e);
    throw e;
  }
}

/**
 * Verifikasi login: hash input lalu bandingkan dengan yang tersimpan.
 * Mengembalikan Promise<boolean>.
 */
async function verifyAdminLogin(inputUser, inputPass) {
  const creds = await getAdminCredentialsAsync();
  const inputHash = await sha256(inputPass);
  const usernameMatch = inputUser === creds.user && inputHash === creds.passHash;
  if (!usernameMatch) return false;
  // Login ke Firebase Auth jika ada email terdaftar
  if (creds.email) {
    try {
      const result = await _auth.signInWithEmailAndPassword(creds.email, inputPass);
      console.log("[Auth] Login berhasil:", result.user.email);
    } catch (e) {
      console.error("[Auth] Firebase Auth login gagal:", e.code, e.message);
    }
  }
  return true;
}

async function signOutAdmin() {
  try {
    await _auth.signOut();
  } catch (e) {
    console.warn("[Auth] signOut error:", e.message);
  }
}

function onAdminAuthChange(callback) {
  return _auth.onAuthStateChanged(callback);
}


// ─── 8b. GROUP ADMINS (admin per grup) ───────────────────────

/**
 * Ambil semua akun admin grup dari Firestore.
 * Mengembalikan Promise<Array>
 */
async function getGroupAdminsAsync() {
  try {
    const doc = await _db.collection(FS_COL).doc(FS_GROUP_ADMINS).get();
    if (doc.exists) return doc.data().accounts || [];
  } catch (e) {
    console.error("[Firestore] getGroupAdminsAsync error:", e);
  }
  return [];
}

async function saveGroupAdminsAsync(accounts) {
  try {
    await _db.collection(FS_COL).doc(FS_GROUP_ADMINS).set({ accounts });
  } catch (e) {
    console.error("[Firestore] saveGroupAdminsAsync error:", e);
    throw e;
  }
}

async function addGroupAdminAsync(username, plainPass, role, group) {
  const accounts = await getGroupAdminsAsync();
  const passHash = await sha256(plainPass);
  const newAccount = {
    id: "ga" + Date.now(),
    username,
    passHash,
    role,
    group: group || null,
  };
  accounts.push(newAccount);
  await saveGroupAdminsAsync(accounts);
  return newAccount;
}

async function updateGroupAdminAsync(id, username, plainPass, role, group) {
  const accounts = await getGroupAdminsAsync();
  const idx = accounts.findIndex((a) => a.id === id);
  if (idx === -1) throw new Error("Akun tidak ditemukan");
  accounts[idx].username = username;
  accounts[idx].role = role;
  accounts[idx].group = group || null;
  if (plainPass) {
    accounts[idx].passHash = await sha256(plainPass);
  }
  await saveGroupAdminsAsync(accounts);
  return accounts[idx];
}

async function deleteGroupAdminAsync(id) {
  const accounts = await getGroupAdminsAsync();
  const filtered = accounts.filter((a) => a.id !== id);
  await saveGroupAdminsAsync(filtered);
}

async function verifyGroupAdminLogin(inputUser, inputPass) {
  const accounts = await getGroupAdminsAsync();
  const inputHash = await sha256(inputPass);
  return accounts.find((a) => a.username === inputUser && a.passHash === inputHash) || null;
}

// ─── 8. REAL-TIME LISTENER ──────────────────────────────────
function onDataChange(callback) {
  return _db
    .collection(FS_COL)
    .doc(FS_MAIN_DOC)
    .onSnapshot(
      (doc) => {
        if (doc.exists) {
          callback(doc.data());
        }
      },
      (err) => {
        console.error("[Firestore] onSnapshot error:", err);
      }
    );
}

// ─── 9. MIGRATION HELPER ────────────────────────────────────
async function migrateFromLocalStorage() {
  console.log("[Migration] Mulai migrasi dari localStorage ke Firestore...");

  // Data utama
  const raw = localStorage.getItem("mlwc_data");
  if (raw) {
    try {
      const data = JSON.parse(raw);
      await saveDataAsync(data);
      console.log("[Migration] ✅ mlwc_data berhasil dimigrasi");
    } catch (e) {
      console.error("[Migration] ❌ Gagal migrasi mlwc_data:", e);
    }
  } else {
    console.log("[Migration] ⚠️ mlwc_data tidak ditemukan di localStorage");
  }

  // Settings
  const rawSettings = localStorage.getItem("mlwc_settings");
  if (rawSettings) {
    try {
      const settings = JSON.parse(rawSettings);
      await saveSettingsAsync(settings);
      console.log("[Migration] ✅ mlwc_settings berhasil dimigrasi");
    } catch (e) {
      console.error("[Migration] ❌ Gagal migrasi mlwc_settings:", e);
    }
  }

  // Credentials — hash ulang password yang masih plain text
  const rawCreds = localStorage.getItem("mlwc_admin_credentials");
  if (rawCreds) {
    try {
      const creds = JSON.parse(rawCreds);
      await saveAdminCredentialsAsync(creds.user, creds.pass);
      console.log("[Migration] ✅ mlwc_admin_credentials berhasil dimigrasi (password di-hash SHA-256)");
    } catch (e) {
      console.error("[Migration] ❌ Gagal migrasi credentials:", e);
    }
  }

  console.log("[Migration] Selesai! Kamu bisa hapus data localStorage sekarang:");
  console.log("  localStorage.removeItem('mlwc_data')");
  console.log("  localStorage.removeItem('mlwc_settings')");
  console.log("  localStorage.removeItem('mlwc_admin_credentials')");
}