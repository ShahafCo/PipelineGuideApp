"use strict";

class Navigation {
	constructor(app) {
		this.app = app;
	}

	pushHistory() {
		const S = this.app.S;
		S.history.push({ view: S.view, navPath: [...S.navPath], cat: S.cat, cur: S.cur });
		this._updateBackBtn();
	}

	_updateBackBtn() {
		const btn = document.getElementById("back-btn");
		if (btn) btn.hidden = !this.app.S.history.length;
	}

	back() {
		const S = this.app.S;
		const prev = S.history.pop();
		if (!prev) return;
		S.view = prev.view;
		S.navPath = prev.navPath;
		S.cat = prev.cat;
		S.cur = prev.cur;
		this._updateBackBtn();
		this.app.sidebar.applySidebarActive();
		if (S.view !== "guide") this.app.sidebar.buildTags();
		S.view === "guide" ? this.app.viewer.render() : this.app.grid.render();
	}

	to(pathStr) {
		const S = this.app.S;
		this.pushHistory();
		S.navPath = typeof pathStr === "string" ? pathStr.split("/").filter(Boolean) : pathStr;
		S.view = "folder";
		S.cat = S.navPath[0] || null;
		this.app.sidebar.applySidebarActive();
		this.app.sidebar.buildTags();
		this.app.grid.render();
	}

	home() {
		const S = this.app.S;
		S.view = "home";
		S.navPath = [];
		S.cat = null;
		S.history = [];
		this._updateBackBtn();
		this.app.sidebar.applySidebarActive();
		this.app.sidebar.buildTags();
		this.app.grid.render();
	}

	recent() {
		const S = this.app.S;
		S.view = "recent";
		S.navPath = [];
		S.cat = null;
		this.app.sidebar.applySidebarActive();
		this.app.sidebar.buildTags();
		this.app.grid.render();
	}

	/* breadcrumb: semantic nav; '›' (U+203A) is Bidi_Mirrored so it flips in RTL */
	buildBreadcrumb(currentLabel) {
		const S = this.app.S;
		if (!S.navPath.length && !currentLabel) return "";
		const parts = S.navPath.map((seg, i) => {
			const p = S.navPath.slice(0, i + 1).join("/");
			const isLast = !currentLabel && i === S.navPath.length - 1;
			return isLast
				? `<span aria-current="page">${esc(cap(seg))}</span>`
				: `<button onclick="app.nav.to('${esc(p)}')">${esc(cap(seg))}</button>`;
		});
		const tail = currentLabel ? ` › <span aria-current="page">${esc(currentLabel)}</span>` : "";
		return `<nav class="crumbs" aria-label="מיקום"><button onclick="app.nav.home()">דף הבית</button> › ${parts.join(" › ")}${tail}</nav>`;
	}
}
