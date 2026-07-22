"use strict";

class GuideViewer {
	constructor(app) {
		this.app = app;
		this._observer = null;
		this._celebrated = false;
	}

	async open(path) {
		const S = this.app.S;
		this.app.nav.pushHistory();
		setC(ldg("טוען מדריך..."));
		try {
			const data = await this.app.apiClient.call("GET", `/api/guides/content?path=${encodeURIComponent(path)}`);
			setC(ldg("טוען תמונות..."));
			const content = await this._embedImages(data.content, data.path);
			const steps = this._parseSteps(content);
			const titles = steps.map((s) => s.title);
			const saved = this.app.progress.load(data.path, titles);
			S.cur = { path: data.path, title: data.title, rawContent: data.content, content, steps, meta: data, migrated: saved.migrated };
			S.done = saved.done;
			S.startedAt = saved.startedAt;
			this._celebrated = steps.length > 0 && saved.done.size >= steps.length;
			S.recent = [path, ...S.recent.filter((p) => p !== path)].slice(0, 10);
			S.view = "guide";
			this.render();
			this.app.logger.add(`Opened: ${data.title}`, "s");
		} catch (err) {
			setC(
				`<div class="gv"><div class="es"><div class="es-i" aria-hidden="true">⚠️</div><h3>לא ניתן לטעון את המדריך</h3><p>${esc(err.message)}</p><button class="btn sm outline" onclick="app.viewer.open('${path.replace(/'/g, "\\'")}')">נסה שוב</button></div></div>`,
			);
			this.app.logger.add(err.message, "e");
		}
	}

