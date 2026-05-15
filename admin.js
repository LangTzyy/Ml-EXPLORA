/* ============================================================
   MLWC ADMIN DASHBOARD
   Login dummy, CRUD tim, input hasil, generate bracket, dsb.
   Default credentials: admin / admin123
   ============================================================ */

const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';

document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('loginForm')) return;
  initAdmin();
});

function initAdmin() {
  if (sessionStorage.getItem(AUTH_KEY) === '1') {
    showShell();
  }

  document.getElementById('loginForm').addEventListener('submit', e => {
    e.preventDefault();
    const u = document.getElementById('loginUser').value.trim();
    const p = document.getElementById('loginPass').value;
    if (u === ADMIN_USER && p === ADMIN_PASS) {
      sessionStorage.setItem(AUTH_KEY, '1');
      showShell();
      toast('Login berhasil. Selamat datang, Admin!', 'success');
    } else {
      toast('Username atau password salah', 'error');
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem(AUTH_KEY);
    location.reload();
  });

  document.querySelectorAll('.side-link').forEach(a => {
    a.addEventListener('click', () => switchTab(a.dataset.tab));
  });

  const sidebar = document.getElementById('sidebar');
  document.getElementById('adminHamb').addEventListener('click', () => sidebar.classList.toggle('open'));

  document.getElementById('addTeamBtn').addEventListener('click', () => openTeamModal());
  document.getElementById('genScheduleBtn').addEventListener('click', regenerateSchedule);
  document.getElementById('genBracketBtn').addEventListener('click', generateBracket);
  document.getElementById('resetBtn').addEventListener('click', resetAll);
  document.getElementById('simulateBtn').addEventListener('click', simulateAll);
  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('importFile').addEventListener('change', importData);

  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target.id === 'modalOverlay') closeModal();
  });
}

function showShell() {
  document.getElementById('loginOverlay').classList.add('hidden');
  document.getElementById('adminShell').classList.remove('hidden');
  renderAdmin();
}

function switchTab(name) {
  document.querySelectorAll('.side-link').forEach(a => a.classList.toggle('active', a.dataset.tab === name));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('hidden', t.dataset.tab !== name));
  const titles = { dashboard:'Dashboard', teams:'Kelola Tim', schedule:'Jadwal Grup', results:'Input Hasil', playoff:'Playoff Bracket', settings:'Pengaturan' };
  document.getElementById('tabTitle').textContent = titles[name] || name;
  document.getElementById('sidebar').classList.remove('open');
  renderAdmin();
}

function renderAdmin() {
  renderAdminStats();
  renderAdminTeams();
  renderAdminSchedule();
  renderAdminResults();
  renderBracket('adminBracket');
  renderUpcomingMini();
}

function renderAdminStats() {
  const wrap = document.getElementById('adminStats');
  if (!wrap) return;
  const data = getData();
  const played = data.matches.filter(m => m.played).length;
  wrap.innerHTML = `
    ${statCard('Total Tim', data.teams.length)}
    ${statCard('Match Grup', data.matches.length)}
    ${statCard('Match Selesai', played)}
    ${statCard('Progres', Math.round(played/data.matches.length*100) + '%')}
    ${statCard('Bracket', data.bracket?.r16?.length ? 'Aktif' : 'Belum')}
  `;
}

function renderUpcomingMini() {
  const wrap = document.getElementById('upcomingMini');
  if (!wrap) return;
  const data = getData();
  const list = data.matches.filter(m => !m.played).slice(0,6);
  if (!list.length) {
    wrap.innerHTML = emptyState('✅','Semua match sudah selesai','');
    return;
  }
  wrap.innerHTML = list.map(m => matchCardHtml(m, data)).join('');
}

function renderAdminTeams() {
  const wrap = document.getElementById('adminTeams');
  if (!wrap) return;
  const data = getData();
  document.getElementById('teamCount').textContent = data.teams.length;
  wrap.innerHTML = data.teams.map(t => `
    <div class="team-card">
      <div class="team-logo-placeholder">⚔</div>
      <h4>${t.name}</h4>
      <div class="team-region">${REGIONS[t.region] || t.region} • ${t.tag}</div>
      <span class="team-group">Grup ${t.group}</span>
      <div class="team-actions">
        <button class="btn btn-ghost sm" onclick="openTeamModal('${t.id}')">✏ Edit</button>
        <button class="btn btn-danger sm" onclick="deleteTeam('${t.id}')">🗑</button>
      </div>
    </div>
  `).join('');
}

