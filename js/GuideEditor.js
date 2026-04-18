'use strict';

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
    if (!gpath)                 return this.app.logger.add('נתיב הוא שדה חובה', 'e');
    if (!gpath.endsWith('.md')) return this.app.logger.add('הנתיב חייב להסתיים ב-.md', 'e');
    if (!content)               return this.app.logger.add('תוכן הוא שדה חובה', 'e');
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
