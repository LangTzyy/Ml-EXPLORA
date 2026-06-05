/* ============================================================
   script.js  —  EXPLORA Tournament Engine (Firestore version)
   ============================================================ */

const AUTH_KEY = "mlwc_auth";

/* ─── KONSTANTA ─────────────────────────────────────────────── */
const GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H"];

const LOGO_COLORS = [
  "linear-gradient(135deg,#ff5e62,#ff9966)",
  "linear-gradient(135deg,#3aa9ff,#a371ff)",
  "linear-gradient(135deg,#ffd166,#ff8c42)",
  "linear-gradient(135deg,#45e3a8,#3aa9ff)",
  "linear-gradient(135deg,#ff5ec4,#a371ff)",
  "linear-gradient(135deg,#06d6a0,#118ab2)",
  "linear-gradient(135deg,#ef476f,#ffd166)",
  "linear-gradient(135deg,#7b2cbf,#3a86ff)",
];

const DEFAULT_TIMELINE = [
  { id:"group",  icon:"⚔️", label:"Babak Grup",         desc:"Round robin semua grup",                        date:"2026-06-13", cssClass:"stage-group-ad" },
  { id:"r16",    icon:"⚡",  label:"Babak 16 Besar",     desc:"Round of 16 (BO3)",                             date:"2026-06-14", cssClass:"stage-r16"      },
  { id:"qf",     icon:"🔥", label:"Babak 8 Besar",       desc:"Quarter Finals (BO3)",                          date:"2026-06-20", cssClass:"stage-qf"       },
  { id:"sf",     icon:"🏅", label:"Semifinal",           desc:"Semi Finals (BO3)",                             date:"2026-06-20", cssClass:"stage-sf"       },
  { id:"bronze", icon:"🥉", label:"Perebutan Juara 3",   desc:"Match antara 2 tim yang kalah di Semifinal (BO3)", date:"2026-06-21", cssClass:"stage-bronze"   },
  { id:"final",  icon:"🏆", label:"Grand Final",         desc:"Perebutan Juara 1 & 2 (BO3)",                   date:"2026-06-21", cssClass:"stage-final"    },
];

/* ============================================================
   STORAGE HELPERS
   ============================================================ */
let _cachedData = null;

function getData() {
  if (!_cachedData) return generateInitialData();
  return _cachedData;
}

function saveData(data) {
  _cachedData = data;
  saveDataAsync(data).catch(e => console.error("[saveData]", e));
}

async function initData() {
  _cachedData = await loadDataAsync();
}

function generateInitialData() {
  return {
    teams:    [],
    matches:  [],
    bracket:  { r16:[], qf:[], sf:[], bronze:[], final:[] },
    timeline: DEFAULT_TIMELINE.map((t) => ({ ...t })),
    meta:     { createdAt: new Date().toISOString() },
  };
}

/* ============================================================
   JADWAL ROUND-ROBIN
   ============================================================ */
function generateGroupSchedule(teams) {
  const matches = [];
  let mid = 1;
  GROUPS.forEach((g) => {
    const gt = teams.filter((t) => t.group === g);
    for (let i = 0; i < gt.length; i++) {
      for (let j = i + 1; j < gt.length; j++) {
        matches.push({
          id:     "m" + mid++,
          group:  g,
          teamA:  gt[i].id,
          teamB:  gt[j].id,
          scoreA: 0,
          scoreB: 0,
          played: false,
        });
      }
    }
  });
  return matches;
}

/* ============================================================
   STANDINGS
   ============================================================ */
function computeStandings(data) {
  const standings = {};
  GROUPS.forEach((g) => {
    const gt = data.teams.filter((t) => t.group === g);
    standings[g] = gt.map((t) => ({ ...t, played:0, win:0, draw:0, lose:0, points:0 }));
  });

  data.matches.forEach((m) => {
    if (!m.played) return;
    const grp = standings[m.group];
    if (!grp) return;
    const a = grp.find((t) => t.id === m.teamA);
    const b = grp.find((t) => t.id === m.teamB);
    if (!a || !b) return;
    a.played++; b.played++;
    if (m.scoreA > m.scoreB)      { a.win++; b.lose++; a.points += 1; b.points -= 1; }
    else if (m.scoreA < m.scoreB) { b.win++; a.lose++; b.points += 1; a.points -= 1; }
    else                           { a.draw++; b.draw++; }
  });

  GROUPS.forEach((g) => {
    standings[g].sort((x, y) => y.points - x.points || y.win - x.win || x.name.localeCompare(y.name));
  });
  return standings;
}

