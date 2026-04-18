'use strict';

class GuideApp {
  constructor() {
    this.S         = new AppState();
    this.logger    = new Logger(this);
    this.apiClient = new ApiClient(this);
    this.nav       = new Navigation(this);
    this.sidebar   = new Sidebar(this);
    this.grid      = new GuideGrid(this);
    this.viewer    = new GuideViewer(this);
    this.editor    = new GuideEditor(this);
    this.admin     = new AdminPanel(this);
    this._stimer   = null;

    try {
      this.S.catIcons = JSON.parse(localStorage.getItem('pg:catIcons') || '{}');
      JSON.parse(localStorage.getItem('pg:collapsedCats') || '[]').forEach(c => this.S.collapsedCats.add(c));
    } catch {}

    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); document.getElementById('si')?.focus(); }
      if (e.key === 'Escape') {
        if (document.getElementById('ap-overlay').classList.contains('on')) { this.admin.close(); return; }
        if (document.getElementById('ed-overlay').style.display === 'flex') { this.editor.close(); return; }
        if (this.S.view === 'guide') this.nav.back();
      }
    });
  }

  async connect() {
    const host = v('fh'), port = +v('fp') || 7842, user = v('fu'), pass = v('fpass');
    if (!host || !user || !pass) return this._showErr('כתובת שרת, שם משתמש וסיסמה הם שדות חובה.');
    this._btnState(true);
    this.S.apiBase = `http://${host}:${port}`;
    try {
      const lr = await fetch(`${this.S.apiBase}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass })
      });
      const ld = await lr.json();
      if (!lr.ok) throw new Error(ld.error || 'כניסה נכשלה');
      this.S.host = host; this.S.apiToken = ld.token; this.S.userRole = ld.role; this.S.apiUser = ld.username;
      this.logger.add(`מחובר כ-${ld.username} (${ld.role})`, 's');
    } catch (err) {
      this.S.apiBase = ''; this._btnState(false);
      return this._showErr(err.message);
    }
    this._btnState(false);
    this._goApp();
    await this.loadGuides();
  }

  async disconnect() {
    if (this.S.apiToken) try { await this.apiClient.call('POST', '/api/logout', {}); } catch {}
    this.S.guides = []; this.S.cur = null; this.S.recent = [];
    this.S.apiToken = ''; this.S.userRole = null; this.S.apiUser = null; this.S.apiBase = '';
    document.getElementById('as').classList.remove('on');
    document.getElementById('ls').classList.add('on');
    document.getElementById('cd').classList.remove('on');
    document.getElementById('cl').textContent = 'מנותק';
    document.getElementById('lerr').classList.remove('on');
    this._btnState(false);
  }

  async loadGuides() {
    const rb = document.getElementById('rb'); rb.classList.add('spin');
    setC(ldg('טוען מדריכים...'));
    try {
      const { guides } = await this.apiClient.call('GET', '/api/guides');
      rb.classList.remove('spin');
      this.S.guides = guides.map(g => ({ ...g, icon: g.frontmatter?.icon || this.sidebar.catIcon(g.pathParts?.[0] || g.cat) }));
      this.sidebar.build(); this.nav.home();
      this.logger.add(`נטענו ${this.S.guides.length} מדריכים`, 's');
    } catch (err) {
      rb.classList.remove('spin');
      setC(`<div class="gv"><div class="es"><div class="es-i">⚠️</div><h3>טעינה נכשלה</h3><p>${esc(err.message)}</p></div></div>`);
      this.logger.add(err.message, 'e');
    }
  }

  onSearch(q) {
    clearTimeout(this._stimer);
    this.S.q = q;
    this._stimer = setTimeout(() => { if (this.S.view !== 'guide') this.grid.render(); }, 200);
  }

  _btnState(busy) {
    const b = document.getElementById('cbtn');
    b.disabled = busy; b.textContent = busy ? 'מתחבר...' : 'התחבר';
  }

  _showErr(m) {
    const e = document.getElementById('lerr');
    e.textContent = '⚠ ' + m; e.classList.add('on');
  }

  _goApp() {
    document.getElementById('ls').classList.remove('on');
    document.getElementById('as').classList.add('on');
    document.getElementById('cd').classList.add('on');
    const label = `${this.S.apiUser}@${this.S.host} (${this.S.userRole})`;
    document.getElementById('cl').textContent = label;
    document.getElementById('cinfo').textContent = label;
    const isAdmin = this.S.userRole === 'admin';
    document.getElementById('ngb').style.display = isAdmin ? '' : 'none';
    document.getElementById('ap-btn').style.display = isAdmin ? '' : 'none';
  }
}

window.app = new GuideApp();
