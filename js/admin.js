/* ============================================================
    ADMIN DASHBOARD
   ============================================================ */

/* ============================================================
   STATE SWAP MODE
   swapMode = true  → bracket match card bisa diklik untuk edit
   ============================================================ */
let swapModeActive = false;

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("loginForm")) return;
  initAdmin();
});

async function initAdmin() {
  if (sessionStorage.getItem(AUTH_KEY) === "1") {
    await showShell();
  }

  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const u = document.getElementById("loginUser").value.trim();
    const p = document.getElementById("loginPass").value;
    const ok = await verifyAdminLogin(u, p);
    if (ok) {
      sessionStorage.setItem(AUTH_KEY, "1");
      await showShell();
      toast("Login berhasil. Selamat datang, Admin!", "success");
    } else {
      toast("Username atau password salah", "error");
    }
  });

  document.getElementById("logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem(AUTH_KEY);
    location.reload();
  });

  document.querySelectorAll(".side-link").forEach((a) => {
    a.addEventListener("click", () => switchTab(a.dataset.tab));
  });

  const sidebar = document.getElementById("sidebar");
  const shell = document.getElementById("adminShell");
  const overlay = document.createElement("div");
  overlay.className = "sidebar-overlay";
  overlay.id = "sidebarOverlay";
  document.body.appendChild(overlay);

  const openSidebar = () => {
    sidebar.classList.add("open");
    overlay.classList.add("active");
  };
  const closeSidebar = () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("active");
  };

  document.getElementById("adminHamb").addEventListener("click", () => {
    if (window.innerWidth <= 900) {
      sidebar.classList.contains("open") ? closeSidebar() : openSidebar();
    }
  });

  document
    .getElementById("sidebarCloseBtn")
    ?.addEventListener("click", closeSidebar);
  overlay.addEventListener("click", closeSidebar);

  document
    .getElementById("addTeamBtn")
    .addEventListener("click", () => openTeamModal());
  document
    .getElementById("genScheduleBtn")
    .addEventListener("click", regenerateSchedule);
  document
    .getElementById("genBracketBtn")
    .addEventListener("click", generateBracket);
  document.getElementById("resetBtn").addEventListener("click", resetAll);
  document.getElementById("simulateBtn").addEventListener("click", simulateAll);
  document
    .getElementById("saveTimelineBtn")
    ?.addEventListener("click", saveTimeline);

  // ── Swap Mode ──
  document
    .getElementById("toggleSwapModeBtn")
    ?.addEventListener("click", () => {
      swapModeActive = true;
      updateSwapModeUI();
      renderCenteredBracket();
      toast("Mode Edit Matchup aktif. Klik match untuk swap/edit tim.", "info");
    });
  document.getElementById("exitSwapModeBtn")?.addEventListener("click", () => {
    swapModeActive = false;
    updateSwapModeUI();
    renderCenteredBracket();
    toast("Mode Edit Matchup dinonaktifkan.", "info");
  });

  // Export dropdown
  document.getElementById("exportWordBtn")?.addEventListener("click", () => exportToWord());
  document.getElementById("exportWordOnlyBtn")?.addEventListener("click", () => exportToWord());
  document.getElementById("exportPdfBtn")?.addEventListener("click", () => exportToPDF());
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

  // Import hanya di tab teams
  document.getElementById("importFile")?.addEventListener("change", importData);

  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") closeModal();
  });

  const scheduleFilter = document.getElementById("scheduleFilter");
  const resultsFilter = document.getElementById("resultsFilter");
  scheduleFilter?.addEventListener("change", () => renderAdminSchedule());
  resultsFilter?.addEventListener("change", () => renderAdminResults());
  const standingsFilter = document.getElementById("standingsFilter");
  standingsFilter?.addEventListener("change", () => renderAdminStandings());
  document
    .getElementById("teamSearchInput")
    ?.addEventListener("input", () => renderAdminTeams());
  await initSettingsOnLoad();
}

/* ── UI swap mode ── */
function updateSwapModeUI() {
  const btn = document.getElementById("toggleSwapModeBtn");
  const guide = document.getElementById("swapGuide");
  const info = document.getElementById("swapModeInfo");
  const genBtn = document.getElementById("genBracketBtn");

  if (swapModeActive) {
    btn?.classList.add("hidden");
    guide?.classList.remove("hidden");
    info?.classList.remove("hidden");
    genBtn?.classList.add("hidden");
  } else {
    btn?.classList.remove("hidden");
    guide?.classList.add("hidden");
    info?.classList.add("hidden");
    genBtn?.classList.remove("hidden");
  }
}

async function showShell() {
  document.getElementById("loginOverlay").classList.add("hidden");
  document.getElementById("adminShell").classList.remove("hidden");
  document.getElementById("tabTitle").textContent = "⏳ Memuat data...";
  await initData();
  document.getElementById("tabTitle").textContent = "Dashboard";
  renderAdmin();
}

function switchTab(name) {
  document
    .querySelectorAll(".side-link")
    .forEach((a) => a.classList.toggle("active", a.dataset.tab === name));
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.toggle("hidden", t.dataset.tab !== name));
  const titles = {
    dashboard: "Dashboard",
    teams: "Kelola Tim",
    schedule: "Jadwal Grup",
    results: "Input Hasil",
    playoff: "Playoff Bracket",
    timeline: "Timeline Turnamen",
    standings: "Klasemen Grup",
    settings: "Pengaturan",
  };
  document.getElementById("tabTitle").textContent = titles[name] || name;
  const _sb = document.getElementById("sidebar");
  const _ov = document.getElementById("sidebarOverlay");
  _sb?.classList.remove("open");
  _ov?.classList.remove("active");
  renderAdmin();
}

function renderAdmin() {
  renderAdminStats();
  renderAdminTeams();
  renderAdminSchedule();
  renderAdminResults();
  renderCenteredBracket();
  renderUpcomingMini();
  renderTimelineEditor();
  renderAdminStandings();
  renderSettingsTab().catch(console.error);
}

/* ============================================================
   CONFIRM MODAL — pengganti window.confirm()
   Penggunaan:
     confirmModal("Pesan?", () => { /* aksi jika OK *\/ });
   ============================================================ */
function confirmModal(message, onConfirm, options = {}) {
  const {
    title = "Konfirmasi",
    confirmText = "Ya, Lanjutkan",
    cancelText = "Batal",
    type = "warning", // "warning" | "danger" | "info"
  } = options;

  const iconMap = {
    warning: "⚠️",
    danger: "🗑️",
    info: "ℹ️",
  };

  const colorMap = {
    warning: "rgba(255,171,0,0.1)",
    danger: "rgba(255,68,68,0.1)",
    info: "rgba(0,102,255,0.1)",
  };

  const borderMap = {
    warning: "rgba(255,171,0,0.3)",
    danger: "rgba(255,68,68,0.3)",
    info: "rgba(0,102,255,0.3)",
  };

  const btnClass = type === "danger" ? "btn-danger" : type === "info" ? "btn-primary" : "btn-primary";

  openModal(
    title,
    `
    <div style="display:flex;flex-direction:column;gap:16px;">
      <div style="display:flex;gap:14px;align-items:flex-start;padding:14px 16px;
                  background:${colorMap[type]};border:1px solid ${borderMap[type]};
                  border-radius:10px;">
        <span style="font-size:1.5rem;line-height:1;flex-shrink:0;">${iconMap[type]}</span>
        <p style="font-size:0.88rem;color:var(--text-secondary);line-height:1.6;margin:0;">${message}</p>
      </div>
      <div class="modal-actions" style="margin-top:0;">
        <button class="btn btn-ghost" onclick="closeModal()">${cancelText}</button>
        <button class="btn ${btnClass}" id="confirmModalOkBtn">${confirmText}</button>
      </div>
    </div>
  `
  );

  // Attach handler setelah modal render
  setTimeout(() => {
    document.getElementById("confirmModalOkBtn")?.addEventListener("click", () => {
      closeModal();
      onConfirm();
    });
  }, 0);
}

/* ============ STATS ============ */
function renderAdminStats() {
  const wrap = document.getElementById("adminStats");
  if (!wrap) return;
  const data = getData();
  const played = data.matches.filter((m) => m.played).length;
  wrap.innerHTML = `
    <div class="stat-card"><div class="stat-value">${data.teams.length}</div><div class="stat-label">Total Tim</div></div>
    <div class="stat-card"><div class="stat-value">${data.matches.length}</div><div class="stat-label">Match Grup</div></div>
    <div class="stat-card"><div class="stat-value">${played}</div><div class="stat-label">Match Selesai</div></div>
    <div class="stat-card"><div class="stat-value">${data.matches.length ? Math.round((played / data.matches.length) * 100) : 0}%</div><div class="stat-label">Progres</div></div>
    <div class="stat-card"><div class="stat-value">${data.bracket?.r16?.length ? "✅" : "❌"}</div><div class="stat-label">Bracket</div></div>
  `;
}

/* ============ UPCOMING / JUARA ============ */
function renderUpcomingMini() {
  const wrap = document.getElementById("upcomingMini");
  if (!wrap) return;
  const data = getData();

  const finalMatch = data.bracket?.final?.[0];
  const bronzeMatch = data.bracket?.bronze?.[0];

  if (finalMatch?.played && finalMatch?.winner) {
    const champion = teamById(finalMatch.winner, data);
    const runnerUp = teamById(
      finalMatch.winner === finalMatch.teamA
        ? finalMatch.teamB
        : finalMatch.teamA,
      data,
    );
    const bronze3rd =
      bronzeMatch?.played && bronzeMatch?.winner
        ? teamById(bronzeMatch.winner, data)
        : null;
    const bronze4th =
      bronzeMatch?.played && bronzeMatch?.winner
        ? teamById(
            bronzeMatch.winner === bronzeMatch.teamA
              ? bronzeMatch.teamB
              : bronzeMatch.teamA,
            data,
          )
        : null;

    wrap.innerHTML = `
      <div class="tournament-complete-banner">
        <div class="tc-header">🏆 TURNAMEN SELESAI!</div>
        <div class="tc-podium">
          <div class="tc-place tc-place-2">
            <div class="tc-medal">🥈</div>
            <div class="tc-rank">Juara 2</div>
            <div class="tc-team">${runnerUp?.name || "???"}</div>
            <div class="tc-tag">${runnerUp?.tag || ""}</div>
          </div>
          <div class="tc-place tc-place-1">
            <div class="tc-medal">🥇</div>
            <div class="tc-rank">JUARA 1</div>
            <div class="tc-team">${champion?.name || "???"}</div>
            <div class="tc-tag">${champion?.tag || ""}</div>
            <div class="tc-crown">👑</div>
          </div>
          <div class="tc-place tc-place-3">
            <div class="tc-medal">🥉</div>
            <div class="tc-rank">Juara 3</div>
            <div class="tc-team">${bronze3rd?.name || "???"}</div>
            <div class="tc-tag">${bronze3rd?.tag || ""}</div>
          </div>
        </div>
        ${bronze4th ? `<div class="tc-4th">🏅 Juara 4: <strong>${bronze4th.name}</strong> (${bronze4th.tag})</div>` : ""}
      </div>
    `;
    return;
  }

  const list = data.matches.filter((m) => !m.played).slice(0, 6);
  if (!list.length && !data.bracket?.r16?.length) {
    wrap.innerHTML =
      '<div class="empty-state">📭 Belum ada pertandingan</div>';
    return;
  }
  if (!list.length) {
    wrap.innerHTML =
      '<div class="empty-state">✅ Semua match grup sudah selesai</div>';
    return;
  }
  wrap.innerHTML = list.map((m) => matchCardListHtml(m, data)).join("");
}