/* ============================================================
   BRACKET GENERATION
   ============================================================ */
function buildBracketFromStandings(data) {
  const standings = computeStandings(data);
  const pairDefs = [
    ["A",1,"B",2], ["C",1,"D",2], ["E",1,"F",2], ["G",1,"H",2],
    ["B",1,"A",2], ["D",1,"C",2], ["F",1,"E",2], ["H",1,"G",2],
  ];
  const r16 = pairDefs.map((p, i) => {
    const a = standings[p[0]]?.[p[1]-1];
    const b = standings[p[2]]?.[p[3]-1];
    return { id:"r16-"+(i+1), teamA:a?.id||null, teamB:b?.id||null, scoreA:0, scoreB:0, winner:null, played:false };
  });
  const mkMatch = (prefix, n) =>
    Array.from({ length:n }, (_, i) => ({ id:`${prefix}-${i+1}`, teamA:null, teamB:null, scoreA:0, scoreB:0, winner:null, played:false }));
  return { r16, qf:mkMatch("qf",4), sf:mkMatch("sf",2), bronze:mkMatch("bronze",1), final:mkMatch("final",1) };
}

function advanceBracket(data) {
  const br = data.bracket;
  for (let i = 0; i < 4; i++) {
    const m1 = br.r16[i*2], m2 = br.r16[i*2+1];
    br.qf[i].teamA = m1?.winner || null;
    br.qf[i].teamB = m2?.winner || null;
    if (!m1?.winner || !m2?.winner) { br.qf[i].winner=null; br.qf[i].scoreA=0; br.qf[i].scoreB=0; br.qf[i].played=false; }
  }
  for (let i = 0; i < 2; i++) {
    const m1 = br.qf[i*2], m2 = br.qf[i*2+1];
    br.sf[i].teamA = m1?.winner || null;
    br.sf[i].teamB = m2?.winner || null;
    if (!m1?.winner || !m2?.winner) { br.sf[i].winner=null; br.sf[i].scoreA=0; br.sf[i].scoreB=0; br.sf[i].played=false; }
  }
  const sf1 = br.sf[0], sf2 = br.sf[1];
  br.final[0].teamA  = sf1?.winner || null;
  br.final[0].teamB  = sf2?.winner || null;
  const loser1 = sf1?.winner ? (sf1.winner===sf1.teamA ? sf1.teamB : sf1.teamA) : null;
  const loser2 = sf2?.winner ? (sf2.winner===sf2.teamA ? sf2.teamB : sf2.teamA) : null;
  br.bronze[0].teamA = loser1;
  br.bronze[0].teamB = loser2;
  if (!sf1?.winner || !sf2?.winner) {
    br.final[0].winner=null; br.final[0].scoreA=0; br.final[0].scoreB=0;
    br.bronze[0].winner=null; br.bronze[0].scoreA=0; br.bronze[0].scoreB=0;
  }
  return data;
}

/* ============================================================
   HELPERS
   ============================================================ */
function teamById(id, data) {
  return data?.teams?.find((t) => t.id === id);
}

function getTimeline(data) {
  return data?.timeline || DEFAULT_TIMELINE;
}

function formatDateID(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
}

