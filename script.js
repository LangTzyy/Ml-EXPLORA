/* ============================================================
   MLWC - Tournament Engine (Shared Public Logic)
   Pure JavaScript. All state persisted to localStorage.
   ============================================================
   STRUKTUR DATA (localStorage key: 'mlwc_data'):
   {
     teams: [{ id, name, tag, region, group, logoColor }],
     matches: [{
        id, group, teamA, teamB,
        scoreA, scoreB, played:bool,
        date: ISOstring
     }],
     bracket: {
        r16: [{id, teamA, teamB, scoreA, scoreB, winner}],
        qf:  [...],
        sf:  [...],
        bronze: [...],
        final: [...]
     },
     grandFinalDate: ISOstring,
     meta: { createdAt }
   }
   ============================================================ */

const STORAGE_KEY = 'mlwc_data';
const AUTH_KEY = 'mlwc_auth';

// 32 dummy team names (esports vibes)
const DUMMY_TEAMS = [
  ['ONIC','Esports','ID'], ['RRQ','Hoshi','ID'], ['EVOS','Legends','ID'], ['Alter Ego','AE','ID'],
  ['Bigetron','BTR','ID'], ['Geek Fam','GFI','ID'], ['Aura','Fire','ID'], ['Rebellion','REB','ID'],
  ['Blacklist','BLK','PH'], ['ECHO','Proud','PH'], ['Falcons AP','APB','PH'], ['Smart Omega','OMG','PH'],
  ['TNC','Pro','PH'], ['RSG','PH','PH'], ['Nexplay','EVOS','PH'], ['Minana','MNA','PH'],
  ['Burmese Ghouls','BG','MM'], ['Falcon Esports','FE','MM'], ['ArkAngel','ARK','MM'], ['Team Flash','FLA','MM'],
  ['Todak','TDK','MY'], ['Geek Fam MY','GFM','MY'], ['Orange Esports','ORA','MY'], ['HomeBois','HMB','MY'],
  ['Bren Esports','BRE','PH'], ['Cignal Ultra','CIG','PH'], ['NIP','NIP','EU'], ['SeeYouSoon','SYS','SG'],
  ['Resurgence','RSG','SG'], ['Team Secret','SEC','EU'], ['EXP Esports','EXP','TH'], ['King of Gamers','KOG','TH']
];

const REGIONS = { ID:'Indonesia', PH:'Philippines', MM:'Myanmar', MY:'Malaysia', SG:'Singapore', TH:'Thailand', EU:'Europe' };
const GROUPS = ['A','B','C','D','E','F','G','H'];
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

/* ============== STORAGE HELPERS ============== */
function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { return JSON.parse(raw); } catch(e) {}
  }
  const data = generateInitialData();
  saveData(data);
  return data;
}
function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
function getData() { return loadData(); }

/* ============== INIT / SEED ============== */
function generateInitialData() {
  const teams = DUMMY_TEAMS.map((t, i) => ({
    id: 't' + (i+1),
    name: t[0],
    tag: t[1],
    region: t[2],
    group: GROUPS[Math.floor(i / 4)],
    logoColor: LOGO_COLORS[i % LOGO_COLORS.length]
  }));
  const matches = generateGroupSchedule(teams);
  const grandFinalDate = new Date(Date.now() + 1000*60*60*24*30).toISOString();
  return {
    teams,
    matches,
    bracket: { r16:[], qf:[], sf:[], bronze:[], final:[] },
    grandFinalDate,
    meta: { createdAt: new Date().toISOString() }
  };
}

function generateGroupSchedule(teams) {
  const matches = [];
  let mid = 1;
  const startBase = Date.now() + 1000*60*60*24;

  GROUPS.forEach((g, gi) => {
    const groupTeams = teams.filter(t => t.group === g);
    for (let i = 0; i < groupTeams.length; i++) {
      for (let j = i+1; j < groupTeams.length; j++) {
        matches.push({
          id: 'm' + (mid++),
          group: g,
          teamA: groupTeams[i].id,
          teamB: groupTeams[j].id,
          scoreA: 0,
          scoreB: 0,
          played: false,
          date: new Date(startBase + (gi*6 + (mid % 6)) * 1000*60*60*8).toISOString()
        });
      }
    }
  });
  return matches;
}

