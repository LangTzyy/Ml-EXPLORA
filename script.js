/* ============================================================
   MLWC - Tournament Engine (Shared Public Logic)
   Pure JavaScript. All state persisted to localStorage.

   SISTEM POIN GRUP:
   - Win: +1 poin
   - Draw: 0 poin
   - Lose: -1 poin
   ============================================================ */

const STORAGE_KEY = 'mlwc_data';
const AUTH_KEY    = 'mlwc_auth';

/* ─── DUMMY TEAMS ─── */
const DUMMY_TEAMS = [
  ['ONIC Esports','ONIC'],
  ['RRQ Hoshi','RRQ'],
  ['EVOS Legends','EVOS'],
  ['Alter Ego','AE'],
  ['Bigetron Alpha','BTR'],
  ['Geek Fam','GFI'],
  ['Aura Fire','AURA'],
  ['Rebellion Zion','RBL'],
  ['Blacklist Intl','BLK'],
  ['ECHO Proud','ECHO'],
  ['AP Bren','APB'],
  ['Smart Omega','OMG'],
  ['TNC Pro Team','TNC'],
  ['RSG Philippines','RSG'],
  ['Nexplay EVOS','NPX'],
  ['Minana Esports','MNA'],
  ['Burmese Ghouls','BGH'],
  ['Falcon Esports','FLC'],
  ['ArkAngel','ARK'],
  ['Team Flash','FLA'],
  ['Todak','TDK'],
  ['Geek Fam MY','GFM'],
  ['Orange Esports','ORA'],
  ['HomeBois','HMB'],
  ['Bren Esports','BRE'],
  ['Cignal Ultra','CIG'],
  ['Natus Vincere','NIP'],
  ['SeeYouSoon','SYS'],
  ['Resurgence','RSG2'],
  ['Team Secret','SEC'],
  ['EXP Esports','EXP'],
  ['King of Gamers','KOG'],
];

const GROUPS     = ['A','B','C','D','E','F','G','H'];
const LOGO_COLORS = [
  'linear-gradient(135deg,#ff5e62,#ff9966)',
  'linear-gradient(135deg,#3aa9ff,#a371ff)',
  'linear-gradient(135deg,#ffd166,#ff8c42)',
  'linear-gradient(135deg,#45e3a8,#3aa9ff)',
  'linear-gradient(135deg,#ff5ec4,#a371ff)',
  'linear-gradient(135deg,#06d6a0,#118ab2)',
  'linear-gradient(135deg,#ef476f,#ffd166)',
  'linear-gradient(135deg,#7b2cbf,#3a86ff)',
];

/* Timeline default (juga dipakai admin.js) */
const DEFAULT_TIMELINE = [
  { id:'group-ad', icon:'⚔️', label:'Babak Grup A–D',   desc:'Round robin Grup A, B, C, D',                             date:'2026-06-06', cssClass:'stage-group-ad' },
  { id:'group-eh', icon:'⚔️', label:'Babak Grup E–H',   desc:'Round robin Grup E, F, G, H',                             date:'2026-06-07', cssClass:'stage-group-eh' },
  { id:'r16',      icon:'⚡',  label:'Babak 16 Besar',   desc:'Round of 16 (BO3)',                                        date:'2026-06-13', cssClass:'stage-r16' },
  { id:'qf',       icon:'🔥',  label:'Babak 8 Besar',    desc:'Quarter Finals (BO3)',                                     date:'2026-06-14', cssClass:'stage-qf' },
  { id:'sf',       icon:'🏅',  label:'Semifinal',        desc:'Semi Finals (BO3)',                                        date:'2026-06-20', cssClass:'stage-sf' },
  { id:'bronze',   icon:'🥉',  label:'Perebutan Juara 3',desc:'Match antara 2 tim yang kalah di Semifinal (BO3)',         date:'2026-06-21', cssClass:'stage-bronze' },
  { id:'final',    icon:'🏆',  label:'Grand Final',      desc:'Perebutan Juara 1 & 2 (BO3)',                              date:'2026-06-21', cssClass:'stage-final' },
];

/* ============================================================
   STORAGE HELPERS
   ============================================================ */
function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      /* Pastikan field timeline selalu ada */
      if (!parsed.timeline) {
        parsed.timeline = DEFAULT_TIMELINE.map(t => ({ ...t }));
        saveData(parsed);
      }
      return parsed;
    } catch(e) {}
  }
  const data = generateInitialData();
  saveData(data);
  return data;
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getData() { return loadData(); }

