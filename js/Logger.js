"use strict";

class Logger {
	constructor(app) {
		this.app = app;
		this.unread = 0;
	}

	add(txt, type = "") {
		const out = document.getElementById("lo");
		const now = new Date().toLocaleTimeString("en", { hour12: false });
		const prefix = type === "e" ? "✕ " : type === "s" ? "› " : "";
		txt.split("\n")
			.filter((l) => l.trim())
			.forEach((l) => {
				const d = document.createElement("div");
				d.className = "ll" + (type === "e" ? " e" : "");
				// bdi: Hebrew fragments inside LTR log lines must not scramble
				d.innerHTML = `<span class="lt">${now}</span><span class="lx ${type}">${prefix}${bdi(l)}</span>`;
				out.appendChild(d);
			});
		out.scrollTop = out.scrollHeight;

		const dot = document.getElementById("ldot");
		dot.classList.add("live");
		clearTimeout(this._dotTimer);
		this._dotTimer = setTimeout(() => dot.classList.remove("live"), 3000);

		// errors surfaced on the collapsed header so failures are never invisible
		if (type === "e" && this.app.S.logCol) {
			this.unread++;
			document.getElementById("lbadge-n").textContent = this.unread;
			document.getElementById("lbadge").classList.add("on");
		}
	}

	toggle() {
		const S = this.app.S;
		S.logCol = !S.logCol;
		document.getElementById("lp").classList.toggle("col", S.logCol);
		document.getElementById("lh").setAttribute("aria-expanded", String(!S.logCol));
		if (!S.logCol) {
			this.unread = 0;
			document.getElementById("lbadge").classList.remove("on");
			const out = document.getElementById("lo");
			out.scrollTop = out.scrollHeight;
		}
	}

	clear(e) {
		e.stopPropagation();
		document.getElementById("lo").innerHTML = "";
		this.unread = 0;
		document.getElementById("lbadge").classList.remove("on");
	}
}
