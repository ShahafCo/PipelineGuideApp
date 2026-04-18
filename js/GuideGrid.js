"use strict";

class GuideGrid {
	constructor(app) {
		this.app = app;
	}

	filtered() {
		const S = this.app.S;
		let gs = [...S.guides];
		if (S.view === "recent") {
			gs = S.recent.map((p) => gs.find((g) => g.path === p)).filter(Boolean);
		} else if (S.view === "folder" && S.navPath.length && !S.q) {
			gs = gs.filter((g) => {
				const parts = g.pathParts && g.pathParts.length ? g.pathParts : [g.cat || "general"];
				return S.navPath.every((seg, i) => parts[i] === seg);
			});
		}
		if (S.q) {
			const q = S.q.toLowerCase();
			gs = gs.filter(
				(g) =>
					g.title.toLowerCase().includes(q) ||
					g.desc.toLowerCase().includes(q) ||
					g.tags.some((t) => t.includes(q)) ||
					(g.pathParts || [g.cat]).some((p) => p && p.toLowerCase().includes(q)),
			);
		}
		if (S.tag) gs = gs.filter((g) => g.tags.includes(S.tag));
		return gs;
	}

	getContextGuides() {
		const S = this.app.S;
		if (S.view === "folder" && S.navPath.length) {
			return S.guides.filter((g) => {
				const parts = g.pathParts && g.pathParts.length ? g.pathParts : [g.cat || "general"];
				return S.navPath.every((seg, i) => parts[i] === seg);
			});
		}
		return S.guides;
	}

