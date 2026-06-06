/* ============================================================
   admin-grup.js  —  EXPLORA Tournament | Admin Per Grup
   ============================================================ */

const GA_AUTH_KEY = "mlwc_group_admin_auth";
let _gaSession = null;
let _unsubscribe = null;

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

  const badge = document.getElementById("groupBadge");
  if (badge && _gaSession?.group) {
    badge.textContent = `Admin Grup ${_gaSession.group}`;
  }
  const headerUsername = document.getElementById("headerUsername");
  if (headerUsername && _gaSession?.username) {
    headerUsername.textContent = _gaSession.username;
  }

  await initData();

  _unsubscribe = onDataChange((newData) => {
    _cachedData = newData;
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
   JADWAL — perbaikan: tampilan card yang lebih rapi
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
    const scoreTxt = m.played ? `${m.scoreA} – ${m.scoreB}` : "– vs –";
    return `
      <div class="match-card-list">
        <div class="match-info">
          <span class="match-group-badge">Grup ${group}</span>
          <span class="ga-bo-badge match-date-badge">BO1</span>
        </div>
        <div class="match-teams">
          <div class="match-team-item">
            <span class="match-team-name">${tA?.name || "?"}</span>
          </div>
          <span class="match-score-badge">${scoreTxt}</span>
          <div class="match-team-item right">
            <span class="match-team-name">${tB?.name || "?"}</span>
          </div>
        </div>
        <div class="match-status ${m.played ? "status-done" : "status-pending"}">
          ${m.played ? "✅ Selesai" : "⏳ Belum"}
        </div>
      </div>
    `;
  }).join("");
}

/* ============================================================
   INPUT HASIL
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

  wrap.innerHTML = matches.map((m, i) => {
    const tA = teamById(m.teamA, data);
    const tB = teamById(m.teamB, data);
    const statusBadge = m.played
      ? `<span class="match-status status-done">✅ Selesai</span>`
      : `<span class="match-status status-pending">⏳ Belum</span>`;
    const actionBtn = m.played
      ? `<button class="btn btn-ghost sm" onclick="openScoreModal('${m.id}')">✏️ Edit Skor</button>`
      : `<button class="btn btn-primary sm" onclick="openScoreModal('${m.id}')">⚽ Input Skor</button>`;

    return `
      <div class="ga-result-card ${m.played ? "ga-result-done" : ""}">
        <div class="ga-result-num">#${i + 1}</div>
        <div class="ga-result-center">
          <div class="ga-result-teams">
            <span class="ga-team-name-lg">${tA?.name || "?"}</span>
            ${m.played
              ? `<span class="ga-result-score">${m.scoreA} – ${m.scoreB}</span>`
              : `<span class="ga-vs-badge">VS</span>`
            }
            <span class="ga-team-name-lg">${tB?.name || "?"}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
            <span class="match-badge">Grup ${group}</span>
            ${statusBadge}
          </div>
        </div>
        <div class="ga-result-action">
          ${actionBtn}
        </div>
      </div>
    `;
  }).join("");
}

/* ── Modal Input / Edit Skor BO1 — hanya 1-0 atau 0-1 ── */
window.openScoreModal = function (matchId) {
  const data = getData();
  const m = data.matches.find((x) => x.id === matchId);
  if (!m) { toast("Match tidak ditemukan", "error"); return; }
  const tA = teamById(m.teamA, data);
  const tB = teamById(m.teamB, data);

  openGAModal(
    m.played ? "✏️ Edit Hasil (BO1)" : "⚽ Input Hasil (BO1)",
    `
    <div class="score-modal-body">
      <div class="score-modal-title">
        <span class="score-modal-team">${tA?.name || "Tim A"}</span>
        <span class="score-modal-vs">VS</span>
        <span class="score-modal-team">${tB?.name || "Tim B"}</span>
      </div>
      <p style="text-align:center;font-size:0.8rem;color:var(--text-tertiary);margin-bottom:16px;">
        Babak Grup BO1 — Pilih pemenang pertandingan ini
      </p>
      <div class="bo1-choices">
        <button type="button"
          class="bo1-choice-btn ${m.played && m.scoreA === 1 ? "bo1-selected" : ""}"
          onclick="selectBO1Winner('A')">
          <div class="bo1-team-name">${tA?.name || "Tim A"}</div>
          <div class="bo1-score-preview">1 – 0</div>
          <div class="bo1-win-label">Menang</div>
        </button>
        <button type="button"
          class="bo1-choice-btn ${m.played && m.scoreB === 1 ? "bo1-selected" : ""}"
          onclick="selectBO1Winner('B')">
          <div class="bo1-team-name">${tB?.name || "Tim B"}</div>
          <div class="bo1-score-preview">0 – 1</div>
          <div class="bo1-win-label">Menang</div>
        </button>
      </div>
      <div id="bo1Error" class="bo1-error hidden">⚠️ Pilih salah satu pemenang terlebih dahulu!</div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeGAModal()">Batal</button>
      <button class="btn btn-primary" onclick="saveBO1Score('${matchId}')">💾 Simpan</button>
    </div>
    `
  );
};

