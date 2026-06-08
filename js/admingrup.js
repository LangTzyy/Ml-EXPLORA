/* ============================================================
   admin-grup.js  —  EXPLORA Tournament | Admin Per Grup
   ============================================================ */

const GA_AUTH_KEY = "mlwc_group_admin_auth";
let _gaSession = null;
let _unsubscribe = null;

// _cachedData, _cachedSettings, getSettings(), initData(), getData()
// sudah dideklarasikan di script.js (shared global) — tidak perlu dideklarasikan ulang di sini.

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("loginForm")) return;
  initGroupAdmin();
});

async function initGroupAdmin() {
  const stored = sessionStorage.getItem(GA_AUTH_KEY);
  if (stored) {
    try {
      _gaSession = JSON.parse(stored);
      await showGroupShell();
    } catch (e) {
      sessionStorage.removeItem(GA_AUTH_KEY);
    }
  }

  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const u = document.getElementById("loginUser").value.trim();
    const p = document.getElementById("loginPass").value;
    const btn = document.getElementById("loginBtn");
    const errEl = document.getElementById("loginError");

    btn.disabled = true;
    btn.querySelector("span").textContent = "Memverifikasi...";
    errEl.classList.add("hidden");

    try {
      const account = await verifyGroupAdminLogin(u, p);
      if (account && account.role === "group_admin") {
        _gaSession = account;
        sessionStorage.setItem(GA_AUTH_KEY, JSON.stringify(account));
        await showGroupShell();
        toast("Login berhasil. Selamat datang, " + account.username + "!", "success");
      } else if (account && account.role === "super_admin") {
        errEl.textContent = "⚠️ Gunakan halaman admin.html untuk Super Admin.";
        errEl.classList.remove("hidden");
      } else {
        errEl.textContent = "❌ Username atau password salah.";
        errEl.classList.remove("hidden");
      }
    } catch (err) {
      errEl.textContent = "❌ Gagal terhubung ke server.";
      errEl.classList.remove("hidden");
      console.error(err);
    } finally {
      btn.disabled = false;
      btn.querySelector("span").textContent = "Sign In";
    }
  });

  document.getElementById("logoutBtn").addEventListener("click", () => {
    if (_unsubscribe) _unsubscribe();
    sessionStorage.removeItem(GA_AUTH_KEY);
    _gaSession = null;
    location.reload();
  });

  document.querySelectorAll(".side-link").forEach((a) => {
    a.addEventListener("click", () => switchGATab(a.dataset.tab));
  });

  const sidebar = document.getElementById("sidebar");
  const overlay = document.createElement("div");
  overlay.className = "sidebar-overlay";
  overlay.id = "sidebarOverlay";
  document.body.appendChild(overlay);

  const openSidebar = () => { sidebar.classList.add("open"); overlay.classList.add("active"); };
  const closeSidebar = () => { sidebar.classList.remove("open"); overlay.classList.remove("active"); };

  document.getElementById("adminHamb").addEventListener("click", () => {
    if (window.innerWidth <= 900) {
      sidebar.classList.contains("open") ? closeSidebar() : openSidebar();
    }
  });
  document.getElementById("sidebarCloseBtn")?.addEventListener("click", closeSidebar);
  overlay.addEventListener("click", closeSidebar);

  document.getElementById("modalClose").addEventListener("click", closeGAModal);
  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") closeGAModal();
  });

  // Export dropdown
  document.getElementById("exportWordBtn")?.addEventListener("click", () => exportGAToWord());
  document.getElementById("exportWordOnlyBtn")?.addEventListener("click", () => exportGAToWord());
  document.getElementById("exportPdfBtn")?.addEventListener("click", () => exportGAToPDF());
  const toggle = document.getElementById("exportDropdownToggle");
  const menu = document.getElementById("exportDropdownMenu");
  toggle?.addEventListener("click", (e) => {
    e.stopPropagation();
    menu?.classList.toggle("hidden");
  });
  document.addEventListener("click", (e) => {
    if (!toggle?.contains(e.target) && !menu?.contains(e.target)) {
      menu?.classList.add("hidden");
    }
  });
}

