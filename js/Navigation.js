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
		if (btn) btn.style.display = this.app.S.history.length ? "" : "none";
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

	buildBreadcrumb() {
		const S = this.app.S;
		if (!S.navPath.length) return "";
		const parts = S.navPath.map((seg, i) => {
			const p = S.navPath.slice(0, i + 1).join("/");
			return `<a onclick="app.nav.to('${p}')">${esc(cap(seg))}</a>`;
		});
		return `<div class="gnav"><a onclick="app.nav.home()">דף הבית</a> › ${parts.join(" › ")}</div>`;
	}
}