function computeStandings(data = getData()) {
  const standings = {};
  GROUPS.forEach(g => {
    const groupTeams = data.teams.filter(t => t.group === g);
    standings[g] = groupTeams.map(t => ({
      ...t, played:0, win:0, lose:0, points:0
    }));
  });
  data.matches.forEach(m => {
    if (!m.played) return;
    const grp = standings[m.group]; if (!grp) return;
    const a = grp.find(t => t.id === m.teamA);
    const b = grp.find(t => t.id === m.teamB);
    if (!a || !b) return;
    a.played++; b.played++;
    if (m.scoreA > m.scoreB) { a.win++; b.lose++; a.points += 3; }
    else if (m.scoreB > m.scoreA) { b.win++; a.lose++; b.points += 3; }
  });
  Object.keys(standings).forEach(g => {
    standings[g].sort((x,y) =>
      y.points - x.points || y.win - x.win || x.name.localeCompare(y.name)
    );
  });
  return standings;
}

function teamById(id, data = getData()) {
  return data.teams.find(t => t.id === id);
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

/* ============== PUBLIC PAGE BOOTSTRAP ============== */
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

function setupNav() {
  const burger = document.getElementById('hamburger');
  const links = document.getElementById('navLinks');
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

function renderAll() {
  renderSchedule();
  renderStandings();
  renderResults();
  renderBracket('bracket');
  renderTeams();
  renderStats();
  populateGroupFilter();
}

function renderSchedule() {
  const wrap = document.getElementById('scheduleList');
  if (!wrap) return;
  const data = getData();
  const search = (document.getElementById('searchSchedule')?.value || '').toLowerCase();
  const groupF = document.getElementById('filterGroup')?.value || '';
  const statusF = document.getElementById('filterStatus')?.value || '';

  let list = data.matches.slice().sort((a,b) => new Date(a.date) - new Date(b.date));
  if (groupF) list = list.filter(m => m.group === groupF);
  if (statusF === 'upcoming') list = list.filter(m => !m.played);
  if (statusF === 'finished') list = list.filter(m => m.played);
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
  wrap.innerHTML = list.slice(0, 60).map(m => matchCardHtml(m, data)).join('');
}

function matchCardHtml(m, data) {
  const a = teamById(m.teamA, data);
  const b = teamById(m.teamB, data);
  const today = isToday(m.date);
  const dateStr = formatDate(m.date);
  const winA = m.played && m.scoreA > m.scoreB;
  const winB = m.played && m.scoreB > m.scoreA;
  return `
    <div class="match-card ${today && !m.played ? 'today' : ''}">
      <div class="match-meta">
        <span class="match-tag">Grup ${m.group} • BO1</span>
        <span class="match-tag ${m.played ? 'done' : (today ? 'gold' : '')}">${m.played ? '✓ Selesai' : (today ? '🔴 Hari Ini' : dateStr)}</span>
      </div>
      <div class="match-row">
        <div class="match-team ${winA ? 'win' : (m.played ? 'lose' : '')}"><span>${a?.name || '?'}</span></div>
        <div class="match-score ${m.played ? '' : 'vs'}">${m.played ? `${m.scoreA} - ${m.scoreB}` : 'VS'}</div>
        <div class="match-team right ${winB ? 'win' : (m.played ? 'lose' : '')}"><span>${b?.name || '?'}</span></div>
      </div>
      <div class="match-meta" style="margin-top:12px;margin-bottom:0;">
        <span>${a?.region || ''}</span><span>${b?.region || ''}</span>
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
  if (!sel) return;
  GROUPS.forEach(g => {
    const o = document.createElement('option');
    o.value = g; o.textContent = `Grup ${g}`;
    sel.appendChild(o);
  });
}

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
        <td>${t.lose}</td>
        <td><b>${t.points}</b></td>
      </tr>
    `).join('');
    return `
      <div class="group-card">
        <div class="group-title">GRUP ${g}</div>
        <table class="standings-table">
          <thead><tr><th>Tim</th><th>M</th><th>W</th><th>L</th><th>Pts</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join('');
}

function renderResults() {
  const wrap = document.getElementById('resultsList');
  if (!wrap) return;
  const data = getData();
  const list = data.matches.filter(m => m.played).slice(-30).reverse();
  if (!list.length) {
    wrap.innerHTML = emptyState('📭','Belum ada hasil','Hasil pertandingan akan muncul di sini.');
    return;
  }
  wrap.innerHTML = list.map(m => matchCardHtml(m, data)).join('');
}

function buildBracketFromStandings(data = getData()) {
  const standings = computeStandings(data);
  const seeds = [];
  GROUPS.forEach(g => {
    const top = standings[g];
    seeds.push({ group:g, pos:1, team: top[0] });
    seeds.push({ group:g, pos:2, team: top[1] });
  });
  const pairs = [
    ['A',1,'B',2],['C',1,'D',2],['E',1,'F',2],['G',1,'H',2],
    ['B',1,'A',2],['D',1,'C',2],['F',1,'E',2],['H',1,'G',2]
  ];
  const r16 = pairs.map((p, i) => {
    const a = seeds.find(s => s.group === p[0] && s.pos === p[1]);
    const b = seeds.find(s => s.group === p[2] && s.pos === p[3]);
    return {
      id: 'r16-' + (i+1),
      teamA: a?.team?.id || null,
      teamB: b?.team?.id || null,
      scoreA: 0, scoreB: 0, winner: null
    };
  });
  const qf = Array.from({length:4}, (_,i) => ({ id:'qf-'+(i+1), teamA:null, teamB:null, scoreA:0, scoreB:0, winner:null }));
  const sf = Array.from({length:2}, (_,i) => ({ id:'sf-'+(i+1), teamA:null, teamB:null, scoreA:0, scoreB:0, winner:null }));
  const bronze = [{ id:'bronze-1', teamA:null, teamB:null, scoreA:0, scoreB:0, winner:null }];
  const final  = [{ id:'final-1', teamA:null, teamB:null, scoreA:0, scoreB:0, winner:null }];
  return { r16, qf, sf, bronze, final };
}

function advanceBracket(data) {
  const br = data.bracket;
  for (let i = 0; i < 4; i++) {
    const m1 = br.r16[i*2], m2 = br.r16[i*2+1];
    br.qf[i].teamA = m1?.winner || null;
    br.qf[i].teamB = m2?.winner || null;
    if (!m1?.winner || !m2?.winner) {
      br.qf[i].winner = null; br.qf[i].scoreA = 0; br.qf[i].scoreB = 0;
    }
  }
  for (let i = 0; i < 2; i++) {
    const m1 = br.qf[i*2], m2 = br.qf[i*2+1];
    br.sf[i].teamA = m1?.winner || null;
    br.sf[i].teamB = m2?.winner || null;
    if (!m1?.winner || !m2?.winner) {
      br.sf[i].winner = null; br.sf[i].scoreA = 0; br.sf[i].scoreB = 0;
    }
  }
  const sf1 = br.sf[0], sf2 = br.sf[1];
  br.final[0].teamA = sf1?.winner || null;
  br.final[0].teamB = sf2?.winner || null;
  br.bronze[0].teamA = (sf1?.winner && sf1?.teamA) ? (sf1.winner === sf1.teamA ? sf1.teamB : sf1.teamA) : null;
  br.bronze[0].teamB = (sf2?.winner && sf2?.teamA) ? (sf2.winner === sf2.teamA ? sf2.teamB : sf2.teamA) : null;
  if (!sf1?.winner || !sf2?.winner) {
    br.final[0].winner = null; br.final[0].scoreA = 0; br.final[0].scoreB = 0;
    br.bronze[0].winner = null; br.bronze[0].scoreA = 0; br.bronze[0].scoreB = 0;
  }
  return data;
}

function renderBracket(elementId) {
  const wrap = document.getElementById(elementId);
  if (!wrap) return;
  const data = getData();
  const br = data.bracket;
  if (!br.r16 || !br.r16.length) {
    wrap.innerHTML = `<div class="empty-state" style="margin:auto"><div class="emo">🏆</div>
      <h4>Bracket Belum Tersedia</h4>
      <p>Bracket akan muncul setelah admin generate dari klasemen grup.</p></div>`;
    return;
  }
  wrap.innerHTML = `
    ${roundColHtml('16 Besar', br.r16, data)}
    ${roundColHtml('Quarter Final', br.qf, data)}
    ${roundColHtml('Semi Final', br.sf, data)}
    ${roundColHtml('Perebutan Juara 3', br.bronze, data)}
    ${roundColHtml('Grand Final', br.final, data, true)}
  `;
}

function roundColHtml(title, matches, data, isFinal = false) {
  return `
    <div class="round-col">
      <div class="round-title">${title}</div>
      ${matches.map((m, i) => bracketMatchHtml(m, i+1, data, isFinal)).join('')}
    </div>`;
}

function bracketMatchHtml(m, idx, data, isFinal=false) {
  const a = teamById(m.teamA, data);
  const b = teamById(m.teamB, data);
  const winA = m.winner && m.winner === m.teamA;
  const winB = m.winner && m.winner === m.teamB;
  return `
    <div class="bracket-match ${isFinal ? 'final' : ''}">
      <span class="bm-tag">Match ${idx} • BO3</span>
      <div class="bm-row ${winA ? 'win' : (m.winner ? 'lose' : '')}">
        <div class="bm-team"><span>${a?.name || 'TBD'}</span></div>
        <div class="bm-score">${m.scoreA ?? 0}</div>
      </div>
      <div class="bm-row ${winB ? 'win' : (m.winner ? 'lose' : '')}">
        <div class="bm-team"><span>${b?.name || 'TBD'}</span></div>
        <div class="bm-score">${m.scoreB ?? 0}</div>
      </div>
    </div>`;
}

function renderTeams() {
  const wrap = document.getElementById('teamsGrid');
  if (!wrap) return;
  const data = getData();
  const search = (document.getElementById('searchTeams')?.value || '').toLowerCase();
  const list = data.teams.filter(t =>
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
      <div class="team-region">${REGIONS[t.region] || t.region}</div>
      <span class="team-group">Grup ${t.group}</span>
    </div>
  `).join('');
}

