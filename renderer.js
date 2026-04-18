'use strict';

// ── Constants ──────────────────────────────────────────────────────────────────
const GUIDE_ICONS = [
  '📋','📖','📄','📝','📚','⚙️','🔧','🔨','🏗️','🛠️','🚀','🔄','🎯','✅','💡',
  '⚠️','🚨','🔍','📊','📈','🗄️','🔐','🔑','🌐','💾','🔔','📌','🧩','📡','☁️',
  '🎛️','🔬','🏛️','🖥️','🐛','🔒','🔓','🧪','📦','🗂️','🔗','📎','🗃️','🖨️','🖱️'
];

// ── Utilities ──────────────────────────────────────────────────────────────────
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
function v(id)  { return document.getElementById(id)?.value?.trim() || ''; }
function setC(h){ document.getElementById('ct').innerHTML = h; }
function ldg(m) { return `<div class="es"><div class="spin2"></div><p>${m}</p></div>`; }

// ── AppState ───────────────────────────────────────────────────────────────────
class AppState {
  constructor() {
    this.host = ''; this.apiBase = '';
    this.apiToken = ''; this.userRole = null; this.apiUser = null;
    this.guides = []; this.recent = []; this.cur = null; this.done = new Set();
    this.view = 'home'; this.cat = null; this.q = ''; this.tag = ''; this.logCol = false;
    this.navPath = []; this.history = [];
    this.collapsedCats = new Set(); this.catIcons = {};
  }
}

// ── Logger ─────────────────────────────────────────────────────────────────────
class Logger {
  constructor(app) { this.app = app; }

  add(txt, type = '') {
    const out = document.getElementById('lo');
    const now = new Date().toLocaleTimeString('he', { hour12: false });
    txt.split('\n').filter(l => l.trim()).forEach(l => {
      const d = document.createElement('div'); d.className = 'll';
      d.innerHTML = `<span class="lt">${now}</span><span class="lx ${type}">${esc(l)}</span>`;
      out.appendChild(d);
    });
    out.scrollTop = out.scrollHeight;
  }

  toggle() {
    const S = this.app.S;
    S.logCol = !S.logCol;
    document.getElementById('lp').classList.toggle('col', S.logCol);
    document.getElementById('ltogico').setAttribute('points', S.logCol ? '6 9 12 15 18 9' : '18 15 12 9 6 15');
  }

  clear(e) { e.stopPropagation(); document.getElementById('lo').innerHTML = ''; }
}

// ── ApiClient ──────────────────────────────────────────────────────────────────
class ApiClient {
  constructor(app) { this.app = app; }

  async call(method, endpoint, body) {
    const S = this.app.S;
    const opts = {
      method,
      headers: { 'Authorization': `Bearer ${S.apiToken}`, 'Content-Type': 'application/json' }
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const r = await fetch(`${S.apiBase}${endpoint}`, opts);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || r.statusText);
    return data;
  }
}

// ── Navigation ─────────────────────────────────────────────────────────────────
class Navigation {
  constructor(app) { this.app = app; }

  pushHistory() {
    const S = this.app.S;
    S.history.push({ view: S.view, navPath: [...S.navPath], cat: S.cat, cur: S.cur });
    this._updateBackBtn();
  }

  _updateBackBtn() {
    const btn = document.getElementById('back-btn');
    if (btn) btn.style.display = this.app.S.history.length ? '' : 'none';
  }

  back() {
    const S = this.app.S;
    const prev = S.history.pop();
    if (!prev) return;
    S.view = prev.view; S.navPath = prev.navPath; S.cat = prev.cat; S.cur = prev.cur;
    this._updateBackBtn();
    this.app.sidebar.applySidebarActive();
    if (S.view !== 'guide') this.app.sidebar.buildTags();
    S.view === 'guide' ? this.app.viewer.render() : this.app.grid.render();
  }