/* ============ TEAMS ============ */
function renderAdminTeams() {
  const wrap = document.getElementById("adminTeams");
  if (!wrap) return;
  const data = getData();
  document.getElementById("teamCount").textContent = data.teams.length;

  const query = (document.getElementById("teamSearchInput")?.value || "")
    .toLowerCase()
    .trim();
  const filtered = data.teams.filter(
    (t) =>
      t.name.toLowerCase().includes(query) ||
      t.tag.toLowerCase().includes(query),
  );

  if (!data.teams.length) {
    wrap.innerHTML =
      '<div class="empty-state">👥 Belum ada tim.</div>';
    return;
  }

  if (!filtered.length) {
    wrap.innerHTML = `<div class="empty-state">🔍 Tidak ada tim yang cocok dengan pencarian "<strong>${query}</strong>".</div>`;
    return;
  }

  wrap.innerHTML = filtered
    .map((t) => {
      const groupCount = data.teams.filter((x) => x.group === t.group).length;
      return `
    <div class="team-row">
      <div class="team-logo">⚔</div>
      <div class="team-info">
        <span class="team-name">${t.name}</span>
        <span class="team-tag">${t.tag}</span>
        <span class="team-group">Grup ${t.group}</span>
        <span class="team-group-count">${groupCount}/4</span>
      </div>
      <div class="team-actions">
        <button class="btn btn-ghost sm" onclick="openTeamModal('${t.id}')">✏ Edit</button>
        <button class="btn btn-danger sm" onclick="deleteTeam('${t.id}')">🗑 Hapus</button>
      </div>
    </div>
  `;
    })
    .join("");
}

function openTeamModal(id) {
  const data = getData();
  const t = id ? data.teams.find((x) => x.id === id) : null;

  const groupCounts = {};
  GROUPS.forEach((g) => {
    groupCounts[g] = 0;
  });
  data.teams.forEach((team) => {
    if (team.id !== id && groupCounts[team.group] !== undefined)
      groupCounts[team.group]++;
  });

  const groupOptions = GROUPS.map((g) => {
    const count = groupCounts[g];
    const isFull = count >= 4;
    const isSelected = t?.group === g;
    const disabled = isFull && !isSelected ? "disabled" : "";
    const label =
      isFull && !isSelected ? `Grup ${g} (penuh)` : `Grup ${g} (${count}/4)`;
    return `<option value="${g}" ${isSelected ? "selected" : ""} ${disabled}>${label}</option>`;
  }).join("");

  openModal(
    t ? "Edit Tim" : "Tambah Tim Baru",
    `
    <div class="form-grid">
      <div><label>Nama Tim</label><input id="fName" class="input" value="${t?.name || ""}" placeholder="Contoh: RRQ Hoshi"/></div>
      <div><label>Tag / Singkatan</label><input id="fTag" class="input" value="${t?.tag || ""}" placeholder="Contoh: RRQ"/></div>
      <div><label>Grup</label>
        <select id="fGroup" class="input">${groupOptions}</select>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="saveTeam('${id || ""}')">💾 Simpan</button>
    </div>
  `,
  );
}

window.saveTeam = function (id) {
  const data = getData();
  const name = document.getElementById("fName").value.trim();
  const tag = document.getElementById("fTag").value.trim();
  const group = document.getElementById("fGroup").value;
  if (!name || !tag) {
    toast("Nama dan tag wajib diisi", "error");
    return;
  }

  const duplicate = data.teams.find(
    (t) => t.name.toLowerCase() === name.toLowerCase() && t.id !== id,
  );
  if (duplicate) {
    toast(`Nama tim "${name}" sudah digunakan`, "error");
    return;
  }

  if (id) {
    const t = data.teams.find((x) => x.id === id);
    const oldGroup = t.group;
    if (group !== oldGroup) {
      const newGroupCount = data.teams.filter(
        (x) => x.group === group && x.id !== id,
      ).length;
      if (newGroupCount >= 4) {
        toast(`Grup ${group} sudah penuh (maks 4 tim)`, "error");
        return;
      }
    }
    Object.assign(t, { name, tag, group });
  } else {
    const groupCount = data.teams.filter((x) => x.group === group).length;
    if (groupCount >= 4) {
      toast(`Grup ${group} sudah penuh (maks 4 tim)`, "error");
      return;
    }
    data.teams.push({
      id: "t" + Date.now(),
      name,
      tag,
      group,
      logoColor: LOGO_COLORS[data.teams.length % LOGO_COLORS.length],
    });
  }
  saveData(data);
  closeModal();
  renderAdmin();
  toast("Tim disimpan", "success");
};

window.deleteTeam = function (id) {
  const data = getData();
  const team = data.teams.find((t) => t.id === id);
  confirmModal(
    `Hapus tim <strong>${team?.name || "ini"}</strong>? Semua jadwal yang melibatkan tim ini juga akan dihapus. Aksi tidak bisa dibatalkan.`,
    () => {
      const d = getData();
      d.teams = d.teams.filter((t) => t.id !== id);
      d.matches = d.matches.filter((m) => m.teamA !== id && m.teamB !== id);
      saveData(d);
      renderAdmin();
      toast("Tim dihapus", "success");
    },
    { title: "Hapus Tim", confirmText: "Ya, Hapus", type: "danger" }
  );
};

/* ============ SCHEDULE ============ */
function renderAdminSchedule() {
  const wrap = document.getElementById("adminSchedule");
  if (!wrap) return;
  const data = getData();
  const filterGroup = document.getElementById("scheduleFilter")?.value || "all";
  let filteredMatches = data.matches;
  if (filterGroup !== "all")
    filteredMatches = data.matches.filter((m) => m.group === filterGroup);
  if (!filteredMatches.length) {
    wrap.innerHTML =
      '<div class="empty-state">📅 Tidak ada jadwal.</div>';
    return;
  }
  wrap.innerHTML = filteredMatches
    .slice(0, 80)
    .map((m) => matchCardListHtml(m, data))
    .join("");
}

function getMatchDate(match, data) {
  const timeline = getTimeline(data);
  const entry = timeline.find((t) => t.id === "group");
  return entry ? formatDateID(entry.date) : "";
}