/* ============================================================
   SHOW SHELL
   ============================================================ */
async function showGroupShell() {
  document.getElementById("loginOverlay").classList.add("hidden");
  document.getElementById("adminShell").classList.remove("hidden");

  // Format header: "username · Admin Grup X"
  const elUser = document.getElementById("gaHeaderUsername");
  const elRole = document.getElementById("gaHeaderRole");
  if (elUser) elUser.textContent = _gaSession?.username || "—";
  if (elRole) elRole.textContent = `Admin Grup ${_gaSession?.group || "?"}`;

  await initData();

  _unsubscribe = onDataChange(async (newData) => {
    _cachedData = newData;
    // Refresh settings supaya qualifiedPerGroup selalu sinkron dengan Firestore
    _cachedSettings = await getSettingsAsync();
    renderGroupAdmin();
  });

  renderGroupAdmin();
}

/* ============================================================
   SWITCH TAB
   ============================================================ */
function switchGATab(name) {
  document.querySelectorAll(".side-link").forEach((a) =>
    a.classList.toggle("active", a.dataset.tab === name)
  );
  document.querySelectorAll(".tab").forEach((t) =>
    t.classList.toggle("hidden", t.dataset.tab !== name)
  );

  const titles = {
    dashboard: "Dashboard",
    schedule: "Jadwal Pertandingan",
    results: "Input Hasil",
    standings: "Klasemen",
  };
  document.getElementById("tabTitle").textContent = titles[name] || name;

  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("sidebarOverlay")?.classList.remove("active");

  renderGroupAdmin();
}

/* ============================================================
   RENDER ALL
   ============================================================ */
function renderGroupAdmin() {
  if (!_gaSession) return;
  renderGADashboard();
  renderGASchedule();
  renderGAResults();
  renderGAStandings();
}

/* ============================================================
   HELPER
   ============================================================ */
function getGroupData() {
  const data = getData();
  const g = _gaSession.group;
  return {
    data,
    group: g,
    teams: data.teams.filter((t) => t.group === g),
    matches: data.matches.filter((m) => m.group === g),
  };
}

function teamById(id, data) {
  return data.teams.find((t) => t.id === id);
}

/* ============================================================
   DASHBOARD — perbaikan: tampilkan username & info akun
   ============================================================ */
function renderGADashboard() {
  const wrap = document.getElementById("dashboardStats");
  const upcomingWrap = document.getElementById("upcomingMini");
  if (!wrap) return;

  const { data, group, teams, matches } = getGroupData();
  const played = matches.filter((m) => m.played).length;
  const unplayed = matches.length - played;
  const progress = matches.length ? Math.round((played / matches.length) * 100) : 0;

  wrap.innerHTML = `
    <div class="stat-card"><div class="stat-value">${teams.length}</div><div class="stat-label">Total Tim</div></div>
    <div class="stat-card"><div class="stat-value">${matches.length}</div><div class="stat-label">Total Match</div></div>
    <div class="stat-card"><div class="stat-value">${played}</div><div class="stat-label">Match Selesai</div></div>
    <div class="stat-card"><div class="stat-value">${unplayed}</div><div class="stat-label">Match Belum</div></div>
    <div class="stat-card"><div class="stat-value">${progress}%</div><div class="stat-label">Progres</div></div>
  `;

  if (!upcomingWrap) return;
  const upcoming = matches.filter((m) => !m.played).slice(0, 5);
  if (!upcoming.length) {
    upcomingWrap.innerHTML = played === matches.length && matches.length > 0
      ? '<div class="empty-state">✅ Semua match grup sudah selesai!</div>'
      : '<div class="empty-state">📭 Belum ada pertandingan terjadwal.</div>';
    return;
  }
  upcomingWrap.innerHTML = upcoming.map((m, i) => {
    const tA = teamById(m.teamA, data);
    const tB = teamById(m.teamB, data);
    return `
      <div class="ga-match-row">
        <span class="ga-match-num">${i + 1}</span>
        <span class="match-badge">Grup ${group}</span>
        <span class="ga-match-teams">${tA?.name || "?"} <span class="vs">vs</span> ${tB?.name || "?"}</span>
        <span class="match-status status-pending">⏳ Belum</span>
      </div>
    `;
  }).join("");
}