function toast(msg, type = "info") {
  const c = document.getElementById("toastContainer");
  if (!c) return;
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${msg}</span>`;
  c.appendChild(el);
  setTimeout(() => { el.style.opacity="0"; el.style.transform="translateX(50px)"; }, 2700);
  setTimeout(() => el.remove(), 3100);
}

function emptyState(emo, title, msg) {
  return `<div class="empty-state" style="grid-column:1/-1">
    <div class="emo">${emo}</div><h4>${title}</h4><p>${msg}</p>
  </div>`;
}

function statCard(label, value) {
  return `<div class="stat-card"><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div>`;
}

function showLoading(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.innerHTML = `<div class="empty-state">⏳ Memuat data...</div>`;
}

/* Cek apakah turnamen sudah selesai (ada juara grand final) */
function isTournamentFinished(data) {
  return !!(data?.bracket?.final?.[0]?.winner);
}

/* ============================================================
   PUBLIC PAGE
   ============================================================ */
if (document.getElementById("scheduleList")) {
  document.addEventListener("DOMContentLoaded", initPublic);
}

async function initPublic() {
  setupNav();
  setupFilters();
  setupReveal();

  showLoading("scheduleList");
  showLoading("standingsWrap");
  showLoading("resultsList");
  showLoading("teamsGrid");

  await initData();
  const data = getData();
  renderAll(data);
  startCountdown(data);

  onDataChange((freshData) => {
    _cachedData = freshData;
    renderAll(freshData);
    startCountdown(freshData);
  });
}

/* ─── NAV ─── */
function setupNav() {
  const burger = document.getElementById("hamburger");
  const links  = document.getElementById("navLinks");
  burger?.addEventListener("click", () => {
    burger.classList.toggle("open");
    links.classList.toggle("open");
  });
  document.querySelectorAll(".nav-link").forEach((a) => {
    a.addEventListener("click", () => {
      document.querySelectorAll(".nav-link").forEach((x) => x.classList.remove("active"));
      a.classList.add("active");
      burger?.classList.remove("open");
      links?.classList.remove("open");
    });
  });
}

/* ─── RENDER ALL ─── */
function renderAll(data) {
  renderSchedule(data);
  renderStandings(data);
  renderResults(data);
  renderBracket("bracketWrap", data);
  renderTeams(data);
  renderStats(data);
  populateGroupFilter();
}

/* ─── SCHEDULE ─── */
function renderSchedule(data) {
  const wrap = document.getElementById("scheduleList");
  if (!wrap || !data) return;
  const tl     = getTimeline(data);
  const search = (document.getElementById("searchSchedule")?.value || "").toLowerCase();
  const stageF = document.getElementById("filterScheduleStage")?.value || "";

  // Semua pertandingan grup yang belum dimainkan
  let list = data.matches.filter((m) => !m.played);
  if (search) list = list.filter((m) => {
    const a = teamById(m.teamA, data)?.name.toLowerCase() || "";
    const b = teamById(m.teamB, data)?.name.toLowerCase() || "";
    return a.includes(search) || b.includes(search);
  });

  // Filter per tahap: kalau pilih "group" tampilkan list grup, lainnya kosong (bracket belum main)
  if (stageF && stageF !== "group") {
    list = []; // Jadwal bracket belum main ditampilkan dari bracket section
  }

  if (!list.length) {
    // Tidak ada jadwal sama sekali (belum ada tim/match)
    if (!data.teams.length || !data.matches.length) {
      wrap.innerHTML = emptyState("📅", "Belum ada jadwal pertandingan", "Jadwal akan muncul setelah admin menginput data tim.");
      return;
    }
    // Turnamen sudah selesai (ada juara)
    if (isTournamentFinished(data)) {
      wrap.innerHTML = emptyState("✅", "Semua pertandingan sudah selesai", "Lihat hasil lengkap di bagian Hasil Pertandingan.");
      return;
    }
    // Semua match grup sudah dimainkan tapi turnamen belum selesai
    const allGroupPlayed = data.matches.every(m => m.played);
    if (allGroupPlayed) {
      wrap.innerHTML = emptyState("⚡", "Babak Grup Selesai", "Turnamen dilanjutkan ke babak playoff. Lihat bracket di bawah.");
      return;
    }
    // Filter aktif tapi tidak ada hasil
    wrap.innerHTML = emptyState("🔍", "Tidak ada jadwal", "Coba ubah filter pencarian.");
    return;
  }

  wrap.innerHTML = list.slice(0, 60).map((m) => matchCardHtml(m, data, tl)).join("");
}

function getMatchDateFromTimeline(match, tl) {
  const entry = tl.find((t) => t.id === "group");
  return entry?.date ? formatDateID(entry.date) : "";
}

function matchCardHtml(m, data, tl, showStatus = false) {
  const a       = teamById(m.teamA, data);
  const b       = teamById(m.teamB, data);
  const winA    = m.played && m.scoreA > m.scoreB;
  const winB    = m.played && m.scoreB > m.scoreA;
  const dateStr = tl ? getMatchDateFromTimeline(m, tl) : "";
  return `
    <div class="match-card">
      <div class="match-meta">
        <span class="match-tag">Grup ${m.group} • BO1</span>
        ${showStatus ? `<span class="match-tag ${m.played?"done":""}">${m.played?"✓ Selesai":"⏳ Belum"}</span>` : ""}
      </div>
      ${dateStr ? `<div class="match-date-row">📅 ${dateStr}</div>` : ""}
      <div class="match-row">
        <div class="match-team ${winA?"win":m.played?"lose":""}"><span>${a?.name||"?"}</span></div>
        <div class="match-score ${m.played?"":"vs"}">${m.played?`${m.scoreA} - ${m.scoreB}`:"VS"}</div>
        <div class="match-team right ${winB?"win":m.played?"lose":""}"><span>${b?.name||"?"}</span></div>
      </div>
    </div>`;
}

function bracketResultCardHtml(m, data, stageLabel) {
  const a    = teamById(m.teamA, data);
  const b    = teamById(m.teamB, data);
  const winA = m.played && m.scoreA > m.scoreB;
  const winB = m.played && m.scoreB > m.scoreA;
  return `
    <div class="match-card">
      <div class="match-meta">
        <span class="match-tag gold">${stageLabel} • BO3</span>
        <span class="match-tag done">✓ Selesai</span>
      </div>
      <div class="match-row">
        <div class="match-team ${winA?"win":"lose"}"><span>${a?.name||"?"}</span></div>
        <div class="match-score">${m.scoreA} - ${m.scoreB}</div>
        <div class="match-team right ${winB?"win":"lose"}"><span>${b?.name||"?"}</span></div>
      </div>
    </div>`;
}

function setupFilters() {
  ["searchSchedule","filterScheduleStage"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", () => {
      renderSchedule(getData());
    });
  });
  ["searchResults","filterResultGroup","filterResultStage"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", () => {
      renderResults(getData());
    });
  });
  document.getElementById("searchTeams")?.addEventListener("input", () => {
    renderTeams(getData());
  });
}

function populateGroupFilter() {
  ["filterGroup","filterResultGroup"].forEach((selId) => {
    const sel = document.getElementById(selId);
    if (sel && sel.options.length <= 1) {
      GROUPS.forEach((g) => {
        const o = document.createElement("option");
        o.value = g; o.textContent = `Grup ${g}`;
        sel.appendChild(o);
      });
    }
  });
}

/* ─── STANDINGS ─── */
function renderStandings(data) {
  const wrap = document.getElementById("standingsWrap");
  if (!wrap || !data) return;

  const standings = computeStandings(data);

  // Hanya tampilkan grup yang memiliki tim
  const activeGroups = GROUPS.filter(g => data.teams.some(t => t.group === g));

  if (!activeGroups.length) {
    wrap.innerHTML = emptyState("📋", "Belum ada klasemen", "Klasemen akan muncul setelah admin menginput tim.");
    return;
  }

  wrap.innerHTML = activeGroups.map((g) => {
    const rows = standings[g].map((t, i) => `
      <tr class="${i < 2 ? "qualified" : ""}">
        <td class="team-name-cell">
          <span class="team-rank-num">${i + 1}</span>
          <span>${t.name}</span>
          ${i < 2 ? '<span class="qualify-badge">Lolos</span>' : ''}
        </td>
        <td>${t.played}</td>
        <td class="col-win">${t.win}</td>
        <td>${t.draw}</td>
        <td class="col-lose">${t.lose}</td>
        <td><b class="${t.points > 0 ? 'pts-pos' : t.points < 0 ? 'pts-neg' : ''}">${t.points > 0 ? '+' : ''}${t.points}</b></td>
      </tr>`).join("");

    return `
      <div class="group-card">
        <div class="group-title">GRUP ${g}</div>
        <table class="standings-table">
          <thead>
            <tr>
              <th class="th-team">Tim</th>
              <th title="Match Dimainkan">M</th>
              <th title="Menang" class="col-win">W</th>
              <th title="Seri">D</th>
              <th title="Kalah" class="col-lose">L</th>
              <th title="Poin">Pts</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="standings-legend">
          <span>M: Match</span>
          <span>W: Menang</span>
          <span>D: Seri</span>
          <span>L: Kalah</span>
          <span class="legend-sep">•</span>
          <span class="pts-pos">Menang +1</span>
          <span>Seri 0</span>
          <span class="pts-neg">Kalah −1</span>
        </div>
      </div>`;
  }).join("");
}

/* ─── RESULTS ─── */
function renderResults(data) {
  const wrap = document.getElementById("resultsList");
  if (!wrap || !data) return;
  const tl     = getTimeline(data);
  const br     = data.bracket;
  const search = (document.getElementById("searchResults")?.value || "").toLowerCase();
  const groupF = document.getElementById("filterResultGroup")?.value || "";
  const stageF = document.getElementById("filterResultStage")?.value || "";
  const stageLabels = { r16:"16 Besar", qf:"8 Besar", sf:"Semifinal", bronze:"Perebutan Juara 3", final:"Grand Final" };

  let html = "", totalShown = 0;

  if (!stageF || stageF === "group") {
    let gm = data.matches.filter((m) => m.played);
    if (groupF) gm = gm.filter((m) => m.group === groupF);
    if (search) gm = gm.filter((m) => {
      const a = teamById(m.teamA,data)?.name.toLowerCase()||"";
      const b = teamById(m.teamB,data)?.name.toLowerCase()||"";
      return a.includes(search)||b.includes(search);
    });
    gm = gm.slice(-50).reverse();
    if (gm.length) { html += gm.map((m)=>matchCardHtml(m,data,tl,true)).join(""); totalShown+=gm.length; }
  }

  if (!groupF && br) {
    ["r16","qf","sf","bronze","final"].forEach((stage) => {
      if (stageF && stageF!=="bracket" && stageF!==stage) return;
      let played = (br[stage]||[]).filter((m)=>m.played);
      if (search) played = played.filter((m) => {
        const a = teamById(m.teamA,data)?.name.toLowerCase()||"";
        const b = teamById(m.teamB,data)?.name.toLowerCase()||"";
        return a.includes(search)||b.includes(search);
      });
      if (played.length) {
        played.forEach((m) => { html += bracketResultCardHtml(m,data,stageLabels[stage]); });
        totalShown += played.length;
      }
    });
  }

  if (!totalShown) { wrap.innerHTML = emptyState("📭","Belum ada hasil","Hasil pertandingan akan muncul di sini."); return; }
  wrap.innerHTML = html;
}

/* ─── BRACKET ─── */
function renderBracket(elementId, data) {
  const wrap = document.getElementById(elementId);
  if (!wrap || !data) return;
  const br = data.bracket;
  if (!br || !br.r16 || !br.r16.length) {
    wrap.innerHTML = `<div class="bracket-empty">
      <div class="bracket-empty-icon">🏆</div>
      <h4>Bracket Belum Tersedia</h4>
      <p>Bracket akan muncul setelah admin generate dari klasemen grup.</p>
    </div>`;
    return;
  }

  wrap.innerHTML = `
    <div class="bracket-flow">
      <div class="bracket-stage-block">
        <div class="bracket-stage-header">
          <span class="stage-icon">⚡</span>
          <span>16 Besar</span>
          <span class="stage-format">BO3</span>
        </div>
        <div class="bracket-col">
          ${br.r16.map((m,i) => bracketMatchPublicHtml(m, i+1, data)).join("")}
        </div>
      </div>
      <div class="bracket-connector-col">
        ${Array.from({length:4}, () => '<div class="bracket-connector"></div>').join("")}
      </div>
      <div class="bracket-stage-block">
        <div class="bracket-stage-header">
          <span class="stage-icon">🔥</span>
          <span>8 Besar</span>
          <span class="stage-format">BO3</span>
        </div>
        <div class="bracket-col">
          ${br.qf.map((m,i) => bracketMatchPublicHtml(m, i+1, data)).join("")}
        </div>
      </div>
      <div class="bracket-connector-col bracket-connector-col--sm">
        ${Array.from({length:2}, () => '<div class="bracket-connector"></div>').join("")}
      </div>
      <div class="bracket-stage-block">
        <div class="bracket-stage-header">
          <span class="stage-icon">🏅</span>
          <span>Semifinal</span>
          <span class="stage-format">BO3</span>
        </div>
        <div class="bracket-col">
          ${br.sf.map((m,i) => bracketMatchPublicHtml(m, i+1, data)).join("")}
        </div>
      </div>
      <div class="bracket-finals-col">
        <div class="bracket-stage-block bracket-stage-block--bronze">
          <div class="bracket-stage-header">
            <span class="stage-icon">🥉</span>
            <span>Juara 3</span>
            <span class="stage-format">BO3</span>
          </div>
          <div class="bracket-col">
            ${br.bronze.map((m,i) => bracketMatchPublicHtml(m, i+1, data)).join("")}
          </div>
        </div>
        <div class="bracket-stage-block bracket-stage-block--final">
          <div class="bracket-stage-header bracket-stage-header--final">
            <span class="stage-icon">🏆</span>
            <span>Grand Final</span>
            <span class="stage-format">BO3</span>
          </div>
          <div class="bracket-col">
            ${br.final.map((m,i) => bracketMatchPublicHtml(m, i+1, data, true)).join("")}
          </div>
        </div>
      </div>
    </div>`;
}

function bracketMatchPublicHtml(m, idx, data, isFinal=false) {
  const a = teamById(m.teamA,data), b = teamById(m.teamB,data);
  const winA = m.winner && m.winner===m.teamA;
  const winB = m.winner && m.winner===m.teamB;
  return `
    <div class="bracket-match ${isFinal?"final":""} ${m.winner?"bracket-match--done":""}">
      <span class="bm-tag">M${idx}</span>
      <div class="bm-row ${winA?"win":m.winner?"lose":""}">
        <div class="bm-team">${a?`<div class="bm-logo">${a.tag?.[0]||"?"}</div>`:'<div class="bm-logo tbd">?</div>'}<span>${a?.name||"TBD"}</span></div>
        <div class="bm-score ${winA?"bm-score--win":""}">${m.played?m.scoreA:"-"}</div>
      </div>
      <div class="bm-divider"></div>
      <div class="bm-row ${winB?"win":m.winner?"lose":""}">
        <div class="bm-team">${b?`<div class="bm-logo">${b.tag?.[0]||"?"}</div>`:'<div class="bm-logo tbd">?</div>'}<span>${b?.name||"TBD"}</span></div>
        <div class="bm-score ${winB?"bm-score--win":""}">${m.played?m.scoreB:"-"}</div>
      </div>
      ${m.winner?`<div class="bm-winner-bar"></div>`:""}
    </div>`;
}

/* ─── TEAMS ─── */
function renderTeams(data) {
  const wrap = document.getElementById("teamsGrid");
  if (!wrap || !data) return;
  const search = (document.getElementById("searchTeams")?.value || "").toLowerCase();
  const list = data.teams.filter((t) =>
    t.name.toLowerCase().includes(search) || t.tag.toLowerCase().includes(search)
  );
  if (!list.length) {
    wrap.innerHTML = data.teams.length
      ? emptyState("🔍","Tim tidak ditemukan","Coba kata kunci lain.")
      : emptyState("👥","Belum ada tim","Tim akan muncul setelah admin menginput data.");
    return;
  }
  wrap.innerHTML = list.map((t) => `
    <div class="team-card">
      <div class="team-logo-placeholder">⚔</div>
      <h4>${t.name}</h4>
      <span class="team-tag-label">${t.tag || ""}</span>
      <span class="team-group">Grup ${t.group}</span>
    </div>`).join("");
}

/* ─── STATS ─── */
function renderStats(data) {
  const wrap = document.getElementById("statsCards");
  if (!wrap || !data) return;
  const br          = data.bracket;
  const finalMatch  = br?.final?.[0];
  const bronzeMatch = br?.bronze?.[0];
  const champ  = finalMatch?.winner  ? teamById(finalMatch.winner, data) : null;
  const runner = finalMatch?.winner  ? teamById(finalMatch.winner===finalMatch.teamA?finalMatch.teamB:finalMatch.teamA, data) : null;
  const bronze3 = bronzeMatch?.winner ? teamById(bronzeMatch.winner, data) : null;
  const totalM = data.matches.length;
  const played = data.matches.filter((m) => m.played).length;

  if (champ) {
    wrap.innerHTML = `
      <div class="podium-section" style="grid-column:1/-1">
        <div class="podium-title">🏆 HASIL AKHIR TURNAMEN</div>
        <div class="podium-wrap">
          <div class="podium-slot podium-2"><div class="podium-crown">🥈</div><div class="podium-name">${runner?.name||"—"}</div><div class="podium-label">Runner Up</div><div class="podium-block podium-block--2"><span class="podium-pos">2</span></div></div>
          <div class="podium-slot podium-1"><div class="podium-sparkles">✦ ✦ ✦</div><div class="podium-crown">👑</div><div class="podium-name podium-name--champ">${champ?.name||"—"}</div><div class="podium-label podium-label--champ">🏆 JUARA 1</div><div class="podium-block podium-block--1"><span class="podium-pos">1</span></div></div>
          <div class="podium-slot podium-3"><div class="podium-crown">🥉</div><div class="podium-name">${bronze3?.name||"—"}</div><div class="podium-label">Juara 3</div><div class="podium-block podium-block--3"><span class="podium-pos">3</span></div></div>
        </div>
      </div>`;
  }

  const statsHtml = `${statCard("Tim Peserta",data.teams.length)}${statCard("Total Match",totalM)}${statCard("Match Selesai",played)}${statCard("Progres",totalM?Math.round((played/totalM)*100)+"%":"0%")}`;
  if (champ) {
    wrap.innerHTML += `<div class="stats-sub-grid">${statsHtml}</div>`;
  } else {
    wrap.innerHTML = statsHtml;
  }

  const top = document.getElementById("topTeams");
  if (top) {
    const all = [];
    const standings = computeStandings(data);
    GROUPS.forEach((g) => standings[g].forEach((t) => all.push(t)));
    all.sort((a,b) => b.points-a.points || b.win-a.win);
    top.innerHTML = all.slice(0,10).map((t,i) => `
      <div class="top-row">
        <div class="top-rank">${i+1}</div>
        <div><b>${t.name}</b> <small style="color:var(--text-tertiary)">• Grup ${t.group}</small></div>
        <span class="top-pts">${t.points>=0?"+":""}${t.points} pts</span>
      </div>`).join("");
  }
}

/* ─── REVEAL SCROLL ─── */
function setupReveal() {
  const els = document.querySelectorAll(".reveal");
  const io  = new IntersectionObserver(
    (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("visible"); }),
    { threshold:0.1 }
  );
  els.forEach((el) => io.observe(el));
}

/* ─── COUNTDOWN ─── */
function startCountdown(data) {
  const cd = document.getElementById("countdown");
  if (!cd) return;

  function getNextStage() {
    const tl    = getTimeline(data);
    const today = new Date();
    today.setHours(0,0,0,0);
    const sorted = tl.filter((t)=>t.date).sort((a,b)=>new Date(a.date)-new Date(b.date));
    const next   = sorted.find((t) => new Date(t.date+"T00:00:00") >= today);
    return next
      ? { label:next.label, target:new Date(next.date+"T19:00:00").getTime() }
      : { label:"Turnamen Selesai", target:null };
  }

  const labelEl = document.querySelector(".cd-label");
  if (window._countdownInterval) clearInterval(window._countdownInterval);

  const tick = () => {
    const stage = getNextStage();
    if (labelEl) labelEl.textContent = stage.target ? "Menuju "+stage.label : "🏆 Turnamen Telah Selesai";
    if (!stage.target) {
      ["cd-days","cd-hours","cd-mins","cd-secs"].forEach((id) => { const el=document.getElementById(id); if(el) el.textContent="00"; });
      return;
    }
    const diff  = Math.max(0, stage.target - Date.now());
    const days  = Math.floor(diff/86400000);
    const hours = Math.floor((diff%86400000)/3600000);
    const mins  = Math.floor((diff%3600000)/60000);
    const secs  = Math.floor((diff%60000)/1000);
    const set   = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=String(v).padStart(2,"0"); };
    set("cd-days",days); set("cd-hours",hours); set("cd-mins",mins); set("cd-secs",secs);
  };
  tick();
  window._countdownInterval = setInterval(tick, 1000);
}