	guideCard(g, subtitle) {
		const p = g.path.replace(/'/g, "\\'");
		const sub = subtitle || (g.pathParts || [g.cat]).map((s) => cap(s)).join(" › ");
		return `<div class="gc" onclick="app.viewer.open('${p}')">
      <div class="gc-h"><div class="gc-ico">${g.icon || "📄"}</div><div>
        <div class="gc-title">${esc(g.title)}</div>
        <div class="gc-cat">${esc(sub)}</div>
      </div></div>
      <div class="gc-desc">${esc(g.desc)}</div>
      <div class="gc-tags">${g.tags.map((t) => `<span class="tag" onclick="app.sidebar.selectTag('${t.replace(/'/g, "\\'")}','${t.replace(/'/g, "\\'")}');event.stopPropagation()">${esc(t)}</span>`).join("")}</div>
    </div>`;
	}

	renderHome() {
		const S = this.app.S;
		const topCats = {};
		S.guides.forEach((g) => {
			const cat = g.pathParts && g.pathParts.length ? g.pathParts[0] : g.cat || "general";
			if (!topCats[cat]) topCats[cat] = { count: 0, guides: [] };
			topCats[cat].count++;
			topCats[cat].guides.push(g);
		});
		if (!Object.keys(topCats).length) {
			setC(`<div class="gv"><div class="es"><div class="es-i">📭</div><h3>לא נמצאו מדריכים</h3><p>רענן או הוסף מדריכים כדי להתחיל.</p></div></div>`);
			return;
		}
		const cards = Object.entries(topCats)
			.map(([cat, { count, guides }]) => {
				const preview = guides
					.slice(0, 3)
					.map((g) => `<span class="tag">${esc(g.title)}</span>`)
					.join("");
				return `<div class="gc" onclick="app.nav.to('${esc(cat)}')">
        <div class="gc-h"><div class="gc-ico">${this.app.sidebar.catIcon(cat)}</div><div>
          <div class="gc-title">${esc(cap(cat))}</div>
          <div class="gc-cat">${count} ${count !== 1 ? "מדריכים" : "מדריך"}</div>
        </div></div>
        <div class="gc-tags">${preview}</div>
      </div>`;
			})
			.join("");
		setC(
			`<div class="gv"><div class="gv-hd"><h2>דף הבית</h2><p>${Object.keys(topCats).length} קטגוריות · ${S.guides.length} מדריכים</p></div><div class="gg">${cards}</div></div>`,
		);
	}

	render() {
		const S = this.app.S;
		if (S.q) {
			const gs = this.filtered();
			const cards = gs.map((g) => this.guideCard(g)).join("");
			setC(
				`<div class="gv"><div class="gv-hd"><h2>תוצאות חיפוש</h2><p>${gs.length} תוצאות עבור "${esc(S.q)}"</p></div><div class="gg">${gs.length ? cards : '<div class="es"><div class="es-i">🔍</div><h3>אין תוצאות</h3></div>'}</div></div>`,
			);
			return;
		}
		if (S.view === "home") {
			this.renderHome();
			return;
		}
		if (S.view === "recent") {
			const gs = this.filtered();
			const cards = gs.map((g) => this.guideCard(g)).join("");
			setC(
				`<div class="gv"><div class="gv-hd"><h2>נצפו לאחרונה</h2><p>${gs.length} ${gs.length !== 1 ? "מדריכים" : "מדריך"}</p></div><div class="gg">${gs.length ? cards : '<div class="es"><div class="es-i">🕐</div><h3>אין מדריכים אחרונים</h3><p>פתח מדריך כדי לראותו כאן.</p></div>'}</div></div>`,
			);
			return;
		}
		if (S.view === "folder" && S.navPath.length) {
			const depth = S.navPath.length;
			const subfolders = {};
			const directGuides = [];
			S.guides.forEach((g) => {
				const parts = g.pathParts && g.pathParts.length ? g.pathParts : [g.cat || "general"];
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

			const title = S.navPath.map((p) => cap(p)).join(" › ");
			const breadcrumb = this.app.nav.buildBreadcrumb();
			const tagFiltered = S.tag ? this.filtered() : null;

			if (!S.tag && Object.keys(subfolders).length > 0) {
				const numFolders = Object.keys(subfolders).length;
				const folderCards = Object.entries(subfolders)
					.map(([sub, { count, guides: sgs }]) => {
						const subPath = [...S.navPath, sub].join("/");
						const preview = sgs
							.slice(0, 3)
							.map((g) => `<span class="tag">${esc(g.title)}</span>`)
							.join("");
						return `<div class="gc" onclick="app.nav.to('${esc(subPath)}')">
            <div class="gc-h"><div class="gc-ico">📁</div><div>
              <div class="gc-title">${esc(cap(sub))}</div>
              <div class="gc-cat">${esc(title)}</div>
            </div></div>
            <div class="gc-desc">${count} ${count !== 1 ? "מדריכים" : "מדריך"}</div>
            <div class="gc-tags">${preview}</div>
          </div>`;
					})
					.join("");
				const dirCards = directGuides.map((g) => this.guideCard(g, title)).join("");
				const total = Object.values(subfolders).reduce((a, b) => a + b.count, 0) + directGuides.length;
				setC(
					`<div class="gv">${breadcrumb}<div class="gv-hd"><h2>${esc(title)}</h2><p>${numFolders} ${numFolders !== 1 ? "תיקיות" : "תיקייה"} · ${total} ${total !== 1 ? "מדריכים" : "מדריך"}</p></div><div class="gg">${folderCards}${dirCards}</div></div>`,
				);
				return;
			}

			const gs = tagFiltered || this.filtered();
			const cards = gs.map((g) => this.guideCard(g, title)).join("");
			setC(
				`<div class="gv">${breadcrumb}<div class="gv-hd"><h2>${esc(title)}</h2><p>${gs.length} ${gs.length !== 1 ? "מדריכים" : "מדריך"}</p></div><div class="gg">${gs.length ? cards : '<div class="es"><div class="es-i">📭</div><h3>אין מדריכים כאן</h3></div>'}</div></div>`,
			);
			return;
		}
		this.renderHome();
	}
}
