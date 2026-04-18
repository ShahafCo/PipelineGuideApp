'use strict';

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
    if (S.view === 'guide') {
      S.history.length ? this.app.nav.back() : this.app.nav.home();
    } else {
      this.app.grid.render();
    }
  }
}