function renderStats() {
  const wrap = document.getElementById('statsCards');
  if (!wrap) return;
  const data = getData();
  const totalMatches = data.matches.length;
  const played = data.matches.filter(m => m.played).length;
  const teamsCount = data.teams.length;
  const champ = data.bracket?.final?.[0]?.winner ? teamById(data.bracket.final[0].winner, data) : null;
  wrap.innerHTML = `
    ${statCard('Tim Peserta', teamsCount)}
    ${statCard('Total Match', totalMatches)}
    ${statCard('Match Selesai', played)}
    ${statCard('Progres', Math.round(played/totalMatches*100) + '%')}
    ${statCard('Juara', champ ? champ.name : '—')}
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
        <div><b>${t.name}</b> <small style="color:var(--text-dim)">• Grup ${t.group}</small></div>
        <span class="top-pts">${t.points} pts</span>
      </div>
    `).join('');
  }
}
function statCard(label, value) {
  return `<div class="stat-card"><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div>`;
}

function emptyState(emo, title, msg) {
  return `<div class="empty-state" style="grid-column:1/-1"><div class="emo">${emo}</div><h4>${title}</h4><p>${msg}</p></div>`;
}
function isToday(iso) {
  const d = new Date(iso); const t = new Date();
  return d.toDateString() === t.toDateString();
}
function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
}

function setupReveal() {
  const els = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: .1 });
  els.forEach(el => io.observe(el));
}

function startCountdown() {
  const cd = document.getElementById('countdown');
  if (!cd) return;
  const data = getData();
  const target = new Date(data.grandFinalDate).getTime();
  const tick = () => {
    const diff = Math.max(0, target - Date.now());
    const days  = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins  = Math.floor((diff % 3600000) / 60000);
    const secs  = Math.floor((diff % 60000) / 1000);
    document.getElementById('cd-days').textContent  = String(days).padStart(2,'0');
    document.getElementById('cd-hours').textContent = String(hours).padStart(2,'0');
    document.getElementById('cd-mins').textContent  = String(mins).padStart(2,'0');
    document.getElementById('cd-secs').textContent  = String(secs).padStart(2,'0');
  };
  tick(); setInterval(tick, 1000);
}