function formatDateID(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function matchCardListHtml(match, data) {
  const a = teamById(match.teamA, data);
  const b = teamById(match.teamB, data);
  const statusClass = match.played ? "status-done" : "status-pending";
  const statusText = match.played ? "✓ Selesai" : "⏳ Belum";
  const scoreText = match.played
    ? `${match.scoreA} - ${match.scoreB}`
    : "- : -";
  const dateStr = getMatchDate(match, data);
  return `
    <div class="match-card-list">
      <div class="match-info">
        <span class="match-group-badge">Grup ${match.group}</span>
        ${dateStr ? `<span class="match-date-badge">📅 ${dateStr}</span>` : ""}
      </div>
      <div class="match-teams">
        <div class="match-team-item"><span class="match-team-name">${a?.name || "???"}</span></div>
        <div class="match-score-badge">${scoreText}</div>
        <div class="match-team-item right"><span class="match-team-name">${b?.name || "???"}</span></div>
      </div>
      <div class="match-status"><span class="${statusClass}">${statusText}</span></div>
    </div>`;
}

/* ============================================================
   EDIT MATCHUP JADWAL GRUP
   ============================================================ */
window.openGroupMatchupEditModal = function (matchId) {
  const data = getData();
  const m = data.matches.find((x) => x.id === matchId);
  if (!m) return;

  const a = teamById(m.teamA, data);
  const b = teamById(m.teamB, data);

  const groupTeams = data.teams.filter((t) => t.group === m.group);

  const teamOptions = (currentId) =>
    groupTeams
      .map(
        (t) =>
          `<option value="${t.id}" ${t.id === currentId ? "selected" : ""}>${t.name} (${t.tag})</option>`,
      )
      .join("");

  const hasResult = m.played;

  openModal(
    `✏️ Edit Matchup — Grup ${m.group}`,
    `
    <div class="matchup-edit-wrap">
      <div class="matchup-current">
        <div class="matchup-current-label">Match Saat Ini</div>
        <div class="matchup-vs-row">
          <div class="matchup-team-box">${a?.name || "???"}<span>${a?.tag || ""}</span></div>
          <div class="matchup-vs-sep">VS</div>
          <div class="matchup-team-box">${b?.name || "???"}<span>${b?.tag || ""}</span></div>
        </div>
        ${
          hasResult
            ? `<div class="matchup-warn">⚠️ Match ini sudah punya hasil (${m.scoreA}-${m.scoreB}). Mengubah matchup akan mereset hasilnya.</div>`
            : ""
        }
      </div>
      <div class="matchup-option-card">
        <div class="matchup-option-title">🔁 Ganti Tim di Match</div>
        <div class="matchup-option-desc">Pilih tim lain dari <strong>Grup ${m.group}</strong> untuk mengisi slot pertandingan ini.</div>
        <div class="matchup-selects">
          <div>
            <label>Tim A</label>
            <select id="grpEditTeamA" class="input">${teamOptions(m.teamA)}</select>
          </div>
          <div class="matchup-vs-sep-sm">VS</div>
          <div>
            <label>Tim B</label>
            <select id="grpEditTeamB" class="input">${teamOptions(m.teamB)}</select>
          </div>
        </div>
        <div class="modal-actions" style="margin-top:14px">
          <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
          <button class="btn btn-primary" onclick="saveGroupMatchup('${matchId}')">💾 Simpan</button>
        </div>
      </div>
    </div>
  `,
  );
};

window.saveGroupMatchup = function (matchId) {
  const data = getData();
  const m = data.matches.find((x) => x.id === matchId);
  if (!m) return;

  const newA = document.getElementById("grpEditTeamA").value;
  const newB = document.getElementById("grpEditTeamB").value;

  if (!newA || !newB) {
    toast("Pilih tim untuk kedua slot", "error");
    return;
  }
  if (newA === newB) {
    toast("Tim A dan Tim B tidak boleh sama", "error");
    return;
  }

  const duplicate = data.matches.find(
    (x) =>
      x.id !== matchId &&
      x.group === m.group &&
      ((x.teamA === newA && x.teamB === newB) ||
        (x.teamA === newB && x.teamB === newA)),
  );
  if (duplicate) {
    toast("Matchup ini sudah ada di jadwal grup yang sama", "error");
    return;
  }

  const changed = newA !== m.teamA || newB !== m.teamB;
  m.teamA = newA;
  m.teamB = newB;

  if (changed && m.played) {
    m.played = false;
    m.scoreA = null;
    m.scoreB = null;
    toast(
      "Matchup diperbarui. Hasil match direset karena ada perubahan tim.",
      "warning",
    );
  } else {
    toast("Matchup jadwal grup berhasil diperbarui!", "success");
  }

  saveData(data);
  closeModal();
  renderAdmin();
};

/* ============ RESULTS ============ */
function renderAdminResults() {
  const wrap = document.getElementById("adminResults");
  if (!wrap) return;
  const data = getData();
  const filterGroup = document.getElementById("resultsFilter")?.value || "all";
  let filteredMatches = data.matches;
  if (filterGroup !== "all")
    filteredMatches = data.matches.filter((m) => m.group === filterGroup);
  if (!filteredMatches.length) {
    wrap.innerHTML =
      '<div class="empty-state">⚽ Tidak ada pertandingan.</div>';
    return;
  }
  wrap.innerHTML = filteredMatches
    .slice(0, 80)
    .map((m) => {
      const a = teamById(m.teamA, data);
      const b = teamById(m.teamB, data);
      return `
      <div class="match-card-list">
        <div class="match-info"><span class="match-group-badge">Grup ${m.group}</span></div>
        <div class="match-teams">
          <div class="match-team-item"><span class="match-team-name">${a?.name || "???"}</span></div>
          <div class="score-input-mini">
            <input type="number" min="0" max="1" value="${m.scoreA ?? ""}" id="sA-${m.id}" placeholder="0"/>
            <span>:</span>
            <input type="number" min="0" max="1" value="${m.scoreB ?? ""}" id="sB-${m.id}" placeholder="0"/>
          </div>
          <div class="match-team-item right"><span class="match-team-name">${b?.name || "???"}</span></div>
        </div>
        <div class="match-actions">
          <button class="btn btn-primary sm" onclick="saveBO1('${m.id}')">💾 Simpan</button>
        </div>
      </div>`;
    })
    .join("");
}

window.saveBO1 = function (id) {
  const data = getData();
  const m = data.matches.find((x) => x.id === id);
  const a = parseInt(document.getElementById("sA-" + id).value, 10);
  const b = parseInt(document.getElementById("sB-" + id).value, 10);
  if (isNaN(a) || isNaN(b)) {
    toast("Masukkan skor yang valid (0 atau 1)", "error");
    return;
  }
  if (![0, 1].includes(a) || ![0, 1].includes(b) || a === b) {
    toast("Skor BO1 hanya 1-0 atau 0-1", "error");
    return;
  }
  m.scoreA = a;
  m.scoreB = b;
  m.played = true;
  saveData(data);
  renderAdmin();
  toast("Hasil disimpan", "success");
};

/* ============================================================
   PATCH: renderAdminStandings
   ============================================================ */

function renderAdminStandings() {
  const wrap = document.getElementById("adminStandings");
  if (!wrap) return;
  const data = getData();

  if (!data.teams.length) {
    wrap.innerHTML =
      '<div class="empty-state">📊 Belum ada tim untuk ditampilkan.</div>';
    return;
  }

  const filterGroup =
    document.getElementById("standingsFilter")?.value || "all";
  const activeGroups = filterGroup === "all" ? GROUPS : [filterGroup];
  let html = "";
  activeGroups.forEach((g) => {
    const teams = data.teams.filter((t) => t.group === g);
    if (!teams.length) return;

    const rows = teams
      .map((t) => {
        const s = getTeamStats(t.id, data);
        return { ...t, ...s };
      })
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.wins !== a.wins) return b.wins - a.wins;
        return 0;
      });

    const isBlock1 = ["A", "B", "C", "D"].includes(g);
    const blockLabel = isBlock1 ? "6 Juni" : "7 Juni";
    const blockColor = isBlock1 ? "#3a9fff" : "#00c853";

    html += `
      <div class="standings-group-card">
        <div class="standings-group-header">
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="standings-group-badge">Grup ${g}</span>
            <span style="font-size:0.68rem;padding:2px 8px;border-radius:20px;background:${blockColor}22;color:${blockColor};font-weight:600;">
              ${blockLabel}
            </span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="standings-group-info">
              ${teams.length}/4 Tim · 
              ${data.matches.filter((m) => m.group === g && m.played).length}/${data.matches.filter((m) => m.group === g).length} Match
            </span>
            <button class="btn btn-ghost sm" onclick="openMoveTeamModal('${g}')">
              🔀 Atur Tim
            </button>
          </div>
        </div>

        <table class="standings-table" style="table-layout:fixed;width:100%;">
          <colgroup>
            <col style="width:36px">
            <col style="width:auto">
            <col style="width:36px">
            <col style="width:36px">
            <col style="width:36px">
            <col style="width:36px">
            <col style="width:52px">
          </colgroup>
          <thead>
            <tr>
              <th>#</th>
              <th style="text-align:left">Tim</th>
              <th>M</th><th>W</th><th>D</th><th>L</th>
              <th>Poin</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (t, i) => `
              <tr class="${i === 0 ? "standings-row-top" : ""}">
                <td class="standings-rank">${i + 1}</td>
                <td class="standings-team-cell">
                  <div class="standings-team-name">${t.name}</div>
                  <div class="standings-team-tag">${t.tag}</div>
                </td>
                <td>${t.played}</td>
                <td class="standings-wins">${t.wins}</td>
                <td>${t.draws}</td>
                <td class="standings-losses">${t.losses}</td>
                <td class="standings-points">${t.points}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  });

  wrap.innerHTML =
    html || '<div class="empty-state">📊 Belum ada data klasemen.</div>';
}

/* ── Modal: Atur semua tim di satu grup ── */
window.openMoveTeamModal = function (group) {
  const data = getData();
  const teams = data.teams.filter((t) => t.group === group);

  if (!teams.length) {
    toast("Tidak ada tim di grup ini.", "error");
    return;
  }

  openModal(
    `🔀 Atur Tim — Grup ${group}`,
    `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div style="padding:10px 14px;background:rgba(0,102,255,0.07);border:1px solid rgba(0,102,255,0.2);border-radius:10px;font-size:0.8rem;color:var(--text-secondary);">
        Pilih tim yang ingin dipindah ke grup lain. Perubahan akan mereset hasil match tim tersebut jika ada.
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${teams
          .map((t) => {
            const s = getTeamStats(t.id, data);
            return `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;">
              <div style="display:flex;flex-direction:column;gap:2px;">
                <span style="font-weight:700;font-size:0.9rem;color:var(--text-primary)">${t.name}</span>
                <span style="font-size:0.72rem;color:var(--text-tertiary);">${t.tag} · ${s.played}M ${s.wins}W ${s.losses}L · ${s.points >= 0 ? "+" : ""}${s.points} pts</span>
              </div>
              <button class="btn btn-ghost sm" onclick="closeModal(); openMoveSingleTeamModal('${t.id}')">
                ↗ Pindah
              </button>
            </div>
          `;
          })
          .join("")}
      </div>
    </div>
  `,
  );
};

/* ── Modal: Pindah 1 tim ke grup lain ── */
window.openMoveSingleTeamModal = function (teamId) {
  const data = getData();
  const team = data.teams.find((t) => t.id === teamId);
  if (!team) return;

  const s = getTeamStats(teamId, data);
  const hasMatches = data.matches.some(
    (m) => (m.teamA === teamId || m.teamB === teamId) && m.played,
  );

  const groupCounts = {};
  GROUPS.forEach((g) => {
    groupCounts[g] = 0;
  });
  data.teams.forEach((t) => {
    if (t.id !== teamId) groupCounts[t.group]++;
  });

  const blockColor = (g) =>
    ["A", "B", "C", "D"].includes(g)
      ? { color: "#3a9fff", label: "6 Jun" }
      : { color: "#00c853", label: "7 Jun" };

  const groupOptions = GROUPS.map((g) => {
    const count = groupCounts[g];
    const isFull = count >= 4;
    const isCurr = g === team.group;
    const bc = blockColor(g);

    return `
      <div class="move-group-option ${isCurr ? "move-group-current" : ""} ${isFull && !isCurr ? "move-group-full" : ""}"
           onclick="${isFull && !isCurr ? "" : `doMoveTeam('${teamId}', '${g}')`}"
           style="cursor:${isFull && !isCurr ? "not-allowed" : "pointer"}">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-weight:800;font-size:1rem;color:${isCurr ? "var(--blue-electric)" : "var(--text-primary)"}">Grup ${g}</span>
          <span style="font-size:0.65rem;padding:1px 7px;border-radius:20px;background:${bc.color}22;color:${bc.color};font-weight:600;">${bc.label}</span>
          ${isCurr ? `<span style="font-size:0.65rem;color:var(--blue-electric);font-weight:700;">← Saat ini</span>` : ""}
          ${isFull && !isCurr ? `<span style="font-size:0.65rem;color:#ff4444;font-weight:700;">Penuh</span>` : ""}
        </div>
        <span style="font-size:0.75rem;color:var(--text-tertiary);">${count}/4 tim</span>
      </div>
    `;
  }).join("");

  openModal(
    `↗ Pindah Tim — ${team.name}`,
    `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <div style="padding:14px 16px;background:rgba(0,102,255,0.06);border:1px solid var(--border-light);border-radius:10px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:700;font-size:1rem;color:var(--text-primary)">${team.name} <span style="font-size:0.75rem;color:var(--text-tertiary);font-family:monospace">(${team.tag})</span></div>
          <div style="font-size:0.78rem;color:var(--text-tertiary);margin-top:3px;">Grup ${team.group} · ${s.played}M ${s.wins}W ${s.losses}L · ${s.points >= 0 ? "+" : ""}${s.points} pts</div>
        </div>
      </div>
      ${
        hasMatches
          ? `
        <div style="padding:8px 12px;background:rgba(255,171,0,0.08);border:1px solid rgba(255,171,0,0.3);border-radius:8px;font-size:0.78rem;color:#ffab00;">
          ⚠️ Tim ini sudah punya hasil match. Memindahkan grup akan mereset semua hasil match tim ini.
        </div>`
          : ""
      }
      <div>
        <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-tertiary);margin-bottom:8px;">Pilih Grup Tujuan</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          ${groupOptions}
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
      </div>
    </div>
  `,
  );
};

/* ── Eksekusi pindah tim ── */
window.doMoveTeam = function (teamId, newGroup) {
  const data = getData();
  const team = data.teams.find((t) => t.id === teamId);
  if (!team) return;

  const oldGroup = team.group;
  if (oldGroup === newGroup) {
    toast("Tim sudah berada di grup ini.", "error");
    return;
  }

  const newGroupCount = data.teams.filter(
    (t) => t.group === newGroup && t.id !== teamId,
  ).length;
  if (newGroupCount >= 4) {
    toast(`Grup ${newGroup} sudah penuh (maks 4 tim).`, "error");
    return;
  }

  let resetCount = 0;
  data.matches = data.matches.filter((m) => {
    if (m.teamA === teamId || m.teamB === teamId) {
      resetCount++;
      return false;
    }
    return true;
  });

  team.group = newGroup;

  const newGroupTeams = data.teams.filter(
    (t) => t.group === newGroup && t.id !== teamId,
  );
  let mid = Date.now();
  newGroupTeams.forEach((other) => {
    data.matches.push({
      id: "m" + mid++,
      group: newGroup,
      teamA: teamId,
      teamB: other.id,
      scoreA: 0,
      scoreB: 0,
      played: false,
    });
  });

  const hadBracket = data.bracket?.r16?.length > 0;
  if (hadBracket) {
    data.bracket = { r16: [], qf: [], sf: [], bronze: [], final: [] };
  }

  saveData(data);
  closeModal();
  renderAdmin();

  let msg = `${team.name} dipindah ke Grup ${newGroup}.`;
  if (resetCount > 0)
    msg += ` ${resetCount} match lama dihapus, match baru dibuat.`;
  if (hadBracket) msg += ` Bracket direset.`;
  toast(msg, "success");
};

