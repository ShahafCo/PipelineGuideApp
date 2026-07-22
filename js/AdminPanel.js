"use strict";

class AdminPanel {
	constructor(app) {
		this.app = app;
		this._sortKey = "updatedAt";
		this._sortAsc = true;
		this._filter = "all"; // all | fresh | aging | stale
	}

	open() {
		this._filter = "all";
		document.getElementById("ap-dialog").showModal();
		this.render();
	}

	close() {
		document.getElementById("ap-dialog").close();
	}

	sort(key) {
		if (this._sortKey === key) this._sortAsc = !this._sortAsc;
		else {
			this._sortKey = key;
			this._sortAsc = key === "updatedAt";
		}
		this.render();
	}

	setFilter(f) {
		this._filter = this._filter === f ? "all" : f;
		this.render();
	}

	render() {
		const S = this.app.S;
		const now = Date.now();
		const YEAR = 365 * 24 * 3600 * 1000;
		const SIX_MO = 183 * 24 * 3600 * 1000;

		const rows = S.guides.map((g) => {
			const ms = g.updatedAt ? new Date(g.updatedAt).getTime() : 0;
			const age = now - ms;
			const cls = !ms ? "" : age > YEAR ? "stale" : age > SIX_MO ? "aging" : "fresh";
			return { ...g, _ms: ms, _age: age, _cls: cls };
		});

		// summary chips double as filters (aria-pressed)
		const counts = { fresh: 0, aging: 0, stale: 0 };
		rows.forEach((r) => {
			if (counts[r._cls] !== undefined) counts[r._cls]++;
		});
		document.getElementById("ap-chips").innerHTML = [
			["fresh", "ok", `● ${counts.fresh} עדכניים`],
			["aging", "warn", `▲ ${counts.aging} מתיישנים`],
			["stale", "bad", `■ ${counts.stale} לא עודכנו`],
		]
			.map(
				([key, tone, label]) =>
					`<button class="chip ${tone} ap-filter" aria-pressed="${this._filter === key}" onclick="app.admin.setFilter('${key}')">${label}</button>`,
			)
			.join("");

		const key = this._sortKey,
			asc = this._sortAsc;
		rows.sort((a, b) => {
			let va, vb;
			if (key === "title") {
				va = a.title.toLowerCase();
				vb = b.title.toLowerCase();
			} else if (key === "path") {
				va = a.path;
				vb = b.path;
			} else {
				va = a._ms;
				vb = b._ms;
			}
			return asc ? (va < vb ? -1 : va > vb ? 1 : 0) : va > vb ? -1 : va < vb ? 1 : 0;
		});

		// aria-sort on the active column header
		["title", "path", "updatedAt", "age"].forEach((k) => {
			const th = document.getElementById("apth-" + k);
			const ico = document.getElementById("aps-" + k);
			if (th) {
				if (key === k) th.setAttribute("aria-sort", asc ? "ascending" : "descending");
				else th.removeAttribute("aria-sort");
			}
			if (ico) ico.textContent = key === k ? (asc ? "▲" : "▼") : "";
		});

		const visible = this._filter === "all" ? rows : rows.filter((r) => r._cls === this._filter);

		document.getElementById("ap-tbody").innerHTML = visible.length
			? visible
					.map((r) => {
						const stamp = freshStamp(r.updatedAt);
						const pathDisp = r.path.replace(/\/[^/]+\.md$/, "") || "root";
						const p = r.path.replace(/'/g, "\\'");
						return `<tr class="${r._cls}">
              <td><button class="ap-title-btn" onclick="app.admin.close();app.viewer.open('${p}')">${esc(r.title)}</button></td>
              <td class="ap-path">${esc(pathDisp)}</td>
              <td class="num">${fmtDateHe(r.updatedAt)}</td>
              <td>${stamp.chip}</td>
            </tr>`;
					})
					.join("")
			: `<tr><td colspan="4"><div class="es" style="padding:32px"><h3>אין מדריכים בסינון זה</h3></div></td></tr>`;
	}
}