/* ============================================================
   JADWAL — persis seperti super admin
   ============================================================ */
function renderGASchedule() {
  const wrap = document.getElementById("scheduleList");
  if (!wrap) return;

  const { data, group, matches } = getGroupData();
  const title = document.getElementById("scheduleTitle");
  if (title) title.textContent = `Jadwal Pertandingan — Grup ${group}`;

  if (!matches.length) {
    wrap.innerHTML = '<div class="empty-state">📭 Belum ada jadwal untuk grup ini.</div>';
    return;
  }

  wrap.innerHTML = matches.map((m) => {
    const tA = teamById(m.teamA, data);
    const tB = teamById(m.teamB, data);
    const scoreText = m.played ? `${m.scoreA} - ${m.scoreB}` : "- : -";
    const statusClass = m.played ? "status-done" : "status-pending";
    const statusText = m.played ? "✓ Selesai" : "⏳ Belum";
    return `
      <div class="match-card-list">
        <div class="match-info">
          <span class="match-group-badge">Grup ${group}</span>
          <span class="match-date-badge">BO1</span>
        </div>
        <div class="match-teams">
          <div class="match-team-item"><span class="match-team-name">${tA?.name || "???"}</span></div>
          <div class="match-score-badge">${scoreText}</div>
          <div class="match-team-item right"><span class="match-team-name">${tB?.name || "???"}</span></div>
        </div>
        <div class="match-status"><span class="${statusClass}">${statusText}</span></div>
      </div>
    `;
  }).join("");
}

/* ============================================================
   INPUT HASIL — persis seperti super admin (inline BO1)
   ============================================================ */
function renderGAResults() {
  const wrap = document.getElementById("resultsList");
  if (!wrap) return;

  const { data, group, matches } = getGroupData();
  const title = document.getElementById("resultsTitle");
  if (title) title.textContent = `Input Hasil Pertandingan — Grup ${group} (BO1)`;

  if (!matches.length) {
    wrap.innerHTML = '<div class="empty-state">📭 Belum ada match untuk grup ini.</div>';
    return;
  }

  wrap.innerHTML = matches.map((m) => {
    const tA = teamById(m.teamA, data);
    const tB = teamById(m.teamB, data);
    return `
      <div class="match-card-list">
        <div class="match-info"><span class="match-group-badge">Grup ${group}</span></div>
        <div class="match-teams">
          <div class="match-team-item"><span class="match-team-name">${tA?.name || "???"}</span></div>
          <div class="score-input-mini">
            <input type="number" min="0" max="1" value="${m.scoreA ?? ""}" id="sA-${m.id}" placeholder="0"/>
            <span>:</span>
            <input type="number" min="0" max="1" value="${m.scoreB ?? ""}" id="sB-${m.id}" placeholder="0"/>
          </div>
          <div class="match-team-item right"><span class="match-team-name">${tB?.name || "???"}</span></div>
        </div>
        <div class="match-actions">
          <button class="btn btn-primary sm" onclick="saveBO1GA('${m.id}')">💾 Simpan</button>
        </div>
      </div>
    `;
  }).join("");
}

window.saveBO1GA = async function(id) {
  const data = getData();
  const m = data.matches.find((x) => x.id === id);
  if (!m) { toast("Match tidak ditemukan", "error"); return; }

  const a = parseInt(document.getElementById("sA-" + id)?.value, 10);
  const b = parseInt(document.getElementById("sB-" + id)?.value, 10);

  if (isNaN(a) || isNaN(b)) {
    toast("Masukkan skor yang valid (0 atau 1)", "error");
    return;
  }
  if (![0, 1].includes(a) || ![0, 1].includes(b) || a === b) {
    toast("Skor BO1 hanya boleh 1-0 atau 0-1", "error");
    return;
  }

  try {
    m.scoreA = a;
    m.scoreB = b;
    m.played = true;
    await saveDataAsync(data);
    _cachedData = data;
    renderGroupAdmin();
    toast(`Skor disimpan: ${a} – ${b} ✅`, "success");
  } catch (e) {
    toast("Gagal menyimpan: " + e.message, "error");
    console.error(e);
  }
};