/* ============================================================
   BRACKET — CENTERED LEFT-RIGHT
   ============================================================ */
function renderCenteredBracket() {
  const wrap = document.getElementById("adminBracket");
  if (!wrap) return;
  const data = getData();

  if (!data.bracket || !data.bracket.r16 || data.bracket.r16.length === 0) {
    wrap.innerHTML = `<div class="empty-state" style="padding:60px;text-align:center;color:var(--text-tertiary);">
      🏆 Bracket belum di-generate.<br><small>Generate setelah semua match grup selesai.</small>
    </div>`;
    return;
  }

  const br = data.bracket;
  const r16L = br.r16.slice(0, 4);
  const r16R = br.r16.slice(4, 8);
  const qfL = br.qf.slice(0, 2);
  const qfR = br.qf.slice(2, 4);
  const sfL = br.sf.slice(0, 1);
  const sfR = br.sf.slice(1, 2);
  const bronze = br.bronze[0] || {};
  const final = br.final[0] || {};

  wrap.innerHTML = `
    <div class="bracket-col">
      <div class="bracket-col-label">Round of 16</div>
      <div class="bracket-left-r16">${r16L.map((m, i) => bracketMatchHtml(m, data, `r16-L-${i}`)).join("")}</div>
    </div>
    <div class="bracket-connector-col"></div>
    <div class="bracket-col">
      <div class="bracket-col-label">Quarter Final</div>
      <div class="bracket-left-qf">${qfL.map((m, i) => bracketMatchHtml(m, data, `qf-L-${i}`)).join("")}</div>
    </div>
    <div class="bracket-connector-col"></div>
    <div class="bracket-col">
      <div class="bracket-col-label">Semi Final</div>
      <div class="bracket-left-sf">${sfL.map((m, i) => bracketMatchHtml(m, data, `sf-L-${i}`)).join("")}</div>
    </div>
    <div class="bracket-connector-col"></div>
    <div class="bracket-center-col">
      <div class="bracket-col-label">🥉 Bronze</div>
      ${bracketMatchHtml(bronze, data, "bronze", "bronze-match")}
      <div class="bracket-col-label" style="margin-top:24px">🏆 Grand Final</div>
      ${bracketMatchHtml(final, data, "final", "final-match")}
    </div>
    <div class="bracket-connector-col"></div>
    <div class="bracket-col">
      <div class="bracket-col-label">Semi Final</div>
      <div class="bracket-right-sf">${sfR.map((m, i) => bracketMatchHtml(m, data, `sf-R-${i}`)).join("")}</div>
    </div>
    <div class="bracket-connector-col"></div>
    <div class="bracket-col">
      <div class="bracket-col-label">Quarter Final</div>
      <div class="bracket-right-qf">${qfR.map((m, i) => bracketMatchHtml(m, data, `qf-R-${i}`)).join("")}</div>
    </div>
    <div class="bracket-connector-col"></div>
    <div class="bracket-col">
      <div class="bracket-col-label">Round of 16</div>
      <div class="bracket-right-r16">${r16R.map((m, i) => bracketMatchHtml(m, data, `r16-R-${i}`)).join("")}</div>
    </div>
  `;

  wrap.querySelectorAll(".bracket-match").forEach((el) => {
    el.addEventListener("click", () => {
      const matchId = el.dataset.matchid;
      if (!matchId) return;
      if (swapModeActive) {
        openMatchupEditModal(matchId);
      } else {
        const d = getData();
        openBO3Modal(matchId, d);
      }
    });
  });
}

function bracketMatchHtml(m, data, key, extraClass = "") {
  if (!m || !m.id)
    return `<div class="bracket-match ${extraClass}" style="opacity:0.3">
    <div class="bracket-match-label">TBD</div>
    <div class="bracket-match-team"><span>—</span><span>-</span></div>
    <div class="bracket-match-team"><span>—</span><span>-</span></div>
  </div>`;

  const a = teamById(m.teamA, data);
  const b = teamById(m.teamB, data);
  const aWin = m.winner && m.winner === m.teamA;
  const bWin = m.winner && m.winner === m.teamB;

  const getLabel = () => {
    if (key.startsWith("r16")) return "Round Of 16";
    if (key.startsWith("qf")) return "Quarter Final";
    if (key.startsWith("sf")) return "Semi Final";
    if (key === "bronze") return "🥉 3rd Place";
    if (key === "final") return "🏆 Final";
    return "";
  };

  const editClass = swapModeActive ? "bracket-match-editable" : "";
  const editBadge = swapModeActive
    ? `<span class="bracket-edit-badge">✏️ Edit</span>`
    : "";

  return `
    <div class="bracket-match ${extraClass} ${editClass}" data-matchid="${m.id}">
      <div class="bracket-match-label">${getLabel()} ${editBadge}</div>
      <div class="bracket-match-team ${aWin ? "winner" : ""}">
        <span>${a?.name || (m.teamA ? "???" : "TBD")}</span>
        <span>${m.played ? m.scoreA : "-"}</span>
      </div>
      <div class="bracket-match-team ${bWin ? "winner" : ""}">
        <span>${b?.name || (m.teamB ? "???" : "TBD")}</span>
        <span>${m.played ? m.scoreB : "-"}</span>
      </div>
    </div>`;
}

/* ============================================================
   MATCHUP EDIT MODAL
   ============================================================ */
function openMatchupEditModal(matchId) {
  const data = getData();
  const all = getAllBracketMatches(data);
  const m = all.find((x) => x.id === matchId);
  if (!m) return;

  const a = teamById(m.teamA, data);
  const b = teamById(m.teamB, data);

  if (!m.teamA && !m.teamB) {
    toast(
      "Match ini belum memiliki tim (menunggu round sebelumnya)",
      "warning",
    );
    return;
  }

  const bracketTeamIds = new Set();
  all.forEach((match) => {
    if (match.teamA) bracketTeamIds.add(match.teamA);
    if (match.teamB) bracketTeamIds.add(match.teamB);
  });

  // Tim yang sudah terlibat di match yang sudah played → tidak bisa dipilih
  const playedTeamIds = new Set();
  all.forEach((match) => {
    if (match.played && match.id !== matchId) {
      if (match.teamA) playedTeamIds.add(match.teamA);
      if (match.teamB) playedTeamIds.add(match.teamB);
    }
  });

  const teamOptions = (currentId) =>
    data.teams
      .filter((t) => bracketTeamIds.has(t.id))
      .filter((t) => !playedTeamIds.has(t.id) || t.id === currentId) // sembunyikan tim dari match played
      .map(
        (t) =>
          `<option value="${t.id}" ${t.id === currentId ? "selected" : ""}>${t.name} (${t.tag})</option>`,
      )
      .join("");

  const hasResult = m.played;

  openModal(
    "✏️ Edit Matchup Bracket",
    `
    <div class="matchup-edit-wrap">
      <div class="matchup-current">
        <div class="matchup-current-label">Match Saat Ini</div>
        <div class="matchup-vs-row">
          <div class="matchup-team-box">${a?.name || "TBD"}<span>${a?.tag || ""}</span></div>
          <div class="matchup-vs-sep">VS</div>
          <div class="matchup-team-box">${b?.name || "TBD"}<span>${b?.tag || ""}</span></div>
        </div>
        ${hasResult ? `<div class="matchup-warn">⚠️ Match ini sudah punya hasil (${m.scoreA}-${m.scoreB}). Mengubah matchup akan mereset hasilnya.</div>` : ""}
      </div>
      ${m.played ? `
        <div class="matchup-option-card" style="opacity:0.5;pointer-events:none;">
          <div class="matchup-option-title">🔄 Swap Posisi Tim</div>
          <div class="matchup-warn">⚠️ Match sudah punya hasil. Tidak bisa di-swap.</div>
        </div>
        <div class="matchup-option-card" style="opacity:0.5;pointer-events:none;">
          <div class="matchup-option-title">🔁 Ganti Tim di Match</div>
          <div class="matchup-warn">⚠️ Match sudah punya hasil. Tidak bisa diedit.</div>
        </div>
      ` : `
        <div class="matchup-option-card" id="optSwapCard">
          <div class="matchup-option-title">🔄 Swap Posisi Tim</div>
          <div class="matchup-option-desc">Tukar posisi Tim A dan Tim B (Slot atas ↔ Slot bawah). Tim tidak berubah, hanya posisinya.</div>
          <button class="btn btn-primary" onclick="doSwapMatchup('${matchId}')">🔄 Swap Sekarang</button>
        </div>
        <div class="matchup-option-card" id="optEditCard">
          <div class="matchup-option-title">🔁 Ganti Tim di Match</div>
          <div class="matchup-option-desc">Pilih tim yang akan mengisi setiap slot. Tim dipilih dari tim yang sudah ada di bracket.</div>
          <div class="matchup-selects">
            <div>
              <label>Slot Atas (Tim A)</label>
              <select id="editTeamA" class="input">${teamOptions(m.teamA)}</select>
            </div>
            <div class="matchup-vs-sep-sm">VS</div>
            <div>
              <label>Slot Bawah (Tim B)</label>
              <select id="editTeamB" class="input">${teamOptions(m.teamB)}</select>
            </div>
          </div>
          <div class="modal-actions" style="margin-top:14px">
            <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
            <button class="btn btn-primary" onclick="doEditMatchup('${matchId}')">💾 Simpan Perubahan</button>
          </div>
        </div>
      `}
    </div>
  `,
  );
}

window.doSwapMatchup = function (matchId) {
  const data = getData();
  const all = getAllBracketMatches(data);
  const m = all.find((x) => x.id === matchId);
  if (!m) return;

  const tmpTeam = m.teamA;
  const tmpScore = m.scoreA;
  m.teamA = m.teamB;
  m.scoreA = m.scoreB;
  m.teamB = tmpTeam;
  m.scoreB = tmpScore;

  if (m.played) {
    m.played = false;
    m.scoreA = null;
    m.scoreB = null;
    m.winner = null;
    toast(
      "Posisi ditukar. Hasil match direset karena ada perubahan matchup.",
      "warning",
    );
  } else {
    toast(`Posisi berhasil ditukar!`, "success");
  }

  saveData(data);
  closeModal();
  renderCenteredBracket();
};

