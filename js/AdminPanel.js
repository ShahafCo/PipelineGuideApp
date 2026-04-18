'use strict';

class AdminPanel {
  constructor(app) { this.app = app; this._sortKey = 'updatedAt'; this._sortAsc = true; }

  open() { document.getElementById('ap-overlay').classList.add('on'); this.render(); }

  close() { document.getElementById('ap-overlay').classList.remove('on'); }

  overlayClick(e) { if (e.target === document.getElementById('ap-overlay')) this.close(); }

  sort(key) {
    if (this._sortKey === key) this._sortAsc = !this._sortAsc;
    else { this._sortKey = key; this._sortAsc = key === 'updatedAt'; }
    this.render();
  }

  render() {
    const S = this.app.S;
    const now = Date.now();
    const YEAR   = 365 * 24 * 3600 * 1000;
    const SIX_MO = 183 * 24 * 3600 * 1000;

    const rows = S.guides.map(g => {
      const ms = g.updatedAt ? new Date(g.updatedAt).getTime() : 0;
      return { ...g, _ms: ms, _age: now - ms };
    });

    const key = this._sortKey, asc = this._sortAsc;
    rows.sort((a, b) => {
      let va, vb;
      if (key === 'title') { va = a.title.toLowerCase(); vb = b.title.toLowerCase(); }
      else if (key === 'path') { va = a.path; vb = b.path; }
      else { va = a._ms; vb = b._ms; }
      return asc ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0);
    });

    const staleCount = rows.filter(r => r._age > YEAR).length;
    const warnCount  = rows.filter(r => r._age > SIX_MO && r._age <= YEAR).length;
    document.getElementById('ap-stats').textContent =
      `${rows.length} מדריכים · ${staleCount} ישנים · ${warnCount} מזדקנים`;

    ['title','path','updatedAt','age'].forEach(k => {
      const el = document.getElementById('aps-' + (k === 'age' ? 'updatedAt' : k));
      if (el) el.textContent = '';
    });
    const sortEl = document.getElementById('aps-' + (key === 'age' ? 'updatedAt' : key));
    if (sortEl) sortEl.textContent = asc ? '▲' : '▼';

    document.getElementById('ap-tbody').innerHTML = rows.map(r => {
      const stale = r._age > YEAR, warn = !stale && r._age > SIX_MO;
      const cls = stale ? 'ap-stale' : warn ? 'ap-warn' : '';
      const dateStr = r._ms ? new Date(r._ms).toLocaleDateString('he-IL', { year:'numeric', month:'short', day:'numeric' }) : '—';
      const ageDays = r._ms ? Math.floor(r._age / 86400000) : null;
      let ageStr = ageDays === null ? '—' : ageDays < 30 ? `${ageDays}י` : ageDays < 365 ? `${Math.floor(ageDays/30)}ח` : `${(ageDays/365).toFixed(1)}ש`;
      const badgeCls = stale ? 'ap-age-stale' : warn ? 'ap-age-warn' : 'ap-age-ok';
      const pathDisp = r.path.replace(/\/[^/]+\.md$/, '') || 'root';
      return `<tr class="${cls}" onclick="app.admin.close();app.viewer.open('${r.path.replace(/'/g,"\\'")}');" style="cursor:pointer">
        <td><strong>${esc(r.title)}</strong></td>
        <td class="ap-path">${esc(pathDisp)}</td>
        <td>${dateStr}</td>
        <td><span class="ap-age-badge ${badgeCls}">${ageStr}</span></td>
      </tr>`;
    }).join('');
  }
}
