"use strict";

class GuideApp {
	constructor() {
		this.S = new AppState();
		this.toast = new Toast();
		this.progress = new ProgressStore();
		this.logger = new Logger(this);
		this.apiClient = new ApiClient(this);
		this.nav = new Navigation(this);
		this.sidebar = new Sidebar(this);
		this.grid = new GuideGrid(this);
		this.viewer = new GuideViewer(this);
		this.editor = new GuideEditor(this);
		this.admin = new AdminPanel(this);
		this._stimer = null;
		this._connLost = false;

		try {
			this.S.catIcons = JSON.parse(localStorage.getItem("pg:catIcons") || "{}");
			JSON.parse(localStorage.getItem("pg:collapsedCats") || "[]").forEach((c) => this.S.collapsedCats.add(c));
		} catch {}

		// theme: system | dark | light (persisted; dark is the product default)
		this._mq = window.matchMedia("(prefers-color-scheme: light)");
		this._mq.addEventListener("change", () => {
			if (this._theme === "system") this._applyTheme();
		});
		this.setTheme(localStorage.getItem("pg:theme") || "dark", true);

		// remembered connection details (never the password)
		try {
			const conn = JSON.parse(localStorage.getItem("pg:conn") || "null");
			if (conn) {
				document.getElementById("fh").value = conn.host || "";
				document.getElementById("fp").value = conn.port || 7842;
				document.getElementById("fu").value = conn.user || "";
			}
		} catch {}

		const si = document.getElementById("si");
		si.addEventListener("keydown", (e) => {
			if (e.key === "Escape") {
				e.stopPropagation();
				this.clearSearch();
				si.blur();
			}
		});

		document.addEventListener("keydown", (e) => {
			if ((e.ctrlKey || e.metaKey) && (e.key === "f" || e.key === "k")) {
				e.preventDefault();
				si.focus();
				si.select();
			}
			if (e.key === "Escape") {
				// dialogs handle their own Esc (cancel event); popovers self-dismiss
				if (document.querySelector("dialog[open]")) return;
				if (document.querySelector(".tag-dd-list.on, .icon-pick.on, #float-icon-picker.on")) return;
				if (this.S.view === "guide") this.nav.back();
			}
		});
	}

