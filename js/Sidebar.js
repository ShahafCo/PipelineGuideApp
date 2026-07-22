"use strict";

class Sidebar {
	constructor(app) {
		this.app = app;
		// arrow-key navigation over visible tree rows (roving focus)
		document.getElementById("cats").addEventListener("keydown", (e) => this._treeKeys(e));
	}

	catIcon(cat) {
		const S = this.app.S;
		if (S.catIcons[cat]) return S.catIcons[cat];
		const icos = { "ci-cd": "⚙️", runbooks: "📖", troubleshooting: "🔧", data: "📊", infrastructure: "🏗️", security: "🔐", general: "📄" };
		return icos[cat.toLowerCase()] || Object.entries(icos).find(([k]) => cat.toLowerCase().includes(k))?.[1] || "📄";
	}

	build() {
		const S = this.app.S;
		const root = {};
		S.guides.forEach((g) => {
			const parts = g.pathParts && g.pathParts.length ? g.pathParts : [g.cat || "general"];
			let node = root;
			for (const part of parts) {
				if (!node[part]) node[part] = { _count: 0, _children: {} };
				node[part]._count++;
				node = node[part]._children;
			}
		});
		document.getElementById("ball").textContent = S.guides.length;
		const el = document.getElementById("cats");
		el.innerHTML = "";
		this._renderTreeLevel(el, root, 0, "");
		this.applySidebarActive();
	}