function openTeamModal(id) {
  const data = getData();
  const t = id ? data.teams.find(x => x.id === id) : null;
  openModal(t ? 'Edit Tim' : 'Tambah Tim Baru', `
    <div class="form-grid">
      <div><label>Nama Tim</label><input id="fName" class="input" value="${t?.name || ''}"/></div>
      <div><label>Tag / Singkatan</label><input id="fTag" class="input" value="${t?.tag || ''}"/></div>
      <div><label>Region</label>
        <select id="fRegion" class="input">
          ${Object.entries(REGIONS).map(([k,v]) => `<option value="${k}" ${t?.region===k?'selected':''}>${v}</option>`).join('')}
        </select>
      </div>
      <div><label>Grup</label>
        <select id="fGroup" class="input">
          ${GROUPS.map(g => `<option value="${g}" ${t?.group===g?'selected':''}>Grup ${g}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="saveTeam('${id || ''}')">💾 Simpan</button>
    </div>
  `);
}

window.saveTeam = function(id) {
  const data = getData();
  const name = document.getElementById('fName').value.trim();
  const tag = document.getElementById('fTag').value.trim();
  const region = document.getElementById('fRegion').value;
  const group = document.getElementById('fGroup').value;
  if (!name || !tag) { toast('Nama dan tag wajib diisi','error'); return; }
  if (id) {
    const t = data.teams.find(x => x.id === id);
    Object.assign(t, { name, tag, region, group });
  } else {
    data.teams.push({
      id: 't' + Date.now(),
      name, tag, region, group,
      logoColor: LOGO_COLORS[data.teams.length % LOGO_COLORS.length]
    });
  }
  saveData(data);
  closeModal();
  renderAdmin();
  toast('Tim disimpan','success');
};

window.deleteTeam = function(id) {
  if (!confirm('Hapus tim ini? Aksi tidak bisa dibatalkan.')) return;
  const data = getData();
  data.teams = data.teams.filter(t => t.id !== id);
  data.matches = data.matches.filter(m => m.teamA !== id && m.teamB !== id);
  saveData(data);
  renderAdmin();
  toast('Tim dihapus','success');
};

function renderAdminSchedule() {
  const wrap = document.getElementById('adminSchedule');
  if (!wrap) return;
  const data = getData();
  if (!data.matches.length) {
    wrap.innerHTML = emptyState('📅','Belum ada jadwal','Klik Generate Ulang.');
    return;
  }
  wrap.innerHTML = data.matches.slice(0, 80).map(m => matchCardHtml(m, data)).join('');
}

function regenerateSchedule() {
  if (!confirm('Generate ulang jadwal grup? Skor lama akan hilang.')) return;
  const data = getData();
  data.matches = generateGroupSchedule(data.teams);
  saveData(data);
  renderAdmin();
  toast('Jadwal grup berhasil di-generate','success');
}

function renderAdminResults() {
  const wrap = document.getElementById('adminResults');
  if (!wrap) return;
  const data = getData();
  wrap.innerHTML = data.matches.slice(0,80).map(m => {
    const a = teamById(m.teamA, data);
    const b = teamById(m.teamB, data);
    return `
      <div class="match-card">
        <div class="match-meta">
          <span class="match-tag">Grup ${m.group} • BO1</span>
          <span class="match-tag ${m.played ? 'done' : ''}">${m.played ? '✓ Selesai' : 'Belum'}</span>
        </div>
        <div class="match-row">
          <div class="match-team"><span>${a?.name}</span></div>
          <div class="match-score vs">VS</div>
          <div class="match-team right"><span>${b?.name}</span></div>
        </div>
        <div class="score-input">
          <div style="text-align:center;font-size:.75rem;color:var(--text-dim)">${a?.tag}</div>
          <input type="number" min="0" max="1" value="${m.scoreA}" id="sA-${m.id}"/>
          <span class="vs-mid">:</span>
          <input type="number" min="0" max="1" value="${m.scoreB}" id="sB-${m.id}"/>
          <div style="text-align:center;font-size:.75rem;color:var(--text-dim)">${b?.tag}</div>
        </div>
        <button class="btn btn-primary block mt-md" onclick="saveBO1('${m.id}')">💾 Simpan Skor</button>
      </div>`;
  }).join('');
}

window.saveBO1 = function(id) {
  const data = getData();
  const m = data.matches.find(x => x.id === id);
  const a = parseInt(document.getElementById('sA-'+id).value, 10);
  const b = parseInt(document.getElementById('sB-'+id).value, 10);
  if (![0,1].includes(a) || ![0,1].includes(b) || a === b) {
    toast('Skor BO1 hanya 1-0 atau 0-1','error'); return;
  }
  m.scoreA = a; m.scoreB = b; m.played = true;
  saveData(data);
  renderAdmin();
  toast('Hasil disimpan','success');
};

function generateBracket() {
  const data = getData();
  const allPlayed = data.matches.every(m => m.played);
  if (!allPlayed && !confirm('Belum semua match grup selesai. Tetap generate bracket?')) return;
  data.bracket = buildBracketFromStandings(data);
  saveData(data);
  renderAdmin();
  toast('Bracket playoff berhasil di-generate','success');
  switchTab('playoff');
  setTimeout(renderPlayoffEditor, 100);
}

const _origRenderBracket = renderBracket;
renderBracket = function(id) {
  _origRenderBracket(id);
  if (id === 'adminBracket') renderPlayoffEditor();
};

function renderPlayoffEditor() {
  const wrap = document.getElementById('adminBracket');
  if (!wrap) return;
  wrap.querySelectorAll('.bracket-match').forEach((el, idx) => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => openBO3Modal(el, idx));
  }, { once:true });
}

function openBO3Modal(el) {
  const data = getData();
  const allMatches = [...data.bracket.r16, ...data.bracket.qf, ...data.bracket.sf, ...data.bracket.bronze, ...data.bracket.final];
  const wrap = document.getElementById('adminBracket');
  const allEl = [...wrap.querySelectorAll('.bracket-match')];
  const idx = allEl.indexOf(el);
  const m = allMatches[idx];
  if (!m) return;
  if (!m.teamA || !m.teamB) {
    toast('Tim belum tersedia (menunggu round sebelumnya)','warning');
    return;
  }
  const a = teamById(m.teamA, data);
  const b = teamById(m.teamB, data);

  openModal('Input Skor BO3', `
    <p class="muted">Format: First to 2 wins. Skor valid: 2-0, 2-1, 0-2, 1-2.</p>
    <div class="score-input">
      <div style="text-align:center"><b>${a?.name}</b></div>
      <input type="number" min="0" max="2" value="${m.scoreA}" id="bo3A"/>
      <span class="vs-mid">:</span>
      <input type="number" min="0" max="2" value="${m.scoreB}" id="bo3B"/>
      <div style="text-align:center"><b>${b?.name}</b></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Batal</button>
      <button class="btn btn-primary" onclick="saveBO3('${m.id}')">💾 Simpan</button>
    </div>
  `);
}

window.saveBO3 = function(matchId) {
  const data = getData();
  const all = [...data.bracket.r16, ...data.bracket.qf, ...data.bracket.sf, ...data.bracket.bronze, ...data.bracket.final];
  const m = all.find(x => x.id === matchId);
  const a = parseInt(document.getElementById('bo3A').value, 10);
  const b = parseInt(document.getElementById('bo3B').value, 10);
  const valid = [[2,0],[2,1],[0,2],[1,2]].some(p => p[0]===a && p[1]===b);
  if (!valid) { toast('Skor BO3 tidak valid','error'); return; }
  m.scoreA = a; m.scoreB = b;
  m.winner = a > b ? m.teamA : m.teamB;
  advanceBracket(data);
  saveData(data);
  closeModal();
  renderAdmin();
  toast('Hasil BO3 tersimpan','success');
};

function resetAll() {
  if (!confirm('Reset SEMUA data turnamen? Aksi ini tidak bisa dibatalkan.')) return;
  localStorage.removeItem(STORAGE_KEY);
  loadData();
  renderAdmin();
  toast('Data direset & dummy baru dibuat','success');
}

function simulateAll() {
  if (!confirm('Simulasikan seluruh turnamen secara acak?')) return;
  const data = getData();
  data.matches.forEach(m => {
    if (Math.random() > .5) { m.scoreA = 1; m.scoreB = 0; }
    else { m.scoreA = 0; m.scoreB = 1; }
    m.played = true;
  });
  data.bracket = buildBracketFromStandings(data);
  const simulateRound = (round) => {
    round.forEach(m => {
      if (!m.teamA || !m.teamB) return;
      if (Math.random() > .5) { m.scoreA = 2; m.scoreB = Math.random() > .5 ? 1 : 0; m.winner = m.teamA; }
      else { m.scoreB = 2; m.scoreA = Math.random() > .5 ? 1 : 0; m.winner = m.teamB; }
    });
  };
  simulateRound(data.bracket.r16); advanceBracket(data);
  simulateRound(data.bracket.qf);  advanceBracket(data);
  simulateRound(data.bracket.sf);  advanceBracket(data);
  simulateRound(data.bracket.bronze);
  simulateRound(data.bracket.final);
  saveData(data);
  renderAdmin();
  toast('Turnamen berhasil disimulasikan','success');
}

function exportData() {
  const data = getData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `mlwc-export-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Data diexport','success');
}

function importData(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.teams || !data.matches) throw new Error('Invalid');
      saveData(data);
      renderAdmin();
      toast('Data berhasil diimport','success');
    } catch(err) { toast('File JSON tidak valid','error'); }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function openModal(title, html) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = html;
  document.getElementById('modalOverlay').classList.remove('hidden');
}
window.closeModal = function() {
  document.getElementById('modalOverlay').classList.add('hidden');
};

window.toast = function(msg, type = 'info') {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${msg}</span>`;
  c.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(50px)';
  }, 2700);
  setTimeout(() => el.remove(), 3100);
};