  to(pathStr) {
    const S = this.app.S;
    this.pushHistory();
    S.navPath = typeof pathStr === 'string' ? pathStr.split('/').filter(Boolean) : pathStr;
    S.view = 'folder';
    S.cat = S.navPath[0] || null;
    this.app.sidebar.applySidebarActive();
    this.app.sidebar.buildTags();
    this.app.grid.render();
  }

  home() {
    const S = this.app.S;
    S.view = 'home'; S.navPath = []; S.cat = null; S.history = [];
    this._updateBackBtn();
    this.app.sidebar.applySidebarActive();
    this.app.sidebar.buildTags();
    this.app.grid.render();
  }

  recent() {
    const S = this.app.S;
    S.view = 'recent'; S.navPath = []; S.cat = null;
    this.app.sidebar.applySidebarActive();
    this.app.sidebar.buildTags();
    this.app.grid.render();
  }

  buildBreadcrumb() {
    const S = this.app.S;
    if (!S.navPath.length) return '';
    const parts = S.navPath.map((seg, i) => {
      const p = S.navPath.slice(0, i + 1).join('/');
      return `<a onclick="app.nav.to('${p}')">${esc(cap(seg))}</a>`;
    });
    return `<div class="gnav"><a onclick="app.nav.home()">עיון</a> › ${parts.join(' › ')}</div>`;
  }
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
class Sidebar {
  constructor(app) { this.app = app; }

  catIcon(cat) {
    const S = this.app.S;
    if (S.catIcons[cat]) return S.catIcons[cat];
    const icos = { 'ci-cd':'⚙️','runbooks':'📖','troubleshooting':'🔧','data':'📊','infrastructure':'🏗️','security':'🔐','general':'📄' };
    return icos[cat.toLowerCase()] || Object.entries(icos).find(([k]) => cat.toLowerCase().includes(k))?.[1] || '📄';
  }

  build() {
    const S = this.app.S;
    const root = {};
    S.guides.forEach(g => {
      const parts = (g.pathParts && g.pathParts.length) ? g.pathParts : [g.cat || 'general'];
      let node = root;
      for (const part of parts) {
        if (!node[part]) node[part] = { _count: 0, _children: {} };
        node[part]._count++;
        node = node[part]._children;
      }
    });
    document.getElementById('ball').textContent = S.guides.length;
    const el = document.getElementById('cats'); el.innerHTML = '';
    this._renderTreeLevel(el, root, 0, '');
  }