	/* ── theme ── */
	setTheme(t, silent) {
		this._theme = t;
		try {
			localStorage.setItem("pg:theme", t);
		} catch {}
		this._applyTheme();
		document.querySelectorAll(".theme-seg .btn").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.t === t)));
		if (!silent) this.toast.announce(t === "light" ? "ערכת נושא בהירה" : t === "dark" ? "ערכת נושא כהה" : "ערכת נושא לפי המערכת");
	}

	_applyTheme() {
		const resolved = this._theme === "system" ? (this._mq.matches ? "light" : "dark") : this._theme;
		document.documentElement.dataset.theme = resolved;
	}

	/* ── generic confirm dialog (promise) ── */
	confirm({ title, body, confirmLabel = "אישור", cancelLabel = "ביטול" }) {
		return new Promise((resolve) => {
			const dlg = document.getElementById("cf-dialog");
			document.getElementById("cf-title").textContent = title;
			document.getElementById("cf-body").innerHTML = body;
			const okBtn = document.getElementById("cf-ok");
			const cancelBtn = document.getElementById("cf-cancel");
			okBtn.textContent = confirmLabel;
			cancelBtn.textContent = cancelLabel;
			let result = false;
			okBtn.onclick = () => {
				result = true;
				dlg.close();
			};
			cancelBtn.onclick = () => dlg.close();
			dlg.addEventListener("close", () => resolve(result), { once: true });
			dlg.showModal();
			cancelBtn.focus(); // safe action is the default
		});
	}

	/* ── connection chip ── */
	_setConnChip(state, label) {
		const chip = document.getElementById("conn-chip");
		chip.className = "chip" + (state === "ok" ? " ok" : state === "warn" ? " warn" : state === "busy" ? " acc" : "");
		document.getElementById("cl").textContent = label;
	}

	onConnLost() {
		if (!this.S.apiToken || this._connLost) return;
		this._connLost = true;
		document.getElementById("conn-banner").hidden = false;
		this._setConnChip("warn", "החיבור אבד");
	}

	onConnRestored() {
		if (!this._connLost) return;
		this._connLost = false;
		document.getElementById("conn-banner").hidden = true;
		if (this.S.apiToken) this._setConnChip("ok", `${this.S.apiUser}@${this.S.host}`);
		this.toast.success("החיבור לשרת חודש");
	}

	retryConnection() {
		this.loadGuides();
	}

	/* ── session ── */
	async connect() {
		const host = v("fh"),
			port = +v("fp") || 7842,
			user = v("fu"),
			pass = document.getElementById("fpass").value;
		if (!host || !user || !pass) return this._showErr("כתובת שרת, שם משתמש וסיסמה הם שדות חובה.");
		this._btnState(true);
		this._setConnChip("busy", "מתחבר…");
		this.S.apiBase = `http://${host}:${port}`;
		try {
			const lr = await fetch(`${this.S.apiBase}/api/login`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username: user, password: pass }),
			});
			const ld = await lr.json();
			if (!lr.ok) throw new Error(ld.error || "הכניסה נכשלה");
			this.S.host = host;
			this.S.apiToken = ld.token;
			this.S.userRole = ld.role;
			this.S.apiUser = ld.username;
			try {
				localStorage.setItem("pg:conn", JSON.stringify({ host, port, user }));
			} catch {}
			this.logger.add(`Signed in as ${ld.username} (${ld.role})`, "s");
		} catch (err) {
			this.S.apiBase = "";
			this._btnState(false);
			this._setConnChip("", "מנותק");
			const msg = err instanceof TypeError ? "השרת אינו זמין — בדוק כתובת ופורט." : err.message;
			return this._showErr(msg);
		}
		this._btnState(false);
		this._goApp();
		await this.loadGuides();
	}

	async disconnect() {
		if (this.S.apiToken)
			try {
				await this.apiClient.call("POST", "/api/logout", {});
			} catch {}
		this.S.guides = [];
		this.S.cur = null;
		this.S.recent = [];
		this.S.apiToken = "";
		this.S.userRole = null;
		this.S.apiUser = null;
		this.S.apiBase = "";
		this._connLost = false;
		document.getElementById("conn-banner").hidden = true;
		document.getElementById("as").classList.remove("on");
		document.getElementById("ls").classList.add("on");
		this._setConnChip("", "מנותק");
		document.getElementById("lerr").classList.remove("on");
		document.getElementById("fpass").value = "";
		this._btnState(false);
		document.getElementById("fpass").focus();
	}

	async loadGuides() {
		const rb = document.getElementById("rb");
		rb.classList.add("spin");
		rb.setAttribute("aria-disabled", "true");
		if (!this.S.guides.length) setC(skels());
		try {
			const { guides } = await this.apiClient.call("GET", "/api/guides");
			this.S.guides = guides.map((g) => ({ ...g, icon: g.frontmatter?.icon || this.sidebar.catIcon(g.pathParts?.[0] || g.cat) }));
			this.sidebar.build();
			this.nav.home();
			this.logger.add(`Loaded ${this.S.guides.length} guide(s)`, "s");
		} catch (err) {
			setC(
				`<div class="gv"><div class="es"><div class="es-i" aria-hidden="true">⚠️</div><h3>הטעינה נכשלה</h3><p>${esc(err.message)}</p><button class="btn sm outline" onclick="app.loadGuides()">נסה שוב</button></div></div>`,
			);
			this.logger.add(err.message, "e");
		} finally {
			rb.classList.remove("spin");
			rb.removeAttribute("aria-disabled");
		}
	}

	/* ── search ── */
	onSearch(q) {
		clearTimeout(this._stimer);
		this.S.q = q;
		document.getElementById("si-clear").hidden = !q;
		this._stimer = setTimeout(() => {
			if (this.S.view === "guide") {
				if (!q) return;
				this.nav.pushHistory();
				this.S.view = "home";
			}
			this.grid.render();
		}, 200);
	}

	clearSearch() {
		const si = document.getElementById("si");
		si.value = "";
		this.S.q = "";
		document.getElementById("si-clear").hidden = true;
		if (this.S.view !== "guide") this.grid.render();
		si.focus();
	}

	/* ── login form helpers ── */
	_btnState(busy) {
		const b = document.getElementById("cbtn");
		if (busy) {
			b.setAttribute("aria-disabled", "true");
			b.setAttribute("aria-busy", "true");
			b.innerHTML = `<span class="spinner" aria-hidden="true"></span>מתחבר…`;
		} else {
			b.removeAttribute("aria-disabled");
			b.removeAttribute("aria-busy");
			b.textContent = "התחבר";
		}
	}

	_showErr(m) {
		const e = document.getElementById("lerr");
		e.innerHTML = `<span aria-hidden="true">⚠</span><span>${esc(m)}</span>`;
		e.classList.add("on");
		e.focus();
	}

	_goApp() {
		document.getElementById("ls").classList.remove("on");
		document.getElementById("as").classList.add("on");
		const label = `${this.S.apiUser}@${this.S.host}`;
		this._setConnChip("ok", label);
		document.getElementById("cinfo").textContent = `${label} (${this.S.userRole})`;
		const isAdmin = this.S.userRole === "admin";
		document.getElementById("ngb").hidden = !isAdmin;
		document.getElementById("ap-btn").hidden = !isAdmin;
	}
}

window.app = new GuideApp();