/* ============================================================
   PATCH script.js: generateInitialData tanpa dummy data
   
   Ganti fungsi generateInitialData() yang lama dengan ini.
   Sekarang mulai dari kosong, tanpa dummy teams.
   ============================================================ */

function generateInitialData() {
  return {
    teams   : [],
    matches : [],
    bracket : { r16:[], qf:[], sf:[], bronze:[], final:[] },
    timeline: DEFAULT_TIMELINE.map(t => ({ ...t })),
    meta    : { createdAt: new Date().toISOString() },
  };
}
/* Jadwal round-robin per grup */
function generateGroupSchedule(teams) {
  const matches = [];
  let mid = 1;

  GROUPS.forEach((g, gi) => {
    const gt = teams.filter(t => t.group === g);
    for (let i = 0; i < gt.length; i++) {
      for (let j = i + 1; j < gt.length; j++) {
        matches.push({
          id    : 'm' + (mid++),
          group : g,
          teamA : gt[i].id,
          teamB : gt[j].id,
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
   STANDINGS  (Win +1 | Draw 0 | Lose -1)
   ============================================================ */
function computeStandings(data) {
  data = data || getData();
  const standings = {};

  GROUPS.forEach(g => {
    const gt = data.teams.filter(t => t.group === g);
    standings[g] = gt.map(t => ({ ...t, played:0, win:0, draw:0, lose:0, points:0 }));
  });

  data.matches.forEach(m => {
    if (!m.played) return;
    const grp = standings[m.group]; if (!grp) return;
    const a = grp.find(t => t.id === m.teamA);
    const b = grp.find(t => t.id === m.teamB);
    if (!a || !b) return;
    a.played++; b.played++;
    if (m.scoreA > m.scoreB)      { a.win++;  b.lose++; a.points += 1; b.points -= 1; }
    else if (m.scoreA < m.scoreB) { b.win++;  a.lose++; b.points += 1; a.points -= 1; }
    else                          { a.draw++; b.draw++; }
  });

  GROUPS.forEach(g => {
    standings[g].sort((x, y) =>
      y.points - x.points || y.win - x.win || x.name.localeCompare(y.name)
    );
  });
  return standings;
}

/* ============================================================
   BRACKET GENERATION
   ============================================================ */
function buildBracketFromStandings(data) {
  data = data || getData();
  const standings = computeStandings(data);

  /* Pasangan R16: A1 vs B2, C1 vs D2, dst. */
  const pairDefs = [
    ['A',1,'B',2], ['C',1,'D',2], ['E',1,'F',2], ['G',1,'H',2],
    ['B',1,'A',2], ['D',1,'C',2], ['F',1,'E',2], ['H',1,'G',2],
  ];

  const r16 = pairDefs.map((p, i) => {
    const a = standings[p[0]]?.[p[1]-1];
    const b = standings[p[2]]?.[p[3]-1];
    return {
      id    : 'r16-' + (i+1),
      teamA : a?.id || null,
      teamB : b?.id || null,
      scoreA: 0, scoreB: 0,
      winner: null, played: false,
    };
  });

  const mkMatch = (prefix, n) => Array.from({ length: n }, (_, i) => ({
    id    : `${prefix}-${i+1}`,
    teamA : null, teamB: null,
    scoreA: 0,    scoreB: 0,
    winner: null, played: false,
  }));

  return {
    r16,
    qf    : mkMatch('qf', 4),
    sf    : mkMatch('sf', 2),
    bronze: mkMatch('bronze', 1),
    final : mkMatch('final', 1),
  };
}

/* Propagasi hasil bracket ke round berikutnya */
function advanceBracket(data) {
  const br = data.bracket;

  /* R16 → QF */
  for (let i = 0; i < 4; i++) {
    const m1 = br.r16[i*2];
    const m2 = br.r16[i*2+1];
    br.qf[i].teamA = m1?.winner || null;
    br.qf[i].teamB = m2?.winner || null;
    if (!m1?.winner || !m2?.winner) {
      br.qf[i].winner = null; br.qf[i].scoreA = 0; br.qf[i].scoreB = 0; br.qf[i].played = false;
    }
  }

  /* QF → SF */
  for (let i = 0; i < 2; i++) {
    const m1 = br.qf[i*2];
    const m2 = br.qf[i*2+1];
    br.sf[i].teamA = m1?.winner || null;
    br.sf[i].teamB = m2?.winner || null;
    if (!m1?.winner || !m2?.winner) {
      br.sf[i].winner = null; br.sf[i].scoreA = 0; br.sf[i].scoreB = 0; br.sf[i].played = false;
    }
  }

  /* SF → Final (winner) + Bronze (loser) */
  const sf1 = br.sf[0];
  const sf2 = br.sf[1];

  br.final[0].teamA = sf1?.winner || null;
  br.final[0].teamB = sf2?.winner || null;

  /* Loser = tim yang bukan winner */
  const loser1 = sf1?.winner ? (sf1.winner === sf1.teamA ? sf1.teamB : sf1.teamA) : null;
  const loser2 = sf2?.winner ? (sf2.winner === sf2.teamA ? sf2.teamB : sf2.teamA) : null;
  br.bronze[0].teamA = loser1;
  br.bronze[0].teamB = loser2;

  if (!sf1?.winner || !sf2?.winner) {
    br.final[0].winner  = null; br.final[0].scoreA  = 0; br.final[0].scoreB  = 0;
    br.bronze[0].winner = null; br.bronze[0].scoreA = 0; br.bronze[0].scoreB = 0;
  }

  return data;
}

/* ============================================================
   HELPERS
   ============================================================ */
function teamById(id, data) {
  data = data || getData();
  return data.teams.find(t => t.id === id);
}

function getTimeline(data) {
  data = data || getData();
  return data.timeline || DEFAULT_TIMELINE;
}

function formatDateID(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

function toast(msg, type = 'info') {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${msg}</span>`;
  c.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(50px)'; }, 2700);
  setTimeout(() => el.remove(), 3100);
}

function isToday(iso) {
  const d = new Date(iso); const t = new Date();
  return d.toDateString() === t.toDateString();
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
}

function emptyState(emo, title, msg) {
  return `<div class="empty-state" style="grid-column:1/-1">
    <div class="emo">${emo}</div><h4>${title}</h4><p>${msg}</p>
  </div>`;
}

function statCard(label, value) {
  return `<div class="stat-card">
    <div class="stat-label">${label}</div>
    <div class="stat-value">${value}</div>
  </div>`;
}

/* ============================================================
   PUBLIC PAGE  — hanya jalan di index.html
   ============================================================ */
if (document.getElementById('scheduleList')) {
  document.addEventListener('DOMContentLoaded', initPublic);
}

function initPublic() {
  setupNav();
  renderAll();
  setupFilters();
  setupReveal();
  startCountdown();
}

/* ─── NAV ─── */
function setupNav() {
  const burger = document.getElementById('hamburger');
  const links  = document.getElementById('navLinks');
  burger?.addEventListener('click', () => {
    burger.classList.toggle('open');
    links.classList.toggle('open');
  });
  document.querySelectorAll('.nav-link').forEach(a => {
    a.addEventListener('click', () => {
      document.querySelectorAll('.nav-link').forEach(x => x.classList.remove('active'));
      a.classList.add('active');
      burger?.classList.remove('open');
      links?.classList.remove('open');
    });
  });
}

/* ─── RENDER ALL ─── */
function renderAll() {
  renderSchedule();
  renderStandings();
  renderResults();
  renderBracket('bracket');
  renderTeams();
  renderStats();
  populateGroupFilter();
}

/* ─── SCHEDULE ─── */
function renderSchedule() {
  const wrap = document.getElementById('scheduleList');
  if (!wrap) return;
  const data   = getData();
  const tl     = getTimeline(data);
  const search = (document.getElementById('searchSchedule')?.value || '').toLowerCase();
  const groupF = document.getElementById('filterGroup')?.value || '';
  const statusF= document.getElementById('filterStatus')?.value || '';

  let list = data.matches.slice();
  if (groupF)              list = list.filter(m => m.group === groupF);
  if (statusF==='upcoming') list = list.filter(m => !m.played);
  if (statusF==='finished') list = list.filter(m => m.played);
  if (search) {
    list = list.filter(m => {
      const a = teamById(m.teamA, data)?.name.toLowerCase() || '';
      const b = teamById(m.teamB, data)?.name.toLowerCase() || '';
      return a.includes(search) || b.includes(search);
    });
  }

  if (!list.length) {
    wrap.innerHTML = emptyState('🎮','Tidak ada pertandingan','Coba ubah filter pencarian.');
    return;
  }
  wrap.innerHTML = list.slice(0, 60).map(m => matchCardHtml(m, data, tl)).join('');
}

/* Tanggal match dari timeline */
function getMatchDateFromTimeline(match, tl) {
  const adGroups = ['A','B','C','D'];
  const stageId  = adGroups.includes(match.group) ? 'group-ad' : 'group-eh';
  const entry    = tl.find(t => t.id === stageId);
  return entry?.date ? formatDateID(entry.date) : '';
}

function matchCardHtml(m, data, tl) {
  const a      = teamById(m.teamA, data);
  const b      = teamById(m.teamB, data);
  const winA   = m.played && m.scoreA > m.scoreB;
  const winB   = m.played && m.scoreB > m.scoreA;
  const dateStr= tl ? getMatchDateFromTimeline(m, tl) : '';

  return `
    <div class="match-card">
      <div class="match-meta">
        <span class="match-tag">Grup ${m.group} • BO1</span>
        <span class="match-tag ${m.played ? 'done' : ''}">${m.played ? '✓ Selesai' : '⏳ Belum'}</span>
      </div>
      ${dateStr ? `<div class="match-date-row">📅 ${dateStr}</div>` : ''}
      <div class="match-row">
        <div class="match-team ${winA ? 'win' : (m.played ? 'lose' : '')}">
          <span>${a?.name || '?'}</span>
        </div>
        <div class="match-score ${m.played ? '' : 'vs'}">
          ${m.played ? `${m.scoreA} - ${m.scoreB}` : 'VS'}
        </div>
        <div class="match-team right ${winB ? 'win' : (m.played ? 'lose' : '')}">
          <span>${b?.name || '?'}</span>
        </div>
      </div>
    </div>`;
}

function setupFilters() {
  ['searchSchedule','filterGroup','filterStatus'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', renderSchedule);
  });
  document.getElementById('searchTeams')?.addEventListener('input', renderTeams);
}

function populateGroupFilter() {
  const sel = document.getElementById('filterGroup');
  if (!sel || sel.options.length > 1) return;
  GROUPS.forEach(g => {
    const o = document.createElement('option');
    o.value = g; o.textContent = `Grup ${g}`;
    sel.appendChild(o);
  });
}

/* ─── STANDINGS ─── */
function renderStandings() {
  const wrap = document.getElementById('standingsWrap');
  if (!wrap) return;
  const standings = computeStandings();

  wrap.innerHTML = GROUPS.map(g => {
    const rows = standings[g].map((t, i) => `
      <tr class="${i < 2 ? 'qualified' : ''}">
        <td class="team"><span>${t.name}</span></td>
        <td>${t.played}</td>
        <td>${t.win}</td>
        <td>${t.draw}</td>
        <td>${t.lose}</td>
        <td><b>${t.points}</b></td>
      </tr>`).join('');

    return `
      <div class="group-card">
        <div class="group-title">GRUP ${g}</div>
        <table class="standings-table">
          <thead><tr><th>Tim</th><th>M</th><th>W</th><th>D</th><th>L</th><th>Pts</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join('');
}

/* ─── RESULTS ─── */
function renderResults() {
  const wrap = document.getElementById('resultsList');
  if (!wrap) return;
  const data = getData();
  const tl   = getTimeline(data);
  const list = data.matches.filter(m => m.played).slice(-30).reverse();
  if (!list.length) {
    wrap.innerHTML = emptyState('📭','Belum ada hasil','Hasil pertandingan akan muncul di sini.');
    return;
  }
  wrap.innerHTML = list.map(m => matchCardHtml(m, data, tl)).join('');
}

/* ─── BRACKET (Public view — left-to-right linear) ─── */
function renderBracket(elementId) {
  const wrap = document.getElementById(elementId);
  if (!wrap) return;
  const data = getData();
  const br   = data.bracket;

  if (!br || !br.r16 || !br.r16.length) {
    wrap.innerHTML = `<div class="empty-state" style="margin:auto">
      <div class="emo">🏆</div>
      <h4>Bracket Belum Tersedia</h4>
      <p>Bracket akan muncul setelah admin generate dari klasemen grup.</p>
    </div>`;
    return;
  }

  wrap.innerHTML = `
    ${roundColHtml('16 Besar',         br.r16,    data)}
    ${roundColHtml('Quarter Final',    br.qf,     data)}
    ${roundColHtml('Semi Final',       br.sf,     data)}
    ${roundColHtml('Perebutan Juara 3',br.bronze, data)}
    ${roundColHtml('Grand Final',      br.final,  data, true)}
  `;
}

function roundColHtml(title, matches, data, isFinal = false) {
  return `
    <div class="round-col">
      <div class="round-title">${title}</div>
      ${matches.map((m, i) => bracketMatchPublicHtml(m, i+1, data, isFinal)).join('')}
    </div>`;
}

function bracketMatchPublicHtml(m, idx, data, isFinal = false) {
  const a    = teamById(m.teamA, data);
  const b    = teamById(m.teamB, data);
  const winA = m.winner && m.winner === m.teamA;
  const winB = m.winner && m.winner === m.teamB;

  return `
    <div class="bracket-match ${isFinal ? 'final' : ''}">
      <span class="bm-tag">Match ${idx} • BO3</span>
      <div class="bm-row ${winA ? 'win' : (m.winner ? 'lose' : '')}">
        <div class="bm-team"><span>${a?.name || 'TBD'}</span></div>
        <div class="bm-score">${m.played ? m.scoreA : '-'}</div>
      </div>
      <div class="bm-row ${winB ? 'win' : (m.winner ? 'lose' : '')}">
        <div class="bm-team"><span>${b?.name || 'TBD'}</span></div>
        <div class="bm-score">${m.played ? m.scoreB : '-'}</div>
      </div>
    </div>`;
}

/* ─── TEAMS ─── */
function renderTeams() {
  const wrap = document.getElementById('teamsGrid');
  if (!wrap) return;
  const data   = getData();
  const search = (document.getElementById('searchTeams')?.value || '').toLowerCase();
  const list   = data.teams.filter(t =>
    t.name.toLowerCase().includes(search) || t.tag.toLowerCase().includes(search)
  );
  if (!list.length) {
    wrap.innerHTML = emptyState('🔍','Tim tidak ditemukan','Coba kata kunci lain.');
    return;
  }
  wrap.innerHTML = list.map(t => `
    <div class="team-card">
      <div class="team-logo-placeholder">⚔</div>
      <h4>${t.name}</h4>
      <span class="team-group">Grup ${t.group}</span>
    </div>
  `).join('');
}

/* ─── STATS ─── */
function renderStats() {
  const wrap = document.getElementById('statsCards');
  if (!wrap) return;
  const data        = getData();
  const totalM      = data.matches.length;
  const played      = data.matches.filter(m => m.played).length;
  const champ       = data.bracket?.final?.[0]?.winner
                      ? teamById(data.bracket.final[0].winner, data) : null;
  const bronze3rd   = data.bracket?.bronze?.[0]?.winner
                      ? teamById(data.bracket.bronze[0].winner, data) : null;

  wrap.innerHTML = `
    ${statCard('Tim Peserta',   data.teams.length)}
    ${statCard('Total Match',   totalM)}
    ${statCard('Match Selesai', played)}
    ${statCard('Progres',       totalM ? Math.round(played/totalM*100)+'%' : '0%')}
    ${statCard('Juara 🏆',      champ   ? champ.name   : '—')}
    ${statCard('Juara 3 🥉',    bronze3rd ? bronze3rd.name : '—')}
  `;

  const top = document.getElementById('topTeams');
  if (top) {
    const all = [];
    const standings = computeStandings(data);
    GROUPS.forEach(g => standings[g].forEach(t => all.push(t)));
    all.sort((a,b) => b.points - a.points || b.win - a.win);
    top.innerHTML = all.slice(0,10).map((t,i) => `
      <div class="top-row">
        <div class="top-rank">${i+1}</div>
        <div><b>${t.name}</b> <small style="color:var(--text-tertiary)">• Grup ${t.group}</small></div>
        <span class="top-pts">${t.points >= 0 ? '+' : ''}${t.points} pts</span>
      </div>`).join('');
  }
}

/* ─── REVEAL SCROLL ─── */
function setupReveal() {
  const els = document.querySelectorAll('.reveal');
  const io  = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: .1 });
  els.forEach(el => io.observe(el));
}

/* ─── COUNTDOWN ─── */
function startCountdown() {
  const cd = document.getElementById('countdown');
  if (!cd) return;
  const data   = getData();
  const tl     = getTimeline(data);
  const finalEntry = tl.find(t => t.id === 'final');
  /* Gunakan tanggal final dari timeline, fallback ke grandFinalDate */
  const target = finalEntry?.date
    ? new Date(finalEntry.date + 'T19:00:00').getTime()
    : new Date(data.grandFinalDate).getTime();

  const tick = () => {
    const diff  = Math.max(0, target - Date.now());
    const days  = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins  = Math.floor((diff % 3600000) / 60000);
    const secs  = Math.floor((diff % 60000) / 1000);
    document.getElementById('cd-days').textContent  = String(days).padStart(2,'0');
    document.getElementById('cd-hours').textContent = String(hours).padStart(2,'0');
    document.getElementById('cd-mins').textContent  = String(mins).padStart(2,'0');
    document.getElementById('cd-secs').textContent  = String(secs).padStart(2,'0');
  };
  tick();
  setInterval(tick, 1000);
}