  _renderTreeLevel(el, node, depth, parentPath) {
    const S = this.app.S;
    for (const [name, data] of Object.entries(node)) {
      const fullPath = parentPath ? `${parentPath}/${name}` : name;
      const hasChildren = Object.entries(data._children).filter(([k]) => !k.startsWith('_')).length > 0;
      const collapsed = S.collapsedCats.has(fullPath);

      const d = document.createElement('div');
      d.className = 'sb-item';
      d.id = 'nb-' + fullPath.replace(/\//g, '::');
      if (depth > 0) d.style.paddingInlineStart = `${12 + depth * 14}px`;

      if (depth === 0) {
        const ico = document.createElement('span');
        ico.className = 'sb-cat-ico'; ico.textContent = this.catIcon(name);
        ico.title = 'שנה אייקון';
        ico.onclick = e => { e.stopPropagation(); this.pickCatIcon(name, ico); };
        d.appendChild(ico);
      } else {
        const icoSpan = document.createElement('span');
        icoSpan.textContent = hasChildren ? '📁 ' : '📄 ';
        d.appendChild(icoSpan);
      }

      const lbl = document.createElement('span');
      lbl.style.flex = '1'; lbl.textContent = cap(name);
      lbl.onclick = () => this.app.nav.to(fullPath);
      d.appendChild(lbl);

      const badge = document.createElement('span');
      badge.className = 'badge'; badge.textContent = data._count;
      d.appendChild(badge);

      if (hasChildren) {
        const chev = document.createElement('span');
        chev.className = 'sb-chev' + (collapsed ? '' : ' open');
        chev.id = 'chev-' + fullPath.replace(/\//g, '::');
        chev.textContent = '›';
        chev.onclick = e => { e.stopPropagation(); this.togCat(fullPath); };
        d.appendChild(chev);
      } else {
        d.onclick = () => this.app.nav.to(fullPath);
      }
      el.appendChild(d);

      if (hasChildren && !collapsed) {
        this._renderTreeLevel(el, data._children, depth + 1, fullPath);
      }
    }
  }

  togCat(cat) {
    const S = this.app.S;
    S.collapsedCats.has(cat) ? S.collapsedCats.delete(cat) : S.collapsedCats.add(cat);
    try { localStorage.setItem('pg:collapsedCats', JSON.stringify([...S.collapsedCats])); } catch {}
    this.build(); this.applySidebarActive();
  }

  applySidebarActive() {
    const S = this.app.S;
    document.querySelectorAll('.sb-item').forEach(e => e.classList.remove('on'));
    if (S.view === 'home')        document.getElementById('nall')?.classList.add('on');
    else if (S.view === 'recent') document.getElementById('nrec')?.classList.add('on');
    else if (S.navPath.length) {
      const key = S.navPath.join('/').replace(/\//g, '::');
      document.getElementById('nb-' + key)?.classList.add('on');
    }
  }

  pickCatIcon(cat, anchorEl) {
    const picker = document.getElementById('float-icon-picker');
    const grid   = document.getElementById('float-icon-grid');
    grid.innerHTML = GUIDE_ICONS.map(ico =>
      `<button style="font-size:17px;width:30px;height:30px;border:none;background:transparent;cursor:pointer;border-radius:4px"
        onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background='transparent'"
        onclick="app.sidebar.selectCatIcon('${cat}','${ico}')">${ico}</button>`
    ).join('');
    const r = anchorEl.getBoundingClientRect();
    picker.style.left = (r.right + 6) + 'px';
    picker.style.top  = r.top + 'px';
    picker.style.display = 'block';
    setTimeout(() => document.addEventListener('click', () => { picker.style.display = 'none'; }, { once: true }), 0);
  }

  selectCatIcon(cat, ico) {
    const S = this.app.S;
    S.catIcons[cat] = ico;
    try { localStorage.setItem('pg:catIcons', JSON.stringify(S.catIcons)); } catch {}
    document.getElementById('float-icon-picker').style.display = 'none';
    this.build(); this.applySidebarActive();
  }

  buildTags() {
    const S = this.app.S;
    const gs = (S.view === 'home' || S.view === 'recent' || S.view === 'guide') ? S.guides : this.app.grid.getContextGuides();
    const tags = new Set(); gs.forEach(g => g.tags.forEach(t => tags.add(t)));
    const list = document.getElementById('tag-dd-list'); list.innerHTML = '';
    [['', 'כל התגים'], ...[...tags].sort().map(t => [t, t])].forEach(([val, label]) => {
      const d = document.createElement('div');
      d.className = 'tag-dd-item' + (S.tag === val ? ' on' : '');
      d.textContent = label;
      d.onclick = () => this.selectTag(val, label);
      list.appendChild(d);
    });
  }

  togTagDd(e) {
    e.stopPropagation();
    const list = document.getElementById('tag-dd-list');
    if (list.style.display === 'block') { list.style.display = 'none'; return; }
    list.style.display = 'block';
    setTimeout(() => document.addEventListener('click', () => { list.style.display = 'none'; }, { once: true }), 0);
  }

  selectTag(val, label) {
    const S = this.app.S;
    S.tag = val;
    document.getElementById('tag-dd-btn').textContent = label + ' ▾';
    document.getElementById('tag-dd-list').style.display = 'none';
    document.querySelectorAll('.tag-dd-item').forEach(d => d.classList.toggle('on', d.textContent === label));
    if (S.view !== 'guide') this.app.grid.render();
  }
}

// ── GuideGrid ──────────────────────────────────────────────────────────────────
class GuideGrid {
  constructor(app) { this.app = app; }

  filtered() {
    const S = this.app.S;
    let gs = [...S.guides];
    if (S.view === 'recent') {
      gs = S.recent.map(p => gs.find(g => g.path === p)).filter(Boolean);
    } else if (S.view === 'folder' && S.navPath.length && !S.q) {
      gs = gs.filter(g => {
        const parts = (g.pathParts && g.pathParts.length) ? g.pathParts : [g.cat || 'general'];
        return S.navPath.every((seg, i) => parts[i] === seg);
      });
    }
    if (S.q) {
      const q = S.q.toLowerCase();
      gs = gs.filter(g =>
        g.title.toLowerCase().includes(q) ||
        g.desc.toLowerCase().includes(q) ||
        g.tags.some(t => t.includes(q)) ||
        (g.pathParts || [g.cat]).some(p => p && p.toLowerCase().includes(q))
      );
    }
    if (S.tag) gs = gs.filter(g => g.tags.includes(S.tag));
    return gs;
  }

  getContextGuides() {
    const S = this.app.S;
    if (S.view === 'folder' && S.navPath.length) {
      return S.guides.filter(g => {
        const parts = (g.pathParts && g.pathParts.length) ? g.pathParts : [g.cat || 'general'];
        return S.navPath.every((seg, i) => parts[i] === seg);
      });
    }
    return S.guides;
  }

  guideCard(g, subtitle) {
    const p = g.path.replace(/'/g, "\\'");
    const sub = subtitle || (g.pathParts || [g.cat]).map(s => cap(s)).join(' › ');
    return `<div class="gc" onclick="app.viewer.open('${p}')">
      <div class="gc-h"><div class="gc-ico">${g.icon || '📄'}</div><div><div class="gc-title">${esc(g.title)}</div><div class="gc-cat">${esc(sub)}</div></div></div>
      <div class="gc-desc">${esc(g.desc)}</div>
      <div class="gc-tags">${g.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
    </div>`;
  }

  renderHome() {
    const S = this.app.S;
    const topCats = {};
    S.guides.forEach(g => {
      const cat = (g.pathParts && g.pathParts.length) ? g.pathParts[0] : (g.cat || 'general');
      if (!topCats[cat]) topCats[cat] = { count: 0, guides: [] };
      topCats[cat].count++;
      topCats[cat].guides.push(g);
    });
    if (!Object.keys(topCats).length) {
      setC(`<div class="gv"><div class="es"><div class="es-i">📭</div><h3>לא נמצאו מדריכים</h3><p>רענן או הוסף מדריכים כדי להתחיל.</p></div></div>`);
      return;
    }
    const cards = Object.entries(topCats).map(([cat, { count, guides }]) => {
      const preview = guides.slice(0, 3).map(g => `<span class="tag">${esc(g.title)}</span>`).join('');
      return `<div class="gc" onclick="app.nav.to('${esc(cat)}')">
        <div class="gc-h"><div class="gc-ico">${this.app.sidebar.catIcon(cat)}</div><div>
          <div class="gc-title">${esc(cap(cat))}</div>
          <div class="gc-cat">${count} ${count !== 1 ? 'מדריכים' : 'מדריך'}</div>
        </div></div>
        <div class="gc-tags">${preview}</div>
      </div>`;
    }).join('');
    setC(`<div class="gv"><div class="gv-hd"><h2>עיון</h2><p>${Object.keys(topCats).length} קטגוריות · ${S.guides.length} מדריכים</p></div><div class="gg">${cards}</div></div>`);
  }

  render() {
    const S = this.app.S;
    if (S.q) {
      const gs = this.filtered();
      const cards = gs.map(g => this.guideCard(g)).join('');
      setC(`<div class="gv"><div class="gv-hd"><h2>תוצאות חיפוש</h2><p>${gs.length} תוצאות עבור "${esc(S.q)}"</p></div><div class="gg">${gs.length ? cards : '<div class="es"><div class="es-i">🔍</div><h3>אין תוצאות</h3></div>'}</div></div>`);
      return;
    }
    if (S.view === 'home') { this.renderHome(); return; }
    if (S.view === 'recent') {
      const gs = this.filtered();
      const cards = gs.map(g => this.guideCard(g)).join('');
      setC(`<div class="gv"><div class="gv-hd"><h2>נצפו לאחרונה</h2><p>${gs.length} ${gs.length !== 1 ? 'מדריכים' : 'מדריך'}</p></div><div class="gg">${gs.length ? cards : '<div class="es"><div class="es-i">🕐</div><h3>אין מדריכים אחרונים</h3><p>פתח מדריך כדי לראותו כאן.</p></div>'}</div></div>`);
      return;
    }
    if (S.view === 'folder' && S.navPath.length) {
      const depth = S.navPath.length;
      const subfolders = {};
      const directGuides = [];
      S.guides.forEach(g => {
        const parts = (g.pathParts && g.pathParts.length) ? g.pathParts : [g.cat || 'general'];
        if (!S.navPath.every((seg, i) => parts[i] === seg)) return;
        if (parts.length > depth) {
          const sub = parts[depth];
          if (!subfolders[sub]) subfolders[sub] = { count: 0, guides: [] };
          subfolders[sub].count++;
          subfolders[sub].guides.push(g);
        } else if (parts.length === depth) {
          directGuides.push(g);
        }
      });

      const title = S.navPath.map(p => cap(p)).join(' › ');
      const breadcrumb = this.app.nav.buildBreadcrumb();
      const tagFiltered = S.tag ? this.filtered() : null;

      if (!S.tag && Object.keys(subfolders).length > 0) {
        const numFolders = Object.keys(subfolders).length;
        const folderCards = Object.entries(subfolders).map(([sub, { count, guides: sgs }]) => {
          const subPath = [...S.navPath, sub].join('/');
          const preview = sgs.slice(0, 3).map(g => `<span class="tag">${esc(g.title)}</span>`).join('');
          return `<div class="gc" onclick="app.nav.to('${esc(subPath)}')">
            <div class="gc-h"><div class="gc-ico">📁</div><div>
              <div class="gc-title">${esc(cap(sub))}</div>
              <div class="gc-cat">${esc(title)}</div>
            </div></div>
            <div class="gc-desc">${count} ${count !== 1 ? 'מדריכים' : 'מדריך'}</div>
            <div class="gc-tags">${preview}</div>
          </div>`;
        }).join('');
        const dirCards = directGuides.map(g => this.guideCard(g, title)).join('');
        const total = Object.values(subfolders).reduce((a, b) => a + b.count, 0) + directGuides.length;
        setC(`<div class="gv">${breadcrumb}<div class="gv-hd"><h2>${esc(title)}</h2><p>${numFolders} ${numFolders !== 1 ? 'תיקיות' : 'תיקייה'} · ${total} ${total !== 1 ? 'מדריכים' : 'מדריך'}</p></div><div class="gg">${folderCards}${dirCards}</div></div>`);
        return;
      }

      const gs = tagFiltered || this.filtered();
      const cards = gs.map(g => this.guideCard(g, title)).join('');
      setC(`<div class="gv">${breadcrumb}<div class="gv-hd"><h2>${esc(title)}</h2><p>${gs.length} ${gs.length !== 1 ? 'מדריכים' : 'מדריך'}</p></div><div class="gg">${gs.length ? cards : '<div class="es"><div class="es-i">📭</div><h3>אין מדריכים כאן</h3></div>'}</div></div>`);
      return;
    }
    this.renderHome();
  }
}

// ── GuideViewer ────────────────────────────────────────────────────────────────
class GuideViewer {
  constructor(app) { this.app = app; }

  async open(path) {
    const S = this.app.S;
    this.app.nav.pushHistory();
    setC(ldg('טוען מדריך...'));
    try {
      const data = await this.app.apiClient.call('GET', `/api/guides/content?path=${encodeURIComponent(path)}`);
      setC(ldg('טוען תמונות...'));
      const content = await this._embedImages(data.content, data.path);
      S.cur = { path: data.path, title: data.title, rawContent: data.content, content, steps: this._parseSteps(content), meta: data };
      S.done = new Set();
      S.recent = [path, ...S.recent.filter(p => p !== path)].slice(0, 10);
      S.view = 'guide'; this.render();
      this.app.logger.add(`נפתח: ${data.title}`, 's');
    } catch (err) {
      setC(`<div class="gv"><div class="es"><div class="es-i">⚠️</div><h3>לא ניתן לטעון</h3><p>${esc(err.message)}</p></div></div>`);
    }
  }

  async _embedImages(src, guidePath) {
    const dir = guidePath.substring(0, guidePath.lastIndexOf('/'));
    const re = /!\[([^\]]*)\]\(([^)"'\s]+)\)/g;
    const local = [...src.matchAll(re)].filter(([,,s]) => !/^https?:\/\/|^data:|^#/.test(s));
    if (!local.length) return src;
    this.app.logger.add(`מטמין ${local.length} תמונות...`, 's');
    let out = src;
    for (const [full, alt, imgSrc] of local) {
      const imgPath = imgSrc.startsWith('/') ? imgSrc : `${dir}/${imgSrc.replace(/^\.\//, '')}`;
      try {
        const img = await this.app.apiClient.call('GET', `/api/images?path=${encodeURIComponent(imgPath)}`);
        out = out.replace(full, `![${alt}](data:${img.mime};base64,${img.data})`);
        this.app.logger.add(`  ✓ ${img.name}`, 's');
      } catch {
        out = out.replace(full, `<span class="img-warn">⚠ תמונה לא נמצאה: ${esc(imgSrc)}</span>`);
        this.app.logger.add(`  ✗ ${imgPath.split('/').pop()} — לא נמצא`, 'e');
      }
    }
    return out;
  }

  _parseSteps(src) {
    const lines = src.split('\n'); const steps = []; let cur = null, fm = false;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (i === 0 && l === '---') { fm = true; continue; }
      if (fm && l === '---') { fm = false; continue; }
      if (fm) continue;
      if (/^##\s/.test(l)) {
        if (cur) steps.push(cur);
        cur = { title: l.replace(/^##\s+(?:step\s+\d+[:.\s-]*)?/i, '').trim(), body: [] };
      } else if (cur) cur.body.push(l);
    }
    if (cur) steps.push(cur);
    if (!steps.length) lines.filter(l => /^\d+\.\s/.test(l)).forEach(l => steps.push({ title: l.replace(/^\d+\.\s/, ''), body: [] }));
    return steps;
  }

  render() {
    const S = this.app.S;
    const g = S.cur; if (!g) { this.app.nav.home(); return; }
    const done = S.done.size, total = g.steps.length, pct = total ? Math.round(done / total * 100) : 0;
    const tags = (g.meta.tags || []).map(t => `<span class="tag ac">${esc(t)}</span>`).join('');

    const actBar = S.userRole === 'admin' ? `
    <div class="act-bar">
      <button class="btn-s" onclick="app.editor.open('edit')">✏️ עריכה</button>
      <button class="btn-danger" onclick="app.editor.deleteGuide()">🗑 מחיקה</button>
    </div>` : '';

    let body = '';
    if (g.steps.length) {
      const cards = g.steps.map((s, i) => {
        const ok = S.done.has(i);
        return `<div class="step ${ok ? 'done' : ''}" id="s${i}">
        <div class="step-hd" onclick="app.viewer.togStep(${i})">
          <div class="chk" onclick="app.viewer.togDone(event,${i})">${ok ? '✓' : `<span class="snum">${i + 1}</span>`}</div>
          <div class="stitle">${esc(s.title)}</div><span class="sarr">▶</span>
        </div>
        <div class="sbody"><div class="md">${marked.parse(s.body.join('\n'))}</div></div>
      </div>`;
      }).join('');
      body = `${total ? `<div class="pbar-w"><div class="pbar-l"><span>${done}/${total} שלבים</span><span>${pct}%</span></div><div class="pbar"><div class="pfill" style="width:${pct}%"></div></div></div>` : ''}
    <div class="steps-lbl">שלבים</div>${cards}`;
    } else {
      body = `<div class="md">${marked.parse(g.content.replace(/^---[\s\S]*?---\n/, ''))}</div>`;
    }

    const pathParts = (g.meta.pathParts && g.meta.pathParts.length) ? g.meta.pathParts : (g.meta.cat ? [g.meta.cat] : ['general']);
    const breadLinks = pathParts.map((seg, i) => {
      const p = pathParts.slice(0, i + 1).join('/');
      return `<a onclick="app.nav.to('${p}')">${esc(cap(seg))}</a>`;
    }).join(' › ');
    setC(`<div class="gview">
    <div class="gnav"><a onclick="app.nav.home()">עיון</a> › ${breadLinks} › <span>${esc(g.title)}</span></div>
    <h1>${esc(g.title)}</h1>
    <div class="gmeta"><span>📁 ${esc(pathParts.map(p => cap(p)).join(' › '))}</span>${total ? `<span>📋 ${total} שלבים</span>` : ''} ${tags}</div>
    ${actBar}${body}
  </div>`);
  }

  togStep(i) {
    const el = document.getElementById('s' + i); if (!el) return;
    const was = el.classList.contains('open');
    document.querySelectorAll('.step.open').forEach(e => e.classList.remove('open'));
    if (!was) el.classList.add('open');
  }

  togDone(e, i) {
    e.stopPropagation();
    const S = this.app.S;
    const wasDone = S.done.has(i);
    wasDone ? S.done.delete(i) : S.done.add(i);
    this.render();
    if (wasDone) setTimeout(() => this.togStep(i), 0);
  }
}

// ── GuideEditor ────────────────────────────────────────────────────────────────
class GuideEditor {
  constructor(app) { this.app = app; this._mode = 'create'; }

  open(mode) {
    const S = this.app.S;
    this._mode = mode;
    document.getElementById('em-title').textContent = mode === 'create' ? 'מדריך חדש' : 'עריכת מדריך';
    const pathInput = document.getElementById('em-path');
    pathInput.readOnly = mode === 'edit';
    if (mode === 'edit' && S.cur) {
      pathInput.value = S.cur.path;
      document.getElementById('em-content').value = S.cur.rawContent || S.cur.content;
    } else {
      pathInput.value = S.cat ? `${S.cat}/new-guide/guide.md` : 'general/new-guide/guide.md';
      document.getElementById('em-content').value =
        '---\ntitle: \ntags: \ndescription: \n---\n\n# Guide Title\n\n## Step 1: \n\nDescription here.\n';
    }
    document.getElementById('em-icon-btn').textContent = this.getCurrentIcon(document.getElementById('em-content').value);
    document.getElementById('ed-overlay').style.display = 'flex';
    setTimeout(() => (mode === 'create' ? pathInput : document.getElementById('em-content')).focus(), 50);
  }

  close() { document.getElementById('ed-overlay').style.display = 'none'; }

  overlayClick(e) { if (e.target === document.getElementById('ed-overlay')) this.close(); }

  togIcons(e) {
    e.stopPropagation();
    const p = document.getElementById('em-icon-picker');
    if (p.style.display === 'block') { p.style.display = 'none'; return; }
    document.getElementById('em-icon-grid').innerHTML = GUIDE_ICONS
      .map(ico => `<button onclick="app.editor.selectIcon('${ico}')">${ico}</button>`).join('');
    p.style.display = 'block';
    setTimeout(() => document.addEventListener('click', () => { p.style.display = 'none'; }, { once: true }), 0);
  }

  selectIcon(ico) {
    document.getElementById('em-icon-btn').textContent = ico;
    document.getElementById('em-icon-picker').style.display = 'none';
    const ta = document.getElementById('em-content');
    ta.value = this.setFrontmatterField(ta.value, 'icon', ico);
  }

  getCurrentIcon(content) {
    if (!content.startsWith('---')) return '📄';
    const end = content.indexOf('\n---', 3);
    if (end === -1) return '📄';
    const m = content.slice(4, end).match(/^icon:\s*(.+)$/m);
    return m ? m[1].trim() : '📄';
  }

  setFrontmatterField(content, key, value) {
    if (content.startsWith('---')) {
      const end = content.indexOf('\n---', 3);
      if (end !== -1) {
        const body = content.slice(4, end);
        const keyRe = new RegExp(`^${key}:.*$`, 'm');
        const newBody = keyRe.test(body) ? body.replace(keyRe, `${key}: ${value}`) : body + `\n${key}: ${value}`;
        return '---\n' + newBody + '\n---' + content.slice(end + 4);
      }
    }
    return `---\nicon: ${value}\n---\n\n` + content;
  }

  async insertImage() {
    const guidePath = document.getElementById('em-path').value.trim();
    if (!guidePath) return this.app.logger.add('הגדר את נתיב המדריך לפני הוספת תמונה.', 'e');
    const btn = document.getElementById('em-img');
    btn.disabled = true;
    try {
      const file = await window.api.readImage();
      if (!file) return;
      const dir = guidePath.includes('/') ? guidePath.substring(0, guidePath.lastIndexOf('/')) : '';
      const serverPath = dir ? `${dir}/${file.name}` : file.name;
      await this.app.apiClient.call('POST', '/api/images', { path: serverPath, data: file.data, mime: file.mime });
      const md = `![${file.name}](${file.name})`;
      const ta = document.getElementById('em-content');
      const pos = ta.selectionStart;
      ta.value = ta.value.slice(0, pos) + md + ta.value.slice(pos);
      ta.selectionStart = ta.selectionEnd = pos + md.length;
      ta.focus();
      this.app.logger.add(`הועלה: ${file.name}`, 's');
    } catch (err) {
      this.app.logger.add(`העלאת תמונה נכשלה: ${err.message}`, 'e');
    } finally {
      btn.disabled = false;
    }
  }

  async save() {
    const gpath = document.getElementById('em-path').value.trim();
    const content = document.getElementById('em-content').value;
    if (!gpath)             return this.app.logger.add('נתיב הוא שדה חובה', 'e');
    if (!gpath.endsWith('.md')) return this.app.logger.add('הנתיב חייב להסתיים ב-.md', 'e');
    if (!content)           return this.app.logger.add('תוכן הוא שדה חובה', 'e');
    const btn = document.getElementById('em-save');
    btn.disabled = true; btn.textContent = 'שומר...';
    try {
      if (this._mode === 'create') await this.app.apiClient.call('POST', '/api/guides', { path: gpath, content });
      else                         await this.app.apiClient.call('PUT',  '/api/guides', { path: gpath, content });
      this.app.logger.add(`${this._mode === 'create' ? 'נוצר' : 'עודכן'}: ${gpath}`, 's');
      this.close();
      await this.app.loadGuides();
      if (this._mode === 'edit') this.app.viewer.open(gpath);
    } catch (err) {
      this.app.logger.add(`שמירה נכשלה: ${err.message}`, 'e');
    } finally {
      btn.disabled = false; btn.textContent = 'שמור';
    }
  }

  async deleteGuide() {
    const S = this.app.S;
    if (!S.cur) return;
    if (!confirm(`מחק "${S.cur.title}"?\nלא ניתן לבטל פעולה זו.`)) return;
    try {
      await this.app.apiClient.call('DELETE', '/api/guides', { path: S.cur.path });
      this.app.logger.add(`נמחק: ${S.cur.title}`, 's');
      S.cur = null; await this.app.loadGuides();
    } catch (err) {
      this.app.logger.add(`מחיקה נכשלה: ${err.message}`, 'e');
    }
  }
}

// ── AdminPanel ─────────────────────────────────────────────────────────────────
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
    const YEAR = 365 * 24 * 3600 * 1000;
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

// ── GuideApp ───────────────────────────────────────────────────────────────────
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