window.doEditMatchup = function (matchId) {
  const data = getData();
  const all = getAllBracketMatches(data);
  const m = all.find((x) => x.id === matchId);
  if (!m) return;

  if (m.played) {
    toast("Match ini sudah punya hasil dan tidak bisa diedit.", "error");
    return;
  }

  const newA = document.getElementById("editTeamA").value;
  const newB = document.getElementById("editTeamB").value;

  if (!newA || !newB) { toast("Pilih tim untuk kedua slot", "error"); return; }
  if (newA === newB) { toast("Tim A dan Tim B tidak boleh sama", "error"); return; }

  // Cari tim lama yang akan digantikan
  const oldA = m.teamA;
  const oldB = m.teamB;

  // Jika Tim A diganti, tukar posisi tim lama ke match asal tim baru
  if (newA !== oldA) {
    const donorMatch = all.find((x) => x.id !== matchId && (x.teamA === newA || x.teamB === newA));
    if (donorMatch) {
      if (donorMatch.teamA === newA) donorMatch.teamA = oldA;
      else donorMatch.teamB = oldA;
      // Reset hasil donor match jika sudah dimainkan
      if (donorMatch.played) {
        donorMatch.played = false; donorMatch.scoreA = null;
        donorMatch.scoreB = null; donorMatch.winner = null;
      }
    }
  }

  if (newB !== oldB) {
    const donorMatch = all.find((x) => x.id !== matchId && (x.teamA === newB || x.teamB === newB));
    if (donorMatch) {
      if (donorMatch.teamA === newB) donorMatch.teamA = oldB;
      else donorMatch.teamB = oldB;
      if (donorMatch.played) {
        donorMatch.played = false; donorMatch.scoreA = null;
        donorMatch.scoreB = null; donorMatch.winner = null;
      }
    }
  }

  m.teamA = newA;
  m.teamB = newB;

  if (m.played) {
    m.played = false; m.scoreA = null; m.scoreB = null; m.winner = null;
    toast("Matchup diperbarui. Hasil match direset.", "warning");
  } else {
    toast("Matchup berhasil diperbarui!", "success");
  }

  saveData(data);
  closeModal();
  renderCenteredBracket();
};

function getAllBracketMatches(data) {
  return [
    ...(data.bracket?.r16 || []),
    ...(data.bracket?.qf || []),
    ...(data.bracket?.sf || []),
    ...(data.bracket?.bronze || []),
    ...(data.bracket?.final || []),
  ];
}

/* ============ BO3 MODAL ============ */
function openBO3Modal(matchId, data) {
  if (!data) data = getData();
  const all = getAllBracketMatches(data);
  const m = all.find((x) => x.id === matchId);
  if (!m) return;
  if (!m.teamA || !m.teamB) {
    toast("Tim belum tersedia (menunggu round sebelumnya)", "warning");
    return;
  }

  const a = teamById(m.teamA, data);
  const b = teamById(m.teamB, data);

  openModal(
    "Input Skor BO3",
    `
    <p class="muted" style="margin-bottom:12px">Format: First to 2 wins. Skor valid: 2-0, 2-1, 0-2, 1-2.</p>
    <div class="score-input">
      <div style="text-align:center"><b>${a?.name || "???"}</b></div>
      <input type="number" min="0" max="2" value="${m.scoreA || 0}" id="bo3A"/>
      <span class="vs-mid">:</span>
      <input type="number" min="0" max="2" value="${m.scoreB || 0}" id="bo3B"/>
      <div style="text-align:center"><b>${b?.name || "???"}</b></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="saveBO3('${m.id}')">💾 Simpan</button>
    </div>
  `,
  );
}

window.saveBO3 = function (matchId) {
  const data = getData();
  const all = getAllBracketMatches(data);
  const m = all.find((x) => x.id === matchId);
  const a = parseInt(document.getElementById("bo3A").value, 10);
  const b = parseInt(document.getElementById("bo3B").value, 10);
  const valid = [
    [2, 0],
    [2, 1],
    [0, 2],
    [1, 2],
  ].some((p) => p[0] === a && p[1] === b);
  if (!valid) {
    toast("Skor BO3 tidak valid (2-0, 2-1, 0-2, 1-2)", "error");
    return;
  }
  m.scoreA = a;
  m.scoreB = b;
  m.winner = a > b ? m.teamA : m.teamB;
  m.played = true;
  advanceBracket(data);
  saveData(data);
  closeModal();
  renderAdmin();
  toast("Hasil BO3 tersimpan", "success");
};

/* ============ BRACKET GENERATION ============ */
function generateBracket() {
  const data = getData();
  const allPlayed = data.matches.every((m) => m.played);
  if (!allPlayed) {
    confirmModal(
      "Belum semua match grup selesai. Tetap generate bracket sekarang?",
      () => {
        data.bracket = buildBracketFromStandings(data);
        saveData(data);
        renderAdmin();
        toast("Bracket playoff berhasil di-generate", "success");
        switchTab("playoff");
      },
      { title: "Generate Bracket", confirmText: "Ya, Generate", type: "warning" }
    );
  } else {
    data.bracket = buildBracketFromStandings(data);
    saveData(data);
    renderAdmin();
    toast("Bracket playoff berhasil di-generate", "success");
    switchTab("playoff");
  }
}

/* ============ TIMELINE ============ */
function getTimeline(data) {
  return data?.timeline || DEFAULT_TIMELINE;
}

