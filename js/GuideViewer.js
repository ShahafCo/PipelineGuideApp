'use strict';

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
      this.app.logger.add(`Opened: ${data.title}`, 's');
    } catch (err) {
      setC(`<div class="gv"><div class="es"><div class="es-i">⚠️</div><h3>לא ניתן לטעון</h3><p>${esc(err.message)}</p></div></div>`);
    }
  }

  async _embedImages(src, guidePath) {
    const dir = guidePath.substring(0, guidePath.lastIndexOf('/'));
    const re = /!\[([^\]]*)\]\(([^)"'\s]+)\)/g;
    const local = [...src.matchAll(re)].filter(([,,s]) => !/^https?:\/\/|^data:|^#/.test(s));
    if (!local.length) return src;
    this.app.logger.add(`Embedding ${local.length} image(s)...`, 's');
    let out = src;
    for (const [full, alt, imgSrc] of local) {
      const imgPath = imgSrc.startsWith('/') ? imgSrc : `${dir}/${imgSrc.replace(/^\.\//, '')}`;
      try {
        const img = await this.app.apiClient.call('GET', `/api/images?path=${encodeURIComponent(imgPath)}`);
        out = out.replace(full, `![${alt}](data:${img.mime};base64,${img.data})`);
        this.app.logger.add(`  ✓ ${img.name}`, 's');
      } catch {
        out = out.replace(full, `<span class="img-warn">⚠ תמונה לא נמצאה: ${esc(imgSrc)}</span>`);
        this.app.logger.add(`  ✗ ${imgPath.split('/').pop()} — not found`, 'e');
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