	async _embedImages(src, guidePath) {
		const dir = guidePath.substring(0, guidePath.lastIndexOf("/"));
		const re = /!\[([^\]]*)\]\(([^)"'\s]+)\)/g;
		const local = [...src.matchAll(re)].filter(([, , s]) => !/^https?:\/\/|^data:|^#/.test(s));
		if (!local.length) return src;
		this.app.logger.add(`Embedding ${local.length} image(s)...`, "s");
		let out = src;
		for (const [full, alt, imgSrc] of local) {
			const imgPath = imgSrc.startsWith("/") ? imgSrc : `${dir}/${imgSrc.replace(/^\.\//, "")}`;
			try {
				const img = await this.app.apiClient.call("GET", `/api/images?path=${encodeURIComponent(imgPath)}`);
				out = out.replace(full, `![${alt}](data:${img.mime};base64,${img.data})`);
			} catch {
				out = out.replace(full, `<span class="img-warn">⚠ תמונה לא נמצאה: ${esc(imgSrc)}</span>`);
				this.app.logger.add(`Image not found: ${imgPath.split("/").pop()}`, "e");
			}
		}
		return out;
	}

	_parseSteps(src) {
		const lines = src.split("\n");
		const steps = [];
		let cur = null,
			fm = false;
		for (let i = 0; i < lines.length; i++) {
			const l = lines[i];
			if (i === 0 && l === "---") {
				fm = true;
				continue;
			}
			if (fm && l === "---") {
				fm = false;
				continue;
			}
			if (fm) continue;
			if (/^##\s/.test(l)) {
				if (cur) steps.push(cur);
				cur = { title: l.replace(/^##\s+(?:step\s+\d+[:.\s-]*)?/i, "").trim(), body: [] };
			} else if (cur) cur.body.push(l);
		}
		if (cur) steps.push(cur);
		if (!steps.length) lines.filter((l) => /^\d+\.\s/.test(l)).forEach((l) => steps.push({ title: l.replace(/^\d+\.\s/, ""), body: [] }));
		return steps;
	}

	_nowIndex() {
		const S = this.app.S;
		if (!S.cur) return -1;
		for (let i = 0; i < S.cur.steps.length; i++) if (!S.done.has(i)) return i;
		return -1;
	}

	render() {
		const S = this.app.S;
		const g = S.cur;
		if (!g) {
			this.app.nav.home();
			return;
		}
		const total = g.steps.length;
		const done = S.done.size;
		const nowIdx = this._nowIndex();

		const pathParts = g.meta.pathParts && g.meta.pathParts.length ? g.meta.pathParts : g.meta.cat ? [g.meta.cat] : ["general"];
		S.navPath = pathParts; // breadcrumb context
		const breadcrumb = this.app.nav.buildBreadcrumb(g.title);

		// freshness comes from the guide list (content API has no timestamps)
		const listed = S.guides.find((x) => x.path === g.path);
		const fresh = listed?.updatedAt ? freshStamp(listed.updatedAt) : null;
		const tags = (g.meta.tags || [])
			.map((t) => `<button class="tagbtn ac" onclick="app.sidebar.selectTag('${t.replace(/'/g, "\\'")}','${t.replace(/'/g, "\\'")}')">${esc(t)}</button>`)
			.join("");

		const actBar =
			S.userRole === "admin"
				? `<div class="act-bar">
            <button class="btn sm outline" onclick="app.editor.open('edit')">✏️ עריכה</button>
            <button class="btn sm ghost-danger" onclick="app.editor.deleteGuide()">🗑 מחיקה</button>
          </div>`
				: "";

		const migratedNotice = g.migrated
			? `<div class="notice" role="status"><span aria-hidden="true">ℹ</span><span>המדריך עודכן מאז הביקור הקודם — ההתקדמות הותאמה לפי שמות השלבים.</span><button class="btn sm" onclick="this.closest('.notice').remove()">הבנתי</button></div>`
			: "";

		let body = "";
		if (total) {
			// Calculate the current completion percentage for the guide's step progress bar.
			const pct = Math.round((done / total) * 100);
			const started = S.startedAt ? `<span class="note">התחלת ${relTimeHe(S.startedAt)}</span>` : "";
			const doneLbl = done >= total ? `<span class="done-lbl">✓ הושלם</span>` : `<span class="num" id="ppct">${pct}%</span>`;
			// Render the main progress summary and the checklist of steps for the current guide.
			const progress = `
        <div class="pblock">
          <div class="pbar-l"><span id="pcount" class="num">${done}/${total} שלבים</span><span id="pright">${doneLbl}</span></div>
          <div class="pbar" id="pbar" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}" aria-valuetext="${done} מתוך ${total} שלבים"><div class="pfill" id="pfill" style="width:${pct}%"></div></div>
          <div class="pmeta">${started}<span class="sp" style="flex:1"></span><button class="btn sm" id="preset" onclick="app.viewer.resetProgress()" ${done ? "" : "hidden"}>אפס התקדמות</button></div>
        </div>`;

			const cards = g.steps
				.map((s, i) => {
					const ok = S.done.has(i);
					const isNow = i === nowIdx;
					const bodyHtml = s.body.join("\n").trim();
					return `<section class="step${ok ? " done" : ""}${isNow ? " now" : ""}" id="s${i}">
            <div class="chk-wrap">
              <input type="checkbox" class="chk-input" id="chk${i}" ${ok ? "checked" : ""}
                aria-label="סמן שלב ${i + 1} כהושלם: ${esc(s.title)}" onchange="app.viewer.togDone(event,${i})">
              <span class="chk" aria-hidden="true"><span class="num">${i + 1}</span><span class="tick">✓</span></span>
            </div>
            <div class="step-main">
              <button class="step-hd" aria-expanded="false" aria-controls="sbody${i}" onclick="app.viewer.togStep(${i})">
                <span class="stitle">${esc(s.title)}</span>
                <span class="chip acc now-chip">הצעד הנוכחי</span>
                <span class="schev" aria-hidden="true">‹</span>
              </button>
              <div class="sbody" id="sbody${i}"><div class="sbody-in" inert><div class="sbody-pad"><div class="md">${bodyHtml ? marked.parse(bodyHtml) : '<p class="note" style="color:var(--text-tertiary);font-size:13px">אין פירוט נוסף לשלב זה.</p>'}</div></div></div>
            </div>
          </section>`;
				})
				.join("");
			body = `${progress}${migratedNotice}<h2 class="steps-lbl">שלבים</h2><div class="steps" id="steps">${cards}</div>`;
		} else {
			body = `<div class="md">${marked.parse(g.content.replace(/^---[\s\S]*?---\n/, ""))}</div>`;
		}

		const sticky = total
			? `<div class="gsticky" id="gsticky">
          <span class="t">${esc(g.title)}</span>
          <div class="pbar" aria-hidden="true"><div class="pfill" id="spfill" style="width:${total ? Math.round((done / total) * 100) : 0}%"></div></div>
          <span class="cnt" id="spcount">${done}/${total}</span>
          <button class="btn sm nextbtn" id="nextbtn" onclick="app.viewer.scrollToNow()" ${nowIdx < 0 ? "hidden" : ""}>הבא: <span id="nextt">${nowIdx >= 0 ? esc(g.steps[nowIdx].title) : ""}</span></button>
        </div>`
			: "";

		setC(`<div class="gview">
      ${sticky}
      <div class="gview-hd" id="gs-top">
        ${breadcrumb}
        <h1>${esc(g.title)}</h1>
        <div class="gmeta">
          <span class="chip">📁 ${esc(pathParts.map((p) => cap(p)).join(" › "))}</span>
          ${total ? `<span class="chip num">📋 ${total} שלבים</span>` : ""}
          ${fresh ? fresh.chip : ""}
          ${tags}
        </div>
        ${actBar}
      </div>
      ${body}
    </div>`);

		this._enhanceCodeBlocks();
		this._setupSticky();
		// open the current step so the operator lands ready to work
		if (nowIdx >= 0) this.togStep(nowIdx, true);
	}

	/* ── targeted DOM patches: no full re-render → no scroll/focus loss ── */

	togStep(i, forceOpen) {
		const el = document.getElementById("s" + i);
		if (!el) return;
		const wasOpen = el.classList.contains("open");
		document.querySelectorAll(".step.open").forEach((s) => {
			s.classList.remove("open");
			s.querySelector(".step-hd")?.setAttribute("aria-expanded", "false");
			s.querySelector(".sbody-in")?.setAttribute("inert", "");
		});
		if (!wasOpen || forceOpen) {
			el.classList.add("open");
			el.querySelector(".step-hd").setAttribute("aria-expanded", "true");
			el.querySelector(".sbody-in").removeAttribute("inert");
		}
	}

	togDone(e, i) {
		const S = this.app.S;
		const g = S.cur;
		if (!g) return;
		const checked = e.target.checked;
		checked ? S.done.add(i) : S.done.delete(i);
		if (checked && !S.startedAt) S.startedAt = Date.now();
		this.app.progress.save(
			g.path,
			g.steps.map((s) => s.title),
			S.done,
			S.startedAt,
		);

		const el = document.getElementById("s" + i);
		el?.classList.toggle("done", checked);
		this._patchProgress();
		this._patchNow();

		const total = g.steps.length;
		const done = S.done.size;
		if (checked) {
			if (done >= total) {
				if (!this._celebrated) {
					this._celebrated = true;
					this.app.toast.success("כל השלבים הושלמו ✓");
				}
				this.togStep(i); // collapse the last one; nothing next to open
			} else {
				// completion gate: checking the LAST step early is not completion
				if (i === total - 1) this.app.toast.show(`נשארו ${total - done} שלבים לא מסומנים`, "info");
				const next = this._nowIndex();
				if (next >= 0) {
					this.togStep(next, true);
					this.app.toast.announce(`שלב ${i + 1} הושלם. הבא: ${g.steps[next].title}`);
				}
			}
		} else {
			this._celebrated = false;
		}
	}

	_patchProgress() {
		const S = this.app.S;
		const g = S.cur;
		if (!g || !g.steps.length) return;
		const total = g.steps.length;
		const done = S.done.size;
		const pct = Math.round((done / total) * 100);
		const bar = document.getElementById("pbar");
		if (bar) {
			bar.setAttribute("aria-valuenow", done);
			bar.setAttribute("aria-valuetext", `${done} מתוך ${total} שלבים`);
		}
		const fill = document.getElementById("pfill");
		if (fill) fill.style.width = pct + "%";
		const cnt = document.getElementById("pcount");
		if (cnt) cnt.textContent = `${done}/${total} שלבים`;
		const right = document.getElementById("pright");
		if (right) right.innerHTML = done >= total ? `<span class="done-lbl">✓ הושלם</span>` : `<span class="num">${pct}%</span>`;
		const reset = document.getElementById("preset");
		if (reset) reset.hidden = !done;
		const sf = document.getElementById("spfill");
		if (sf) sf.style.width = pct + "%";
		const sc = document.getElementById("spcount");
		if (sc) sc.textContent = `${done}/${total}`;
	}

	_patchNow() {
		const S = this.app.S;
		const g = S.cur;
		if (!g) return;
		const nowIdx = this._nowIndex();
		g.steps.forEach((_, i) => {
			document.getElementById("s" + i)?.classList.toggle("now", i === nowIdx);
		});
		const nextBtn = document.getElementById("nextbtn");
		if (nextBtn) {
			nextBtn.hidden = nowIdx < 0;
			const t = document.getElementById("nextt");
			if (t && nowIdx >= 0) t.textContent = g.steps[nowIdx].title;
		}
	}

	// Rail functionality removed — no dynamic vertical connector present.

	resetProgress() {
		const S = this.app.S;
		const g = S.cur;
		if (!g) return;
		const snapshot = new Set(S.done);
		const snapStart = S.startedAt;
		S.done = new Set();
		S.startedAt = null;
		this._celebrated = false;
		this.app.progress.clear(g.path);
		g.steps.forEach((_, i) => {
			const chk = document.getElementById("chk" + i);
			if (chk) chk.checked = false;
			document.getElementById("s" + i)?.classList.remove("done");
		});
		this._patchProgress();
		this._patchNow();
		this.app.toast.success("ההתקדמות אופסה", {
			action: {
				label: "בטל",
				cb: () => {
					S.done = snapshot;
					S.startedAt = snapStart;
					this.app.progress.save(
						g.path,
						g.steps.map((s) => s.title),
						S.done,
						S.startedAt,
					);
					g.steps.forEach((_, i) => {
						const chk = document.getElementById("chk" + i);
						if (chk) chk.checked = snapshot.has(i);
						document.getElementById("s" + i)?.classList.toggle("done", snapshot.has(i));
					});
					this._patchProgress();
					this._patchNow();
				},
			},
		});
	}

	scrollToNow() {
		const nowIdx = this._nowIndex();
		if (nowIdx < 0) return;
		this.togStep(nowIdx, true);
		document.getElementById("s" + nowIdx)?.scrollIntoView({ block: "start" });
	}

	/* copy button on every code block — the #1 runbook action */
	_enhanceCodeBlocks() {
		document.querySelectorAll("#ct .md pre").forEach((pre) => {
			if (pre.parentElement.classList.contains("codewrap")) return;
			const wrap = document.createElement("div");
			wrap.className = "codewrap";
			pre.replaceWith(wrap);
			wrap.appendChild(pre);
			const btn = document.createElement("button");
			btn.className = "copybtn ltr";
			btn.textContent = "העתק";
			btn.setAttribute("aria-label", "העתק את הקוד ללוח");
			btn.onclick = async () => {
				try {
					await navigator.clipboard.writeText(pre.textContent);
					btn.textContent = "✓ הועתק";
					btn.classList.add("ok");
					this.app.toast.announce("הקוד הועתק ללוח");
					setTimeout(() => {
						btn.textContent = "העתק";
						btn.classList.remove("ok");
					}, 1500);
				} catch {
					this.app.toast.error("ההעתקה נכשלה");
				}
			};
			wrap.appendChild(btn);
		});
	}

	/* sticky mini header appears after the title scrolls away */
	_setupSticky() {
		this._observer?.disconnect();
		const sticky = document.getElementById("gsticky");
		const top = document.getElementById("gs-top");
		if (!sticky || !top) return;
		this._observer = new IntersectionObserver(([entry]) => sticky.classList.toggle("vis", !entry.isIntersecting), {
			root: document.getElementById("ct"),
			threshold: 0,
		});
		this._observer.observe(top);
	}
}
