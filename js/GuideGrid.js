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

	_tagBtns(g) {
		return g.tags
			.map(
				(t) =>
					`<button class="tagbtn${this.app.S.tag === t ? " ac" : ""}" onclick="event.stopPropagation();app.sidebar.selectTag('${t.replace(/'/g, "\\'")}','${t.replace(/'/g, "\\'")}')">${esc(t)}</button>`,
			)
			.join("");
	}

	/* card = article + stretched open-button; tags/progress live above the stretch layer */
	guideCard(g, subtitle, opts = {}) {
		const S = this.app.S;
		const p = g.path.replace(/'/g, "\\'");
		const sub = subtitle || (g.pathParts || [g.cat]).map((s) => cap(s)).join(" › ");
		const prog = opts.prog !== undefined ? opts.prog : this.app.progress.summary(g.path);
		let progHtml = "";
		if (prog && prog.total > 0 && prog.done > 0) {
			const pct = Math.round((prog.done / prog.total) * 100);
			progHtml =
				prog.done >= prog.total
					? `<div class="gc-prog"><span class="chip ok">✓ הושלם</span></div>`
					: `<div class="gc-prog"><div class="pbar" role="progressbar" aria-valuemin="0" aria-valuemax="${prog.total}" aria-valuenow="${prog.done}" aria-valuetext="${prog.done} מתוך ${prog.total} שלבים"><div class="pfill" style="width:${pct}%"></div></div><span class="chip num">${prog.done}/${prog.total}</span></div>`;
		}
		return `<article class="gc${opts.resume ? " resume" : ""}">
      <button class="gc-open" onclick="app.viewer.open('${p}')">
        <span class="gc-h"><span class="gc-ico" aria-hidden="true">${g.icon || "📄"}</span><span>
          <span class="gc-title" style="display:block">${hl(g.title, S.q)}</span>
          <span class="gc-cat" style="display:block">${esc(sub)}</span>
        </span></span>
        ${g.desc ? `<span class="gc-desc">${hl(g.desc, S.q)}</span>` : ""}
      </button>
      ${g.tags.length ? `<div class="gc-tags">${this._tagBtns(g)}</div>` : ""}
      ${progHtml}
    </article>`;
	}

	folderCard(onclickPath, icon, title, subtitle, meta, preview) {
		return `<article class="gc">
      <button class="gc-open" onclick="app.nav.to('${esc(onclickPath)}')">
        <span class="gc-h"><span class="gc-ico" aria-hidden="true">${icon}</span><span>
          <span class="gc-title" style="display:block">${esc(title)}</span>
          <span class="gc-cat" style="display:block">${esc(subtitle)}</span>
        </span></span>
        ${meta ? `<span class="gc-desc">${esc(meta)}</span>` : ""}
      </button>
      ${preview ? `<div class="gc-tags">${preview}</div>` : ""}
    </article>`;
	}

	_emptyState(icon, title, body, actionHtml) {
		return `<div class="es"><div class="es-i" aria-hidden="true">${icon}</div><h3>${esc(title)}</h3>${body ? `<p>${esc(body)}</p>` : ""}${actionHtml || ""}</div>`;
	}

	/* resume beacons: one-click re-entry to interrupted runbooks */
	_resumeSection() {
		const S = this.app.S;
		const inProgress = this.app.progress
			.all()
			.filter((r) => r.done < r.total)
			.map((r) => ({ r, g: S.guides.find((g) => g.path === r.path) }))
			.filter((x) => x.g)
			.slice(0, 3);
		if (!inProgress.length) return "";
		const cards = inProgress.map(({ r, g }) => this.guideCard(g, undefined, { resume: true, prog: r })).join("");
		return `<h3 class="gv-sec">המשך מהמקום שעצרת</h3><div class="gg">${cards}</div><h3 class="gv-sec">קטגוריות</h3>`;
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
			setC(
				`<div class="gv">${this._emptyState("📭", "לא נמצאו מדריכים", "רענן או הוסף מדריכים כדי להתחיל.", '<button class="btn sm outline" onclick="app.loadGuides()">רענן</button>')}</div>`,
			);
			return;
		}
		const cards = Object.entries(topCats)
			.map(([cat, { count, guides }]) => {
				const preview = guides
					.slice(0, 3)
					.map((g) => `<span class="chip">${esc(g.title)}</span>`)
					.join("");
				return this.folderCard(cat, this.app.sidebar.catIcon(cat), cap(cat), `${count} ${count !== 1 ? "מדריכים" : "מדריך"}`, "", preview);
			})
			.join("");
		setC(
			`<div class="gv"><div class="gv-hd"><h2>דף הבית</h2><p>${Object.keys(topCats).length} קטגוריות · ${S.guides.length} מדריכים</p></div>${this._resumeSection()}<div class="gg">${cards}</div></div>`,
		);
	}

	render() {
		const S = this.app.S;
		document.getElementById("si-clear").hidden = !S.q;
		if (S.q) {
			const gs = this.filtered();
			const cards = gs.map((g) => this.guideCard(g)).join("");
			this.app.toast.announce(`${gs.length} תוצאות חיפוש`);
			setC(
				`<div class="gv"><div class="gv-hd"><h2>תוצאות חיפוש</h2><p>${gs.length} תוצאות עבור "${esc(S.q)}"</p></div>${gs.length ? `<div class="gg">${cards}</div>` : this._emptyState("🔍", "אין תוצאות", "נסה מילות חיפוש אחרות.", '<button class="btn sm outline" onclick="app.clearSearch()">נקה חיפוש</button>')}</div>`,
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
				`<div class="gv"><div class="gv-hd"><h2>נצפו לאחרונה</h2><p>${gs.length} ${gs.length !== 1 ? "מדריכים" : "מדריך"}</p></div>${gs.length ? `<div class="gg">${cards}</div>` : this._emptyState("🕐", "אין מדריכים אחרונים", "פתח מדריך כדי לראותו כאן.")}</div>`,
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
			const clearTagBtn = S.tag
				? `<button class="btn sm outline" onclick="app.sidebar.selectTag('','כל התגים')">נקה סינון תגים</button>`
				: "";

			if (!S.tag && Object.keys(subfolders).length > 0) {
				const numFolders = Object.keys(subfolders).length;
				const folderCards = Object.entries(subfolders)
					.map(([sub, { count, guides: sgs }]) => {
						const subPath = [...S.navPath, sub].join("/");
						const preview = sgs
							.slice(0, 3)
							.map((g) => `<span class="chip">${esc(g.title)}</span>`)
							.join("");
						return this.folderCard(subPath, "📁", cap(sub), title, `${count} ${count !== 1 ? "מדריכים" : "מדריך"}`, preview);
					})
					.join("");
				const dirCards = directGuides.map((g) => this.guideCard(g, title)).join("");
				const total = Object.values(subfolders).reduce((a, b) => a + b.count, 0) + directGuides.length;
				setC(
					`<div class="gv">${breadcrumb}<div class="gv-hd"><h2>${esc(title)}</h2><p>${numFolders} ${numFolders !== 1 ? "תיקיות" : "תיקייה"} · ${total} ${total !== 1 ? "מדריכים" : "מדריך"}</p></div><div class="gg">${folderCards}${dirCards}</div></div>`,
				);
				return;
			}

			const gs = this.filtered();
			const cards = gs.map((g) => this.guideCard(g, title)).join("");
			setC(
				`<div class="gv">${breadcrumb}<div class="gv-hd"><h2>${esc(title)}</h2><p>${gs.length} ${gs.length !== 1 ? "מדריכים" : "מדריך"}</p></div>${gs.length ? `<div class="gg">${cards}</div>` : this._emptyState("📭", "אין מדריכים כאן", S.tag ? "אין מדריכים התואמים לתג שנבחר." : "", clearTagBtn)}</div>`,
			);
			return;
		}
		this.renderHome();
	}
}