/* ============================================================
   KLASEMEN — perbaikan: tabel lebih lebar & jelas
   ============================================================ */
function renderGAStandings() {
  const wrap = document.getElementById("standingsTable");
  if (!wrap) return;

  const { data, group, teams } = getGroupData();
  const title = document.getElementById("standingsTitle");
  if (title) title.textContent = `Klasemen Grup ${group}`;

  if (!teams.length) {
    wrap.innerHTML = '<div class="empty-state">👥 Belum ada tim di grup ini.</div>';
    return;
  }

  const standings = computeStandings(data);
  const rows = standings[group] || [];

  if (!rows.length) {
    wrap.innerHTML = '<div class="empty-state">📊 Data klasemen belum tersedia.</div>';
    return;
  }

  const qualPG = getSettings().qualifiedPerGroup || 2;

  const rowsHtml = rows.map((t, i) => {
    const isQualified = i < qualPG;
    const rankIcon = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
    return `
      <tr class="${isQualified ? "ga-standing-qualify" : ""}">
        <td class="ga-standing-rank">${rankIcon}</td>
        <td class="ga-standing-team">
          <div class="ga-standing-team-inner">
            <div class="ga-team-logo" style="background:${t.logoColor || "var(--gradient-blue)"}">⚔</div>
            <div>
              <div class="ga-team-fullname">${t.name}</div>
              <div class="ga-team-shorttag">${t.tag}</div>
            </div>
          </div>
        </td>
        <td class="ga-standing-num">${t.played}</td>
        <td class="ga-standing-win">${t.win}</td>
        <td class="ga-standing-draw">${t.draw}</td>
        <td class="ga-standing-lose">${t.lose}</td>
        <td class="ga-standing-pts">${t.points > 0 ? "+" : ""}${t.points}</td>
      </tr>
    `;
  }).join("");

  wrap.innerHTML = `
    <div class="ga-standings-wrap">
      <div class="ga-standings-header">
        <span>Klasemen Grup ${group}</span>
      </div>
      <table class="ga-standings-table">
        <colgroup>
          <col style="width:52px;">
          <col>
          <col style="width:68px;">
          <col style="width:68px;">
          <col style="width:68px;">
          <col style="width:68px;">
          <col style="width:76px;">
        </colgroup>
        <thead>
          <tr>
            <th class="ga-th-center">#</th>
            <th class="ga-th-left">Nama Tim</th>
            <th class="ga-th-center">Match</th>
            <th class="ga-th-center">Win</th>
            <th class="ga-th-center">Draw</th>
            <th class="ga-th-center">Lose</th>
            <th class="ga-th-center">Points</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="ga-standings-footer">
        <span>★ Top ${qualPG} lolos ke playoff &nbsp;|&nbsp; Win=+1 · Draw=0 · Lose=−1</span>
      </div>
    </div>
  `;
}

/* ============================================================
   MODAL HELPER
   ============================================================ */
function openGAModal(title, bodyHtml) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").innerHTML = bodyHtml;
  document.getElementById("modalOverlay").classList.remove("hidden");
}

window.closeGAModal = function () {
  document.getElementById("modalOverlay").classList.add("hidden");
  document.getElementById("modalBody").innerHTML = "";
};

/* ============================================================
   EXPORT — perbaikan: font lokal agar tidak slow network
   ============================================================ */
