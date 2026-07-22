"use strict";

class GuideEditor {
	constructor(app) {
		this.app = app;
		this._mode = "create";
		this._dirty = false;
		const dlg = document.getElementById("ed-dialog");
		// Esc → unified close path with dirty guard
		dlg.addEventListener("cancel", (e) => {
			e.preventDefault();
			this.requestClose();
		});
		// backdrop click
		dlg.addEventListener("click", (e) => {
			if (e.target === dlg) this.requestClose();
		});
		// Ctrl+S saves while the editor is open
		dlg.addEventListener("keydown", (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
				e.preventDefault();
				this.save();
			}
		});
	}

	open(mode) {
		const S = this.app.S;
		this._mode = mode;
		document.getElementById("em-title").textContent = mode === "create" ? "מדריך חדש" : "עריכת מדריך";
		const pathInput = document.getElementById("em-path");
		pathInput.readOnly = mode === "edit";
		if (mode === "edit" && S.cur) {
			pathInput.value = S.cur.path;
			document.getElementById("em-content").value = S.cur.rawContent || S.cur.content;
		} else {
			pathInput.value = S.cat ? `${S.cat}/new-guide/guide.md` : "general/new-guide/guide.md";
			document.getElementById("em-content").value = "---\ntitle: \ntags: \ndescription: \n---\n\n# Guide Title\n\n## Step 1: \n\nDescription here.\n";
		}
		document.getElementById("em-icon-btn").textContent = this.getCurrentIcon(document.getElementById("em-content").value);
		this._setDirty(false);
		this._showErr("");
		this.validatePath();
		document.getElementById("ed-dialog").showModal();
		setTimeout(() => (mode === "create" ? pathInput : document.getElementById("em-content")).focus(), 50);
	}

	markDirty() {
		this._setDirty(true);
	}

	_setDirty(d) {
		this._dirty = d;
		document.getElementById("em-dirty").classList.toggle("on", d);
	}

	/* preserve user work: never discard silently */
	async requestClose() {
		if (this._dirty) {
			const ok = await this.app.confirm({
				title: "לצאת בלי לשמור?",
				body: "השינויים שלא נשמרו יאבדו.",
				confirmLabel: "צא בלי לשמור",
				cancelLabel: "המשך עריכה",
			});
			if (!ok) return;
		}
		this._close();
	}

	_close() {
		this._setDirty(false);
		document.getElementById("ed-dialog").close();
	}

	validatePath() {
		const input = document.getElementById("em-path");
		const msg = document.getElementById("em-path-msg");
		const p = input.value.trim();
		let err = "";
		if (!p) err = "נדרש נתיב.";
		else if (!p.endsWith(".md")) err = "הנתיב חייב להסתיים ב-md.";
		else if (p.startsWith("/") || p.startsWith("\\")) err = "הנתיב הוא יחסי — ללא / בהתחלה.";
		else if (p.includes("..")) err = "הנתיב לא יכול לכלול «..».";
		else if (p.includes("\\")) err = "השתמש ב-/ כמפריד תיקיות.";
		input.setAttribute("aria-invalid", err ? "true" : "false");
		msg.textContent = err;
		return !err;
	}

	togIcons(e) {
		e.stopPropagation();
		const p = document.getElementById("em-icon-picker");
		const btn = document.getElementById("em-icon-btn");
		if (p.classList.contains("on")) return this._closeIcons();
		document.getElementById("em-icon-grid").innerHTML = GUIDE_ICONS.map(
			(ico) => `<button type="button" onclick="app.editor.selectIcon('${ico}')">${ico}</button>`,
		).join("");
		p.classList.add("on");
		btn.setAttribute("aria-expanded", "true");
		p.querySelector("button")?.focus();
		this._iconDismiss = (ev) => {
			if (ev.type === "keydown") {
				if (ev.key !== "Escape") return;
				ev.stopPropagation();
				this._closeIcons(true);
				return;
			}
			if (!p.contains(ev.target) && ev.target !== btn) this._closeIcons();
		};
		setTimeout(() => {
			document.addEventListener("click", this._iconDismiss);
			document.addEventListener("keydown", this._iconDismiss, true);
		}, 0);
	}

	_closeIcons(returnFocus) {
		const p = document.getElementById("em-icon-picker");
		p.classList.remove("on");
		document.getElementById("em-icon-btn").setAttribute("aria-expanded", "false");
		document.removeEventListener("click", this._iconDismiss || (() => {}));
		document.removeEventListener("keydown", this._iconDismiss || (() => {}), true);
		if (returnFocus) document.getElementById("em-icon-btn").focus();
	}

	selectIcon(ico) {
		document.getElementById("em-icon-btn").textContent = ico;
		this._closeIcons(true);
		const ta = document.getElementById("em-content");
		ta.value = this.setFrontmatterField(ta.value, "icon", ico);
		this._setDirty(true);
	}

	getCurrentIcon(content) {
		if (!content.startsWith("---")) return "📄";
		const end = content.indexOf("\n---", 3);
		if (end === -1) return "📄";
		const m = content.slice(4, end).match(/^icon:\s*(.+)$/m);
		return m ? m[1].trim() : "📄";
	}

	setFrontmatterField(content, key, value) {
		if (content.startsWith("---")) {
			const end = content.indexOf("\n---", 3);
			if (end !== -1) {
				const body = content.slice(4, end);
				const keyRe = new RegExp(`^${key}:.*$`, "m");
				const newBody = keyRe.test(body) ? body.replace(keyRe, `${key}: ${value}`) : body + `\n${key}: ${value}`;
				return "---\n" + newBody + "\n---" + content.slice(end + 4);
			}
		}
		return `---\nicon: ${value}\n---\n\n` + content;
	}

	_pending(btn, label) {
		btn.dataset.idle = btn.textContent;
		btn.setAttribute("aria-disabled", "true");
		btn.setAttribute("aria-busy", "true");
		btn.innerHTML = `<span class="spinner" aria-hidden="true"></span>${label}`;
	}

	_idle(btn) {
		btn.removeAttribute("aria-disabled");
		btn.removeAttribute("aria-busy");
		btn.textContent = btn.dataset.idle || btn.textContent;
	}

	_showErr(m) {
		const el = document.getElementById("em-err");
		el.textContent = m;
		el.classList.toggle("on", !!m);
	}

	async insertImage() {
		const guidePath = document.getElementById("em-path").value.trim();
		if (!guidePath) return this._showErr("קבע נתיב לפני הוספת תמונה.");
		const btn = document.getElementById("em-img");
		if (btn.getAttribute("aria-disabled") === "true") return;
		this._pending(btn, "מעלה…");
		this._showErr("");
		try {
			const file = await window.api.readImage();
			if (!file) return;
			const dir = guidePath.includes("/") ? guidePath.substring(0, guidePath.lastIndexOf("/")) : "";
			const serverPath = dir ? `${dir}/${file.name}` : file.name;
			await this.app.apiClient.call("POST", "/api/images", { path: serverPath, data: file.data, mime: file.mime });
			const md = `![${file.name}](${file.name})`;
			const ta = document.getElementById("em-content");
			const pos = ta.selectionStart;
			ta.value = ta.value.slice(0, pos) + md + ta.value.slice(pos);
			ta.selectionStart = ta.selectionEnd = pos + md.length;
			ta.focus();
			this._setDirty(true);
			this.app.logger.add(`Uploaded: ${file.name}`, "s");
		} catch (err) {
			this._showErr(`העלאת התמונה נכשלה: ${err.message}`);
			this.app.logger.add(`Image upload failed: ${err.message}`, "e");
		} finally {
			this._idle(btn);
		}
	}

	async save() {
		const gpath = document.getElementById("em-path").value.trim();
		const content = document.getElementById("em-content").value;
		if (!this.validatePath()) {
			document.getElementById("em-path").focus();
			return;
		}
		if (!content) return this._showErr("נדרש תוכן.");
		const btn = document.getElementById("em-save");
		if (btn.getAttribute("aria-disabled") === "true") return;
		this._pending(btn, "שומר…");
		this._showErr("");
		try {
			if (this._mode === "create") await this.app.apiClient.call("POST", "/api/guides", { path: gpath, content });
			else await this.app.apiClient.call("PUT", "/api/guides", { path: gpath, content });
			this.app.logger.add(`${this._mode === "create" ? "Created" : "Updated"}: ${gpath}`, "s");
			this._close();
			this.app.toast.success(this._mode === "create" ? "המדריך נוצר" : "המדריך נשמר");
			await this.app.loadGuides();
			this.app.viewer.open(gpath);
		} catch (err) {
			// keep the dialog open — the draft is the user's work
			this._showErr(`השמירה נכשלה: ${err.message}`);
			this.app.logger.add(`Save failed: ${err.message}`, "e");
		} finally {
			this._idle(btn);
		}
	}

	async deleteGuide() {
		const S = this.app.S;
		if (!S.cur) return;
		const title = S.cur.title;
		const path = S.cur.path;
		const ok = await this.app.confirm({
			title: "מחיקת מדריך",
			body: `למחוק את <strong>"${esc(title)}"</strong>?<br>פעולה זו אינה הפיכה.`,
			confirmLabel: "מחק לצמיתות",
			cancelLabel: "ביטול",
		});
		if (!ok) return;
		try {
			await this.app.apiClient.call("DELETE", "/api/guides", { path });
			this.app.progress.clear(path);
			this.app.logger.add(`Deleted: ${title}`, "s");
			this.app.toast.success(`המדריך "${esc(title)}" נמחק`);
			S.cur = null;
			await this.app.loadGuides();
		} catch (err) {
			this.app.toast.error(`המחיקה נכשלה: ${esc(err.message)}`);
			this.app.logger.add(`Delete failed: ${err.message}`, "e");
		}
	}
}