	_renderTreeLevel(el, node, depth, parentPath) {
		const S = this.app.S;
		for (const [name, data] of Object.entries(node)) {
			const fullPath = parentPath ? `${parentPath}/${name}` : name;
			const safeId = fullPath.replace(/[^a-zA-Z0-9֐-׿]/g, "_");
			const hasChildren = Object.keys(data._children).length > 0;
			const collapsed = S.collapsedCats.has(fullPath);

			const row = document.createElement("div");
			row.className = "sb-row";
			row.id = "nb-" + fullPath.replace(/\//g, "::");
			if (depth > 0) row.style.marginInlineStart = `${8 + depth * 6}px`;

			// main action: navigate to the category (real button)
			const btn = document.createElement("button");
			btn.className = "sb-item";
			btn.onclick = () => this.app.nav.to(fullPath);

			const ico = document.createElement("span");
			ico.className = "sb-ico";
			ico.setAttribute("aria-hidden", "true");
			ico.textContent = depth === 0 ? this.catIcon(name) : hasChildren ? "📁" : "📄";
			btn.appendChild(ico);

			const lbl = document.createElement("span");
			lbl.className = "sb-txt";
			lbl.textContent = cap(name);
			btn.appendChild(lbl);

			const badge = document.createElement("span");
			badge.className = "badge num";
			badge.textContent = data._count;
			btn.appendChild(badge);
			row.appendChild(btn);

			// icon-edit affordance: separate control, revealed on hover/focus
			if (depth === 0) {
				const edit = document.createElement("button");
				edit.className = "sb-aux sb-edit";
				edit.setAttribute("aria-label", `שנה אייקון לקטגוריה ${cap(name)}`);
				edit.textContent = "✏️";
				edit.onclick = (e) => {
					e.stopPropagation();
					this.pickCatIcon(name, edit);
				};
				row.appendChild(edit);
			}

			// expand/collapse: separate sibling control with real state
			if (hasChildren) {
				const chev = document.createElement("button");
				chev.className = "sb-aux";
				chev.id = "chev-" + fullPath.replace(/\//g, "::");
				chev.setAttribute("aria-expanded", String(!collapsed));
				chev.setAttribute("aria-controls", "grp-" + safeId);
				chev.setAttribute("aria-label", `${collapsed ? "הרחב" : "כווץ"} ${cap(name)}`);
				chev.innerHTML = `<span class="sb-chev" aria-hidden="true">‹</span>`;
				chev.onclick = (e) => {
					e.stopPropagation();
					this.togCat(fullPath);
				};
				row.appendChild(chev);
			}
			el.appendChild(row);

			if (hasChildren && !collapsed) {
				const grp = document.createElement("div");
				grp.className = "sb-group";
				grp.id = "grp-" + safeId;
				grp.setAttribute("role", "group");
				el.appendChild(grp);
				this._renderTreeLevel(grp, data._children, depth + 1, fullPath);
			}
		}
	}

	_treeKeys(e) {
		const keys = ["ArrowDown", "ArrowUp", "Home", "End", "ArrowLeft", "ArrowRight"];
		if (!keys.includes(e.key)) return;
		const items = [...document.querySelectorAll("#cats .sb-item")];
		if (!items.length) return;
		const cur = document.activeElement?.closest(".sb-row")?.querySelector(".sb-item");
		let i = items.indexOf(cur);
		if (e.key === "ArrowDown") i = Math.min(items.length - 1, i + 1);
		else if (e.key === "ArrowUp") i = Math.max(0, i - 1);
		else if (e.key === "Home") i = 0;
		else if (e.key === "End") i = items.length - 1;
		else {
			// RTL: ArrowLeft expands (points toward content), ArrowRight collapses
			const chev = document.activeElement?.closest(".sb-row")?.querySelector('[aria-expanded]');
			if (!chev) return;
			const open = chev.getAttribute("aria-expanded") === "true";
			if ((e.key === "ArrowLeft" && !open) || (e.key === "ArrowRight" && open)) {
				e.preventDefault();
				chev.click();
			}
			return;
		}
		e.preventDefault();
		items[i]?.focus();
	}

	togCat(cat) {
		const S = this.app.S;
		S.collapsedCats.has(cat) ? S.collapsedCats.delete(cat) : S.collapsedCats.add(cat);
		try {
			localStorage.setItem("pg:collapsedCats", JSON.stringify([...S.collapsedCats]));
		} catch {}
		this.build();
		// keep keyboard context: return focus to the toggled chevron
		document.getElementById("chev-" + cat.replace(/\//g, "::"))?.focus();
	}

	applySidebarActive() {
		const S = this.app.S;
		document.querySelectorAll(".sb-row").forEach((e) => {
			e.classList.remove("on");
			e.querySelector(".sb-item")?.removeAttribute("aria-current");
		});
		let active = null;
		if (S.view === "home") active = document.getElementById("nall");
		else if (S.view === "recent") active = document.getElementById("nrec");
		else if (S.navPath.length) active = document.getElementById("nb-" + S.navPath.join("/").replace(/\//g, "::"));
		if (active) {
			active.classList.add("on");
			active.querySelector(".sb-item")?.setAttribute("aria-current", "page");
		}
	}

	pickCatIcon(cat, anchorEl) {
		const picker = document.getElementById("float-icon-picker");
		const grid = document.getElementById("float-icon-grid");
		grid.innerHTML = GUIDE_ICONS.map(
			(ico) => `<button onclick="app.sidebar.selectCatIcon('${cat.replace(/'/g, "\\'")}','${ico}')">${ico}</button>`,
		).join("");
		const r = anchorEl.getBoundingClientRect();
		picker.classList.add("on");
		const pw = picker.offsetWidth;
		picker.style.left = Math.max(8, Math.min(window.innerWidth - pw - 8, r.left - pw / 2)) + "px";
		picker.style.top = Math.min(window.innerHeight - picker.offsetHeight - 8, r.bottom + 6) + "px";
		this._iconReturnFocus = anchorEl;
		grid.querySelector("button")?.focus();
		const dismiss = (ev) => {
			if (ev.type === "keydown" && ev.key !== "Escape") return;
			picker.classList.remove("on");
			document.removeEventListener("click", dismiss);
			document.removeEventListener("keydown", dismiss);
			if (ev.type === "keydown") this._iconReturnFocus?.focus();
		};
		setTimeout(() => {
			document.addEventListener("click", dismiss);
			document.addEventListener("keydown", dismiss);
		}, 0);
	}

	selectCatIcon(cat, ico) {
		const S = this.app.S;
		S.catIcons[cat] = ico;
		try {
			localStorage.setItem("pg:catIcons", JSON.stringify(S.catIcons));
		} catch {}
		document.getElementById("float-icon-picker").classList.remove("on");
		this.build();
		if (S.view !== "guide") this.app.grid.render();
	}

	/* ── tag filter (listbox popover) ── */
	buildTags() {
		const S = this.app.S;
		const gs = S.view === "home" || S.view === "recent" || S.view === "guide" ? S.guides : this.app.grid.getContextGuides();
		const tags = new Set();
		gs.forEach((g) => g.tags.forEach((t) => tags.add(t)));
		const list = document.getElementById("tag-dd-list");
		list.innerHTML = "";
		[["", "כל התגים"], ...[...tags].sort().map((t) => [t, t])].forEach(([val, label]) => {
			const d = document.createElement("button");
			d.type = "button";
			d.className = "tag-dd-item";
			d.setAttribute("role", "option");
			d.setAttribute("aria-selected", String(S.tag === val));
			d.innerHTML = `<span class="tick" aria-hidden="true">✓</span><span></span>`;
			d.lastElementChild.textContent = label;
			d.onclick = () => this.selectTag(val, label);
			list.appendChild(d);
		});
	}

	togTagDd(e) {
		e.stopPropagation();
		const list = document.getElementById("tag-dd-list");
		const btn = document.getElementById("tag-dd-btn");
		if (list.classList.contains("on")) return this._closeTagDd();
		list.classList.add("on");
		btn.setAttribute("aria-expanded", "true");
		(list.querySelector('[aria-selected="true"]') || list.firstElementChild)?.focus();

		this._tagKeyHandler = (ev) => {
			const opts = [...list.querySelectorAll(".tag-dd-item")];
			const i = opts.indexOf(document.activeElement);
			if (ev.key === "ArrowDown") { ev.preventDefault(); opts[Math.min(opts.length - 1, i + 1)]?.focus(); }
			else if (ev.key === "ArrowUp") { ev.preventDefault(); opts[Math.max(0, i - 1)]?.focus(); }
			else if (ev.key === "Home") { ev.preventDefault(); opts[0]?.focus(); }
			else if (ev.key === "End") { ev.preventDefault(); opts[opts.length - 1]?.focus(); }
			else if (ev.key === "Escape") { ev.preventDefault(); this._closeTagDd(true); }
			else if (ev.key === "Tab") this._closeTagDd();
		};
		list.addEventListener("keydown", this._tagKeyHandler);
		this._tagDismiss = () => this._closeTagDd();
		setTimeout(() => document.addEventListener("click", this._tagDismiss), 0);
	}

	_closeTagDd(returnFocus) {
		const list = document.getElementById("tag-dd-list");
		list.classList.remove("on");
		document.getElementById("tag-dd-btn").setAttribute("aria-expanded", "false");
		list.removeEventListener("keydown", this._tagKeyHandler || (() => {}));
		document.removeEventListener("click", this._tagDismiss || (() => {}));
		if (returnFocus) document.getElementById("tag-dd-btn").focus();
	}

	selectTag(val, label) {
		const S = this.app.S;
		S.tag = val;
		const btn = document.getElementById("tag-dd-btn");
		btn.textContent = label + " ▾";
		btn.classList.toggle("tinted", !!val);
		this._closeTagDd(true);
		this.buildTags();
		if (S.view === "guide") {
			S.history.length ? this.app.nav.back() : this.app.nav.home();
		} else {
			this.app.grid.render();
		}
	}
}