function renderTimelineEditor() {
  const wrap = document.getElementById("timelineEditor");
  if (!wrap) return;
  const data = getData();
  const timeline = getTimeline(data);

  wrap.innerHTML = `
    <div class="timeline-editor-fields">
      ${timeline
        .map(
          (stage) => `
        <div class="timeline-stage-card">
          <div class="timeline-stage-icon ${stage.cssClass}">${stage.icon}</div>
          <div class="timeline-stage-info">
            <div class="timeline-stage-name">${stage.label}</div>
            <div class="timeline-stage-desc">${stage.desc}</div>
          </div>
          <div class="timeline-stage-date-wrap">
            <label>Tanggal</label>
            <input type="date" class="timeline-date-input" data-id="${stage.id}" value="${stage.date}"/>
          </div>
        </div>
      `,
        )
        .join("")}
    </div>
    <div class="timeline-preview">
      <h4>📋 Preview Timeline</h4>
      <div class="timeline-track">
        ${timeline
          .map(
            (stage) => `
          <div class="timeline-track-item">
            <div class="timeline-track-dot">${stage.icon}</div>
            <div class="timeline-track-content">
              <div class="timeline-track-date">${formatDateID(stage.date)}</div>
              <div class="timeline-track-stage">${stage.label}</div>
              <div class="timeline-track-desc">${stage.desc}</div>
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    </div>
  `;

  wrap.querySelectorAll(".timeline-date-input").forEach((input) => {
    input.addEventListener("change", () => {
      const data2 = getData();
      const tl = getTimeline(data2);
      const idx = tl.findIndex((t) => t.id === input.dataset.id);
      if (idx !== -1) {
        const tempTl = tl.map((t) => ({ ...t }));
        tempTl[idx].date = input.value;
        const preview = wrap.querySelector(".timeline-track");
        if (preview) {
          preview.innerHTML = tempTl
            .map(
              (stage) => `
            <div class="timeline-track-item">
              <div class="timeline-track-dot">${stage.icon}</div>
              <div class="timeline-track-content">
                <div class="timeline-track-date">${formatDateID(stage.date)}</div>
                <div class="timeline-track-stage">${stage.label}</div>
                <div class="timeline-track-desc">${stage.desc}</div>
              </div>
            </div>
          `,
            )
            .join("");
        }
      }
    });
  });
}

function saveTimeline() {
  const data = getData();
  const inputs = document.querySelectorAll(".timeline-date-input");
  const tl = getTimeline(data).map((stage) => ({ ...stage }));
  inputs.forEach((input) => {
    const idx = tl.findIndex((t) => t.id === input.dataset.id);
    if (idx !== -1) tl[idx].date = input.value;
  });
  data.timeline = tl;
  saveData(data);
  renderAdmin();
  toast("Timeline berhasil disimpan", "success");
}

/* ============ RESET & SIMULATE ============ */
function resetAll() {
  confirmModal(
    "Reset <strong>SEMUA</strong> data turnamen? Tim, jadwal, hasil, dan bracket akan dihapus permanen. Aksi ini tidak bisa dibatalkan.",
    () => {
      const emptyData = {
        teams: [], matches: [],
        bracket: { r16:[], qf:[], sf:[], bronze:[], final:[] },
        timeline: DEFAULT_TIMELINE.map(t => ({...t}))
      };
      saveData(emptyData);
      renderAdmin();
      toast("Data direset. Mulai tambahkan tim baru.", "success");
    },
    { title: "Reset Semua Data", confirmText: "Ya, Reset Semua", type: "danger" }
  );
}

function simulateAll() {
  confirmModal(
    "Simulasikan seluruh turnamen secara acak? Semua data yang ada akan ditimpa.",
    () => {
      const data = getData();

      if (!data.teams.length) {
        toast("Tidak ada tim. Tambah tim terlebih dahulu.", "error");
        return;
      }

      const activeGroups = [...new Set(data.teams.map((t) => t.group))];
      if (activeGroups.length < 2) {
        toast("Minimal butuh tim di 2 grup berbeda untuk generate bracket.", "error");
        return;
      }

      if (!data.matches.length) {
        data.matches = generateGroupSchedule(data.teams);
      }

      data.matches.forEach((m) => {
        if (Math.random() > 0.5) {
          m.scoreA = 1; m.scoreB = 0;
        } else {
          m.scoreA = 0; m.scoreB = 1;
        }
        m.played = true;
      });

      data.bracket = buildBracketFromStandings(data);

      const hasTeams = data.bracket.r16?.some((m) => m.teamA || m.teamB);
      if (!hasTeams) {
        toast("Bracket tidak bisa dibentuk. Pastikan tiap grup punya minimal 1 tim.", "error");
        saveData(data);
        renderAdmin();
        return;
      }

      const simulateRound = (round) => {
        round.forEach((m) => {
          if (!m.teamA || !m.teamB) return;
          if (Math.random() > 0.5) {
            m.scoreA = 2;
            m.scoreB = Math.random() > 0.5 ? 1 : 0;
            m.winner = m.teamA;
          } else {
            m.scoreB = 2;
            m.scoreA = Math.random() > 0.5 ? 1 : 0;
            m.winner = m.teamB;
          }
          m.played = true;
        });
      };

      simulateRound(data.bracket.r16);
      advanceBracket(data);
      simulateRound(data.bracket.qf);
      advanceBracket(data);
      simulateRound(data.bracket.sf);
      advanceBracket(data);
      simulateRound(data.bracket.bronze);
      simulateRound(data.bracket.final);

      saveData(data);
      renderAdmin();
      toast("Turnamen berhasil disimulasikan! 🎉", "success");
    },
    { title: "Simulasi Turnamen", confirmText: "Ya, Simulasikan", type: "warning" }
  );
}

/* ============ STATS HELPER ============ */
function getTeamStats(teamId, data) {
  let wins = 0, draws = 0, losses = 0, points = 0, played = 0;
  data.matches.forEach((match) => {
    if (match.played && (match.teamA === teamId || match.teamB === teamId)) {
      played++;
      const isA = match.teamA === teamId;
      const ts = isA ? match.scoreA : match.scoreB;
      const os = isA ? match.scoreB : match.scoreA;
      if (ts > os) {
        wins++;
        points += 1;
      } else if (ts === os) {
        draws++;
      } else {
        losses++;
        points -= 1;
      }
    }
  });
  return { wins, draws, losses, points, played };
}

/* ============ EXPORT ============ */
function exportToWord() {
  const data = getData();
  const html = generateExportHTML(data, "word");
  const fullDoc = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-com:office:word"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="UTF-8"/>
      <meta name="ProgId" content="Word.Document"/>
      <meta name="Generator" content="Microsoft Word 15"/>
      <meta name="Originator" content="Microsoft Word 15"/>
      <!--[if gte mso 9]>
      <xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml>
      <![endif]-->
      <style>
        @page { size: A4; margin: 2cm; }
        body { font-family: Arial, sans-serif; font-size: 11pt; color: #1a1a1a; line-height: 1.5; }
        h1 { font-size: 18pt; font-weight: bold; text-align: center; color: #0066cc; margin: 0 0 6pt; border-bottom: 2pt solid #0066cc; padding-bottom: 6pt; }
        h2 { font-size: 14pt; font-weight: bold; color: #0055aa; margin: 16pt 0 6pt; border-bottom: 1pt solid #0055aa; padding-bottom: 3pt; }
        h3 { font-size: 12pt; font-weight: bold; color: #333; margin: 12pt 0 4pt; }
        p { margin: 3pt 0; font-size: 10pt; color: #555; }
        .subtitle { text-align: center; font-size: 10pt; color: #666; margin-bottom: 12pt; }
        table { width: 100%; border-collapse: collapse; margin: 6pt 0 12pt; font-size: 10pt; }
        th { background-color: #0066cc; color: white; padding: 6pt 8pt; text-align: left; font-weight: bold; border: 1pt solid #0055aa; }
        td { padding: 5pt 8pt; border: 1pt solid #cccccc; vertical-align: middle; }
        tr:nth-child(even) { background-color: #f5f8ff; }
        .rank-1 { background-color: #fff9e6 !important; font-weight: bold; }
        .winner-cell { background-color: #e6f4ea !important; font-weight: bold; color: #1a7a35; }
        .champion-row td { background-color: #fff3cd !important; font-weight: bold; color: #856404; }
        .center { text-align: center; }
      </style>
    </head>
    <body>${html}</body>
    </html>`;

  const blob = new Blob([fullDoc], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `EXPLORA-Tournament-ML-Report-${new Date().toISOString().slice(0, 10)}.doc`;
  a.click();
  URL.revokeObjectURL(url);
  toast("Export Word berhasil! ✅", "success");
}

function exportToPDF() {
  const data = getData();
  const html = generateExportHTML(data, "pdf");
  const printWindow = window.open("", "_blank");
  printWindow.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <title>EXPLORA Tournament ML Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4; margin: 1.8cm 2cm; }
    body { font-family: Arial, sans-serif; font-size: 10.5pt; color: #1a1a1a; line-height: 1.5; background: white; }
    .report-header { text-align: center; padding-bottom: 14pt; border-bottom: 2.5pt solid #0066cc; margin-bottom: 18pt; }
    .report-title { font-size: 20pt; font-weight: bold; color: #0066cc; letter-spacing: 1px; margin-bottom: 4pt; }
    .report-subtitle { font-size: 10pt; color: #666; }
    h2 { font-size: 13pt; font-weight: bold; color: white; background: #0066cc; padding: 5pt 10pt; margin: 18pt 0 8pt; border-radius: 3pt; }
    h3 { font-size: 11pt; font-weight: bold; color: #0055aa; margin: 12pt 0 5pt; padding-bottom: 2pt; border-bottom: 1pt solid #cce0ff; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14pt; font-size: 9.5pt; }
    thead tr { background: #0066cc; }
    th { color: white; padding: 5pt 7pt; text-align: left; font-weight: bold; border: 0.5pt solid #0055aa; font-size: 9pt; }
    td { padding: 4.5pt 7pt; border: 0.5pt solid #d0d8e8; vertical-align: middle; }
    tbody tr:nth-child(even) { background: #f4f8ff; }
    tbody tr:nth-child(odd) { background: #ffffff; }
    .rank-1 td { background: #fffbea !important; font-weight: bold; }
    .winner-cell { color: #1a7a35 !important; font-weight: bold !important; }
    .champion-row td { background: #fff3cd !important; font-weight: bold; }
    .center { text-align: center; }
    .score-cell { text-align: center; font-weight: bold; font-family: monospace; }
    .page-break { page-break-before: always; }
    .report-footer { margin-top: 24pt; padding-top: 8pt; border-top: 1pt solid #ccc; text-align: center; font-size: 8.5pt; color: #999; }
    @media print {
      h2 { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      thead tr { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .rank-1 td, .champion-row td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
${html}
<div class="report-footer">
  Dokumen ini dibuat otomatis oleh EXPLORA Tournament System &nbsp;·&nbsp; ${new Date().toLocaleString("id-ID")}
</div>
</body>
</html>`);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 500);
  toast('Silakan pilih "Save as PDF" di dialog print ✅', "success");
}

function generateExportHTML(data, mode = "pdf") {
  const settings = getSettings();
  const tournamentName = settings?.tournamentName || "EXPLORA Tournament";
  const tl = getTimeline(data);

  const groups = {};
  GROUPS.forEach((g) => { groups[g] = []; });
  data.teams.forEach((t) => {
    if (groups[t.group]) groups[t.group].push(t);
  });
  Object.keys(groups).forEach((g) => {
    groups[g].sort((a, b) => {
      const sa = getTeamStats(a.id, data);
      const sb = getTeamStats(b.id, data);
      if (sb.points !== sa.points) return sb.points - sa.points;
      return sb.wins - sa.wins;
    });
  });

  let html = "";

  html += `
    <div class="report-header">
      <div class="report-title">🏆 ${tournamentName} — TOURNAMENT REPORT 🏆</div>
      <div class="report-subtitle">Dibuat: ${new Date().toLocaleString("id-ID")}</div>
    </div>`;

  html += `<h2>🗓️ TIMELINE TURNAMEN</h2>
    <table class="timeline-table">
      <thead><tr><th>Tanggal</th><th>Tahap</th><th>Keterangan</th></tr></thead>
      <tbody>`;
  tl.forEach((s) => {
    html += `<tr><td>${formatDateID(s.date)}</td><td>${s.icon} ${s.label}</td><td>${s.desc}</td></tr>`;
  });
  html += `</tbody></table>`;

  html += `<div class="${mode === "pdf" ? "page-break" : ""}"></div>`;
  html += `<h2>📊 KLASEMEN GRUP</h2>
    <p class="section-note">Sistem Poin: Menang = +1 &nbsp;|&nbsp; Seri = 0 &nbsp;|&nbsp; Kalah = -1.</p>`;

  for (const g of GROUPS) {
    if (!groups[g].length) continue;
    const isBlock1 = ["A", "B", "C", "D"].includes(g);
    html += `<h3>Grup ${g} &nbsp;<small style="font-weight:normal;font-size:9pt;color:#888;">${isBlock1 ? "(Blok 1)" : "(Blok 2)"}</small></h3>
      <table class="standings-table">
        <thead><tr><th>#</th><th>Tim</th><th>Tag</th><th>M</th><th>W</th><th>D</th><th>L</th><th>Poin</th></tr></thead>
        <tbody>`;
    groups[g].forEach((t, i) => {
      const s = getTeamStats(t.id, data);
      html += `<tr class="${i === 0 ? "rank-1" : ""}">
        <td>${i + 1}</td><td>${t.name}</td><td><code>${t.tag}</code></td>
        <td>${s.played}</td><td>${s.wins}</td><td>${s.draws}</td><td>${s.losses}</td>
        <td><b>${s.points}</b></td>
      </tr>`;
    });
    html += `</tbody></table>`;
  }

  if (data.bracket?.r16?.length) {
    html += `<div class="${mode === "pdf" ? "page-break" : ""}"></div>`;
    html += `<h2>🏆 PLAYOFF BRACKET (BO3)</h2>`;

    const rounds = [
      { key: "r16", label: "Round of 16", icon: "⚡" },
      { key: "qf", label: "Quarter Finals", icon: "🔥" },
      { key: "sf", label: "Semi Finals", icon: "🏅" },
      { key: "bronze", label: "Perebutan Juara 3", icon: "🥉" },
      { key: "final", label: "Grand Final", icon: "🏆" },
    ];

    rounds.forEach((r) => {
      const matches = data.bracket[r.key] || [];
      if (!matches.some((m) => m.teamA || m.teamB)) return;
      html += `<h3>${r.icon} ${r.label}</h3>
        <table class="bracket-table">
          <thead><tr><th>Tim A</th><th>Skor</th><th>Tim B</th><th>Pemenang</th></tr></thead>
          <tbody>`;
      matches.forEach((m) => {
        if (!m.teamA && !m.teamB) return;
        const a = teamById(m.teamA, data);
        const b = teamById(m.teamB, data);
        const w = teamById(m.winner, data);
        const isFinal = r.key === "final";
        html += `<tr${isFinal ? ' class="champion-row"' : ""}>
          <td>${a?.name || "TBD"}</td>
          <td class="score-cell">${m.played ? `${m.scoreA} - ${m.scoreB}` : "-"}</td>
          <td>${b?.name || "TBD"}</td>
          <td class="winner-cell">${w?.name || (m.played ? "-" : "Belum dimainkan")}</td>
        </tr>`;
      });
      html += `</tbody></table>`;
    });

    const finalMatch = data.bracket.final?.[0];
    const bronzeMatch = data.bracket.bronze?.[0];
    if (finalMatch?.played && finalMatch?.winner) {
      const champ = teamById(finalMatch.winner, data);
      const runnerUp = teamById(finalMatch.winner === finalMatch.teamA ? finalMatch.teamB : finalMatch.teamA, data);
      const third = bronzeMatch?.played ? teamById(bronzeMatch.winner, data) : null;
      const fourth = bronzeMatch?.played ? teamById(bronzeMatch.winner === bronzeMatch.teamA ? bronzeMatch.teamB : bronzeMatch.teamA, data) : null;

      html += `<h3>🏅 Hasil Akhir</h3>
        <table>
          <thead><tr><th>Peringkat</th><th>Tim</th><th>Tag</th></tr></thead>
          <tbody>
            <tr class="champion-row"><td>🥇 Juara 1</td><td>${champ?.name || "-"}</td><td><code>${champ?.tag || "-"}</code></td></tr>
            <tr><td>🥈 Juara 2</td><td>${runnerUp?.name || "-"}</td><td><code>${runnerUp?.tag || "-"}</code></td></tr>
            ${third ? `<tr><td>🥉 Juara 3</td><td>${third.name}</td><td><code>${third.tag}</code></td></tr>` : ""}
            ${fourth ? `<tr><td>🏅 Juara 4</td><td>${fourth.name}</td><td><code>${fourth.tag}</code></td></tr>` : ""}
          </tbody>
        </table>`;
    }
  }

  return html;
}

/* ============ SCHEDULE REGENERATE ============ */
function regenerateSchedule() {
  confirmModal(
    "Generate ulang jadwal grup? Semua skor yang sudah diinput akan hilang.",
    () => {
      const data = getData();
      if (!data.teams.length) {
        toast("Tidak ada tim. Tambah tim terlebih dahulu.", "error");
        return;
      }
      data.matches = generateGroupSchedule(data.teams);
      saveData(data);
      renderAdmin();
      toast("Jadwal grup berhasil di-generate", "success");
    },
    { title: "Generate Ulang Jadwal", confirmText: "Ya, Generate Ulang", type: "warning" }
  );
}

/* ============ IMPORT ============ */
function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = "";

  const ext = file.name.split(".").pop().toLowerCase();

  if (ext === "xlsx" || ext === "xls") {
    importFromExcel(file);
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.teams || !data.matches) throw new Error("Invalid");
      saveData(data);
      renderAdmin();
      toast("Data berhasil diimport dari JSON", "success");
    } catch {
      toast("File JSON tidak valid", "error");
    }
  };
  reader.readAsText(file);
}

/* ============================================================
   IMPORT DARI EXCEL
   ============================================================ */
function generateTag(name) {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].substring(0, 5).toUpperCase();
  const first = words[0].toUpperCase();
  const initials = words.slice(1).map((w) => w[0]?.toUpperCase() || "").join("");
  const raw = (first + initials).replace(/[^A-Z0-9]/g, "");
  return raw.substring(0, 6);
}

function uniqueTag(tag, usedTags) {
  let candidate = tag;
  let counter = 2;
  while (usedTags.has(candidate)) {
    candidate = tag.substring(0, 4) + counter;
    counter++;
  }
  usedTags.add(candidate);
  return candidate;
}

function autoAssignGroups(entries) {
  const maxPerGroup = 4;
  const BLOCK_1 = ["A", "B", "C", "D"];
  const BLOCK_2 = ["E", "F", "G", "H"];

  const groupSlots = {};
  [...BLOCK_1, ...BLOCK_2].forEach((g) => { groupSlots[g] = 0; });

  let noEmailIdx = 0;

  const emailBuckets = {};
  entries.forEach((e) => {
    let em = (e.email || "").toLowerCase().trim();
    if (!em) em = "__no_email__" + noEmailIdx++;
    if (!emailBuckets[em]) emailBuckets[em] = [];
    emailBuckets[em].push(e);
  });

  const bucketList = Object.entries(emailBuckets).sort(([, a], [, b]) => b.length - a.length);

  bucketList.forEach(([email, bucket]) => {
    const usedGroups = [];
    bucket.forEach((entry, slotIndex) => {
      const targetBlock = slotIndex % 2 === 0 ? BLOCK_1 : BLOCK_2;
      const usedSet = new Set(usedGroups);

      let picked = targetBlock.find((g) => groupSlots[g] < maxPerGroup && !usedSet.has(g));

      if (!picked) {
        const otherBlock = targetBlock === BLOCK_1 ? BLOCK_2 : BLOCK_1;
        picked = otherBlock.find((g) => groupSlots[g] < maxPerGroup && !usedSet.has(g));
      }

      if (!picked) {
        picked = [...BLOCK_1, ...BLOCK_2]
          .filter((g) => groupSlots[g] < maxPerGroup)
          .reduce((best, g) => best === null || groupSlots[g] < groupSlots[best] ? g : best, null);
      }

      if (!picked) {
        picked = [...BLOCK_1, ...BLOCK_2].reduce(
          (best, g) => (groupSlots[g] < groupSlots[best] ? g : best), "A"
        );
      }

      entry.assignedGroup = picked;
      groupSlots[picked]++;
      usedGroups.push(picked);
    });
  });

  return entries;
}

function importFromExcel(file) {
  if (typeof XLSX === "undefined") {
    toast("Library Excel belum dimuat. Pastikan SheetJS sudah di-include.", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const wb = XLSX.read(ev.target.result, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

      if (!rows.length) { toast("File Excel kosong", "error"); return; }

      const header = rows[0].map((h) => String(h).trim());
      const nameColIdx = header.findIndex((h) => h.toLowerCase() === "nama tim");
      const emailColIdx = header.findIndex((h) => h.toLowerCase() === "email address");

      if (nameColIdx === -1) {
        toast('Kolom "Nama Tim" tidak ditemukan. Pastikan header kolom sudah benar.', "error");
        return;
      }

      const rawEntries = rows.slice(1)
        .map((r) => ({
          name: String(r[nameColIdx] || "").trim(),
          email: emailColIdx !== -1 ? String(r[emailColIdx] || "").trim().toLowerCase() : "",
        }))
        .filter((e) => e.name.length > 0);

      if (!rawEntries.length) { toast("Tidak ada data tim ditemukan", "error"); return; }

      const usedTags = new Set();
      rawEntries.forEach((e) => { e.tag = uniqueTag(generateTag(e.name), usedTags); });

      const assigned = autoAssignGroups(rawEntries);
      openImportPreviewModal(assigned, file.name, emailColIdx !== -1);
    } catch (err) {
      console.error(err);
      toast("Gagal membaca file Excel. Pastikan format file benar.", "error");
    }
  };
  reader.readAsArrayBuffer(file);
}

function openImportPreviewModal(entries, fileName, hasEmail) {
  const emailMap = {};
  entries.forEach((e) => {
    const em = (e.email || "").toLowerCase().trim();
    if (!em) return;
    if (!emailMap[em]) emailMap[em] = [];
    emailMap[em].push(e);
  });
  const multiSlotEmails = Object.entries(emailMap).filter(([, teams]) => teams.length > 1);

  const activeGroupSet = new Set(entries.map((e) => e.assignedGroup));
  const activeGroupCount = activeGroupSet.size;

  const blockColor = (g) =>
    ["A", "B", "C", "D"].includes(g)
      ? { bg: "rgba(0,102,255,0.15)", text: "#3a9fff" }
      : { bg: "rgba(0,200,100,0.15)", text: "#00c853" };

  openModal(
    "📥 Preview Import Tim dari Excel",
    `
    <div class="import-preview-wrap">
      <div class="import-summary">
        <div class="import-summary-item">
          <span class="import-summary-val">${entries.length}</span>
          <span class="import-summary-lbl">Tim ditemukan</span>
        </div>
        <div class="import-summary-item">
          <span class="import-summary-val">${activeGroupCount}</span>
          <span class="import-summary-lbl">Grup aktif</span>
        </div>
        <div class="import-summary-item ${multiSlotEmails.length ? "warn" : ""}">
          <span class="import-summary-val">${multiSlotEmails.length}</span>
          <span class="import-summary-lbl">Email multi-slot</span>
        </div>
      </div>
      <div class="import-info-box">
        ✅ <strong>Tag & Grup sudah di-generate otomatis.</strong><br>
        ${hasEmail ? `Tim dari email yang sama dipisah ke <strong>grup yang berbeda</strong>.` : `⚠️ Kolom Email tidak ditemukan — grup di-assign round-robin.`}
        <br>Anda tetap bisa edit manual via ✏️ Edit Tim setelah import.
      </div>
      ${multiSlotEmails.length ? `
        <div style="background:rgba(255,171,0,0.06);border:1px solid rgba(255,171,0,0.25);border-radius:10px;padding:14px 16px;">
          <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#ffab00;margin-bottom:10px;">📧 Pendaftar Multi-Slot</div>
          ${multiSlotEmails.map(([email, teams]) => `
            <div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <div style="font-size:0.78rem;color:var(--text-tertiary);margin-bottom:6px;">📨 ${email}</div>
              <div style="display:flex;flex-wrap:wrap;gap:6px;">
                ${teams.map((t) => {
                  const bc = blockColor(t.assignedGroup);
                  return `<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:20px;background:${bc.bg};font-size:0.78rem;">
                    <span style="font-weight:700;color:var(--text-primary)">${t.name}</span>
                    <span style="color:${bc.text};font-size:0.68rem;font-weight:700;">Grup ${t.assignedGroup}</span>
                  </span>`;
                }).join("")}
              </div>
            </div>
          `).join("")}
        </div>` : ""}
      <div class="import-preview-list">
        <div style="font-size:0.72rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">
          Daftar Tim (${entries.length})
        </div>
        <div class="import-preview-scroll">
          ${entries.map((e, i) => {
            const bc = blockColor(e.assignedGroup);
            return `
            <div class="import-preview-row">
              <span class="import-preview-num">${i + 1}</span>
              <span class="import-preview-name">${e.name}</span>
              <span style="padding:2px 10px;border-radius:20px;font-size:0.7rem;font-weight:700;background:${bc.bg};color:${bc.text};">
                Grup ${e.assignedGroup}
              </span>
              ${e.email ? `<span style="font-size:0.68rem;color:var(--text-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px;" title="${e.email}">${e.email}</span>` : ""}
            </div>`;
          }).join("")}
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-primary" onclick="confirmImportTeams(${JSON.stringify(entries).replace(/"/g, "&quot;")})">
          ✅ Import ${entries.length} Tim
        </button>
      </div>
    </div>
  `,
  );
}

window.confirmImportTeams = function (entries) {
  const data = getData();
  data.teams = entries.map((e, i) => ({
    id: "t" + Date.now() + i,
    name: e.name,
    tag: e.tag,
    group: e.assignedGroup,
    logoColor: LOGO_COLORS[i % LOGO_COLORS.length],
  }));
  data.matches = [];
  data.bracket = { r16: [], qf: [], sf: [], bronze: [], final: [] };
  saveData(data);
  closeModal();
  switchTab("teams");
  renderAdmin();
  toast(`✅ ${entries.length} tim berhasil diimport dengan Tag & Grup otomatis!`, "success");
};

/* ============ MODAL ============ */
function openModal(title, html) {
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").innerHTML = html;
  document.getElementById("modalOverlay").classList.remove("hidden");
}

window.closeModal = function () {
  document.getElementById("modalOverlay").classList.add("hidden");
};

/* ============ SETTINGS ============ */
function getSettings() {
  try {
    const s = localStorage.getItem("mlwc_settings");
    if (s) return JSON.parse(s);
  } catch (e) {}
  return { tournamentName: "EXPLORA", logoDataUrl: "", maxTeamsPerGroup: 4 };
}

function saveSettingsToStorage(settings) {
  localStorage.setItem("mlwc_settings", JSON.stringify(settings));
}

function getMaxTeamsPerGroup() {
  return getSettings().maxTeamsPerGroup || 4;
}

function applyTournamentName(name) {
  document.title = name + " Admin Dashboard";
}

function applyLogo(dataUrl) {
  if (!dataUrl) return;
  const loginLogo = document.getElementById("loginLogoImg");
  const sidebarLogo = document.getElementById("sidebarLogoImg");
  if (loginLogo) loginLogo.src = dataUrl;
  if (sidebarLogo) sidebarLogo.src = dataUrl;
}

async function initSettingsOnLoad() {
  const settings = await getSettingsAsync();
  saveSettingsToStorage(settings);
  applyTournamentName(settings.tournamentName);
  if (settings.logoDataUrl) applyLogo(settings.logoDataUrl);
}

async function renderSettingsTab() {
  const settings = await getSettingsAsync();
  saveSettingsToStorage(settings);
  const creds = await getAdminCredentialsAsync();

  const nameInput = document.getElementById("settingTournamentName");
  if (nameInput) nameInput.value = settings.tournamentName || "EXPLORA";

  const preview = document.getElementById("logoPreview");
  const placeholder = document.getElementById("logoPlaceholder");
  const removeBtn = document.getElementById("logoRemoveBtn");
  if (preview && placeholder && removeBtn) {
    if (settings.logoDataUrl) {
      preview.src = settings.logoDataUrl;
      preview.classList.remove("hidden");
      placeholder.classList.add("hidden");
      removeBtn.style.display = "inline-flex";
    } else {
      preview.classList.add("hidden");
      placeholder.classList.remove("hidden");
      removeBtn.style.display = "none";
    }
  }

  const maxDisplay = document.getElementById("maxTeamsDisplay");
  if (maxDisplay) maxDisplay.textContent = settings.maxTeamsPerGroup || 4;

  const userDisplay = document.getElementById("currentUserDisplay");
  if (userDisplay) userDisplay.textContent = creds.user;

  const logoArea = document.getElementById("logoUploadArea");
  const logoInput = document.getElementById("logoUploadInput");
  if (logoArea && logoInput) {
    logoArea.onclick = () => logoInput.click();
    logoInput.onchange = handleLogoUpload;
  }

  const saveBtn = document.getElementById("saveSettingsBtn");
  if (saveBtn) saveBtn.onclick = saveSettings;
  const selResetBtn = document.getElementById("selectiveResetBtn");
  if (selResetBtn) selResetBtn.onclick = openSelectiveResetModal;
  const changePassBtn = document.getElementById("changePassBtn");
  if (changePassBtn) changePassBtn.onclick = openChangePassModal;
}

window.changeMaxTeams = function (delta) {
  const display = document.getElementById("maxTeamsDisplay");
  if (!display) return;
  let val = parseInt(display.textContent) + delta;
  val = Math.max(2, Math.min(8, val));
  display.textContent = val;
};

function handleLogoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    toast("Ukuran logo maksimal 2MB", "error");
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    const preview = document.getElementById("logoPreview");
    const placeholder = document.getElementById("logoPlaceholder");
    const removeBtn = document.getElementById("logoRemoveBtn");
    const logoArea = document.getElementById("logoUploadArea");
    if (preview) { preview.src = ev.target.result; preview.classList.remove("hidden"); }
    if (placeholder) placeholder.classList.add("hidden");
    if (removeBtn) removeBtn.style.display = "inline-flex";
    if (logoArea) logoArea.dataset.pendingLogo = ev.target.result;
  };
  reader.readAsDataURL(file);
}

window.removeLogo = function () {
  const preview = document.getElementById("logoPreview");
  const placeholder = document.getElementById("logoPlaceholder");
  const removeBtn = document.getElementById("logoRemoveBtn");
  const logoArea = document.getElementById("logoUploadArea");
  if (preview) { preview.src = ""; preview.classList.add("hidden"); }
  if (placeholder) placeholder.classList.remove("hidden");
  if (removeBtn) removeBtn.style.display = "none";
  if (logoArea) logoArea.dataset.pendingLogo = "";
};

async function saveSettings() {
  const settings = getSettings();
  const nameInput = document.getElementById("settingTournamentName");
  if (nameInput) settings.tournamentName = nameInput.value.trim() || "EXPLORA";
  const logoArea = document.getElementById("logoUploadArea");
  if (logoArea && logoArea.dataset.pendingLogo !== undefined) {
    settings.logoDataUrl = logoArea.dataset.pendingLogo;
  }
  const maxDisplay = document.getElementById("maxTeamsDisplay");
  if (maxDisplay) settings.maxTeamsPerGroup = parseInt(maxDisplay.textContent) || 4;
  saveSettingsToStorage(settings);
  await saveSettingsAsync(settings);
  applyTournamentName(settings.tournamentName);
  applyLogo(settings.logoDataUrl);
  toast("Pengaturan berhasil disimpan ✅", "success");
}

async function openChangePassModal() {
  const creds = await getAdminCredentialsAsync();
  openModal(
    "🔐 Ganti Username & Password",
    `
    <div class="form-grid" style="gap:16px">
      <div><label>Username Baru</label>
        <input id="newAdminUser" class="input" value="${creds.user}" placeholder="Username" autocomplete="off"/></div>
      <div><label>Password Lama</label>
        <input id="oldAdminPass" class="input" type="password" placeholder="Masukkan password saat ini"/></div>
      <div><label>Password Baru</label>
        <input id="newAdminPass" class="input" type="password" placeholder="Min. 6 karakter"/></div>
      <div><label>Konfirmasi Password Baru</label>
        <input id="confirmAdminPass" class="input" type="password" placeholder="Ulangi password baru"/></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="saveAdminPass()">💾 Simpan</button>
    </div>
  `,
  );
}

window.saveAdminPass = async function () {
  const creds = await getAdminCredentialsAsync();
  const newUser = document.getElementById("newAdminUser").value.trim();
  const oldPass = document.getElementById("oldAdminPass").value;
  const newPass = document.getElementById("newAdminPass").value;
  const confirmPass = document.getElementById("confirmAdminPass").value;
  if (!newUser) { toast("Username tidak boleh kosong", "error"); return; }
  const oldHash = await sha256(oldPass);
  if (oldHash !== creds.passHash) { toast("Password lama salah", "error"); return; }
  if (newPass.length < 6) { toast("Password baru minimal 6 karakter", "error"); return; }
  if (newPass !== confirmPass) { toast("Konfirmasi password tidak cocok", "error"); return; }
  await saveAdminCredentialsAsync(newUser, newPass);
  const userDisplay = document.getElementById("currentUserDisplay");
  if (userDisplay) userDisplay.textContent = newUser;
  closeModal();
  toast("Username & password berhasil diubah!", "success");
};

function openSelectiveResetModal() {
  const data = getData();
  const hasResults = data.matches.some((m) => m.played);
  const hasMatches = data.matches.length > 0;
  const hasBracket = data.bracket?.r16?.length > 0;
  const hasBracketResults = hasBracket && getAllBracketMatches(data).some((m) => m.played);
  const hasTimeline = !!data.timeline;
  const hasTeams = data.teams.length > 0;

  const opt = (id, emoji, title, desc, available) => `
    <label class="selective-reset-option ${available ? "" : "disabled"}"
           style="${available ? "cursor:pointer" : "opacity:0.4;cursor:not-allowed"}">
      <input type="checkbox" class="selective-check" id="${id}" ${available ? "" : "disabled"}
             style="accent-color:var(--blue-electric);width:16px;height:16px;flex-shrink:0;margin-top:2px"/>
      <div class="selective-option-body">
        <div class="selective-option-title">${emoji} ${title}</div>
        <div class="selective-option-desc">${desc}</div>
      </div>
      ${available ? "" : '<span class="selective-unavail">Tidak ada data</span>'}
    </label>`;

  openModal(
    "🎯 Reset Selektif",
    `
    <div style="display:flex;flex-direction:column;gap:10px;">
      <div style="padding:10px 14px;background:rgba(255,171,0,0.07);border:1px solid rgba(255,171,0,0.25);border-radius:8px;font-size:0.8rem;color:#ffab00;">
        ⚠️ Centang bagian yang ingin direset. Data lain tetap aman.
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${opt("reset-results", "⚽", "Hasil Match Grup", `${data.matches.filter((m) => m.played).length} hasil — skor direset, jadwal tetap`, hasResults)}
        ${opt("reset-schedule", "📅", "Jadwal Grup", `${data.matches.length} match dihapus, tim tetap ada`, hasMatches)}
        ${opt("reset-bracket-results", "🏅", "Hasil Bracket Playoff", "Skor & pemenang direset, matchup tetap", hasBracketResults)}
        ${opt("reset-bracket", "🏆", "Bracket Playoff", "Seluruh bracket dihapus, bisa generate ulang", hasBracket)}
        ${opt("reset-timeline", "🗓", "Timeline", "Tanggal dikembalikan ke default", hasTimeline)}
        ${opt("reset-teams", "👥", "Semua Tim", `${data.teams.length} tim + semua jadwal & bracket dihapus`, hasTeams)}
      </div>
      <div id="resetPreview" class="selective-preview" style="display:none">
        <div class="selective-preview-label">Dampak reset:</div>
        <div id="resetPreviewList"></div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
        <button class="btn btn-danger" onclick="executeSelectiveReset()" id="doResetBtn" disabled>⚠️ Reset yang Dipilih</button>
      </div>
    </div>
  `,
  );

  document.querySelectorAll(".selective-check").forEach((cb) => {
    cb.addEventListener("change", updateResetPreview);
  });
}

function updateResetPreview() {
  const data = getData();
  const checked = getCheckedResets();
  const preview = document.getElementById("resetPreview");
  const list = document.getElementById("resetPreviewList");
  const doBtn = document.getElementById("doResetBtn");
  if (!checked.length) {
    preview.style.display = "none";
    doBtn.disabled = true;
    return;
  }
  doBtn.disabled = false;
  preview.style.display = "block";
  const impacts = [];
  if (checked.includes("reset-results")) impacts.push(`• ${data.matches.filter((m) => m.played).length} hasil match grup dihapus`);
  if (checked.includes("reset-schedule")) impacts.push(`• ${data.matches.length} jadwal & semua hasil grup dihapus`);
  if (checked.includes("reset-bracket-results")) impacts.push(`• Skor & pemenang bracket direset`);
  if (checked.includes("reset-bracket")) impacts.push(`• Bracket playoff dihapus sepenuhnya`);
  if (checked.includes("reset-timeline")) impacts.push(`• Timeline dikembalikan ke default`);
  if (checked.includes("reset-teams")) impacts.push(`• ${data.teams.length} tim, jadwal & bracket dihapus`);
  list.innerHTML = impacts.map((i) => `<div style="font-size:0.8rem;color:var(--text-secondary);padding:2px 0">${i}</div>`).join("");
}

function getCheckedResets() {
  return [...document.querySelectorAll(".selective-check:checked")].map((cb) => cb.id);
}

window.executeSelectiveReset = function () {
  const checked = getCheckedResets();
  if (!checked.length) return;
  const labels = {
    "reset-results": "hasil match grup",
    "reset-schedule": "jadwal grup",
    "reset-bracket-results": "hasil bracket",
    "reset-bracket": "bracket playoff",
    "reset-timeline": "timeline",
    "reset-teams": "semua tim",
  };

  confirmModal(
    `Reset: <strong>${checked.map((id) => labels[id]).join(", ")}</strong>? Aksi ini tidak bisa dibatalkan.`,
    () => {
      const data = getData();
      if (checked.includes("reset-teams")) {
        data.teams = [];
        data.matches = [];
        data.bracket = { r16: [], qf: [], sf: [], bronze: [], final: [] };
      } else {
        if (checked.includes("reset-schedule")) {
          data.matches = [];
        } else if (checked.includes("reset-results")) {
          data.matches.forEach((m) => { m.played = false; m.scoreA = null; m.scoreB = null; });
        }
        if (checked.includes("reset-bracket")) {
          data.bracket = { r16: [], qf: [], sf: [], bronze: [], final: [] };
        } else if (checked.includes("reset-bracket-results")) {
          getAllBracketMatches(data).forEach((m) => { m.played = false; m.scoreA = null; m.scoreB = null; m.winner = null; });
          ["qf", "sf", "bronze", "final"].forEach((round) => {
            data.bracket?.[round]?.forEach((m) => { m.teamA = null; m.teamB = null; });
          });
        }
      }
      if (checked.includes("reset-timeline")) data.timeline = DEFAULT_TIMELINE;
      saveData(data);
      closeModal();
      renderAdmin();
      toast(`Reset selesai: ${checked.map((id) => labels[id]).join(", ")}.`, "success");
    },
    { title: "Reset Selektif", confirmText: "Ya, Reset", type: "danger" }
  );
};

window.toast = function (msg, type = "info") {
  const c = document.getElementById("toastContainer");
  if (!c) return;
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${msg}</span>`;
  c.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateX(50px)";
  }, 2700);
  setTimeout(() => el.remove(), 3100);
};