function buildGAExportContent() {
  const { data, group, teams, matches } = getGroupData();
  const standings = computeStandings(data);
  const rows = standings[group] || [];
  const played = matches.filter((m) => m.played);
  const now = new Date().toLocaleDateString("id-ID", { dateStyle: "long" });
  const qualPG = getSettings().qualifiedPerGroup || 2;

  let html = `
    <h1 style="text-align:center;font-family:Arial,sans-serif;">EXPLORA 2026 — Grup ${group}</h1>
    <p style="text-align:center;font-family:Arial,sans-serif;color:#666;">
      Admin: <strong>${_gaSession?.username || ""}</strong> &nbsp;|&nbsp; Dicetak: ${now}
    </p>
    <hr style="margin:16px 0;"/>
    <h2 style="font-family:Arial,sans-serif;">Klasemen Grup ${group}</h2>
    <table border="1" cellpadding="8" cellspacing="0"
      style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;">
      <thead style="background:#e8f0fe;">
        <tr>
          <th style="text-align:center;width:40px;">#</th>
          <th style="text-align:left;">Tim</th>
          <th style="text-align:center;width:50px;">Main</th>
          <th style="text-align:center;width:50px;">Menang</th>
          <th style="text-align:center;width:50px;">Draw</th>
          <th style="text-align:center;width:50px;">Kalah</th>
          <th style="text-align:center;width:60px;">Points</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((t, i) => `
          <tr style="${i < qualPG ? "background:#f0fff4;" : ""}">
            <td style="text-align:center;">${i + 1}</td>
            <td>${t.name} <span style="color:#888;">(${t.tag})</span></td>
            <td style="text-align:center;">${t.played}</td>
            <td style="text-align:center;color:green;">${t.win}</td>
            <td style="text-align:center;">${t.draw}</td>
            <td style="text-align:center;color:red;">${t.lose}</td>
            <td style="text-align:center;font-weight:bold;">${t.points > 0 ? "+" : ""}${t.points}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    <p style="font-size:11px;color:#888;font-family:Arial,sans-serif;">
      ★ Top ${qualPG} lolos ke playoff &nbsp;|&nbsp; Win=+1 · Draw=0 · Lose=−1
    </p>
    <h2 style="font-family:Arial,sans-serif;margin-top:24px;">Hasil Pertandingan Grup ${group}</h2>
  `;

  if (!played.length) {
    html += `<p style="font-family:Arial,sans-serif;color:#888;">Belum ada pertandingan yang selesai.</p>`;
  } else {
    html += `
      <table border="1" cellpadding="8" cellspacing="0"
        style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;">
        <thead style="background:#e8f0fe;">
          <tr>
            <th style="text-align:left;">Tim A</th>
            <th style="text-align:center;width:80px;">Skor</th>
            <th style="text-align:left;">Tim B</th>
          </tr>
        </thead>
        <tbody>
          ${played.map((m) => {
            const tA = teamById(m.teamA, data);
            const tB = teamById(m.teamB, data);
            const winner = m.scoreA > m.scoreB ? "A" : m.scoreB > m.scoreA ? "B" : null;
            return `
              <tr>
                <td style="${winner === "A" ? "font-weight:bold;" : ""}">${tA?.name || "?"}</td>
                <td style="text-align:center;font-weight:bold;">${m.scoreA} – ${m.scoreB}</td>
                <td style="${winner === "B" ? "font-weight:bold;" : ""}">${tB?.name || "?"}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
  }

  return html;
}

function exportGAToWord() {
  try {
    const content = buildGAExportContent();
    const blob = new Blob(['\ufeff' + content], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `EXPLORA_Grup${_gaSession?.group || "X"}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Export Word berhasil 📄", "success");
  } catch (e) {
    toast("Gagal export: " + e.message, "error");
  }
}

function exportGAToPDF() {
  try {
    const content = buildGAExportContent();
    const win = window.open("", "_blank");
    if (!win) { toast("Pop-up diblokir browser. Izinkan pop-up lalu coba lagi.", "error"); return; }
    win.document.write(`<!DOCTYPE html>
      <html><head>
        <meta charset="UTF-8"/>
        <title>EXPLORA Grup ${_gaSession?.group}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ccc; padding: 8px; }
          @media print { body { padding: 16px; } }
        </style>
      </head>
      <body>${content}</body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 300);
    toast("Membuka dialog print PDF 📑", "info");
  } catch (e) {
    toast("Gagal export PDF: " + e.message, "error");
  }
}

/* ============================================================
   TOAST
   ============================================================ */
function toast(msg, type = "info") {
  const c = document.getElementById("toastContainer");
  if (!c) return;
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${msg}</span>`;
  c.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateX(50px)"; }, 2700);
  setTimeout(() => el.remove(), 3100);
}