let _bo1Winner = null;

window.selectBO1Winner = function(side) {
  _bo1Winner = side;
  document.querySelectorAll(".bo1-choice-btn").forEach(btn => btn.classList.remove("bo1-selected"));
  const idx = side === "A" ? 0 : 1;
  document.querySelectorAll(".bo1-choice-btn")[idx]?.classList.add("bo1-selected");
  document.getElementById("bo1Error")?.classList.add("hidden");
};

window.saveBO1Score = async function(matchId) {
  if (!_bo1Winner) {
    document.getElementById("bo1Error")?.classList.remove("hidden");
    return;
  }
  const scoreA = _bo1Winner === "A" ? 1 : 0;
  const scoreB = _bo1Winner === "B" ? 1 : 0;

  try {
    const data = getData();
    const m = data.matches.find((x) => x.id === matchId);
    if (!m) { toast("Match tidak ditemukan", "error"); return; }

    m.scoreA = scoreA;
    m.scoreB = scoreB;
    m.played = true;

    await saveDataAsync(data);
    _cachedData = data;
    _bo1Winner = null;

    closeGAModal();
    renderGroupAdmin();
    toast(`Hasil disimpan: ${scoreA} – ${scoreB} ✅`, "success");
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

  const rowsHtml = rows.map((t, i) => {
    const isTop2 = i < 2;
    const rankIcon = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
    return `
      <tr class="${isTop2 ? "ga-standing-qualify" : ""}">
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
    <div class="ga-standings-wrap" style="width:100%;">
      <div class="ga-standings-header">
        <span>Klasemen Grup ${group}</span>
        <span class="ga-standings-legend">Win +1 · Draw 0 · Loss −1</span>
      </div>
      <div style="overflow-x:auto;width:100%;">
        <table class="ga-standings-table" style="width:100%;min-width:500px;">
          <colgroup>
            <col style="width:56px;">
            <col>
            <col style="width:72px;">
            <col style="width:72px;">
            <col style="width:72px;">
            <col style="width:72px;">
            <col style="width:80px;">
          </colgroup>
          <thead>
            <tr>
              <th class="ga-th-center">#</th>
              <th class="ga-th-left">Tim</th>
              <th class="ga-th-center" title="Main">Main</th>
              <th class="ga-th-center" title="Menang">Menang</th>
              <th class="ga-th-center" title="Draw">Draw</th>
              <th class="ga-th-center" title="Kalah">Kalah</th>
              <th class="ga-th-center" title="Poin">Poin</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      <div class="ga-standings-footer">
        <span class="ga-legend-dot qualify"></span> Top 2 lolos ke playoff
        <span style="margin-left:16px;">Main · Menang · Draw · Kalah · Poin</span>
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
          <th style="text-align:center;width:60px;">Poin</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((t, i) => `
          <tr style="${i < 2 ? "background:#f0fff4;" : ""}">
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
      ★ Top 2 lolos ke playoff &nbsp;|&nbsp; Win=+1 · Draw=0 · Loss=−1
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