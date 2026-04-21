"use strict";

class Logger {
	constructor(app) {
		this.app = app;
	}

	add(txt, type = "") {
		const out = document.getElementById("lo");
		const now = new Date().toLocaleTimeString("en", { hour12: false });
		txt.split("\n")
			.filter((l) => l.trim())
			.forEach((l) => {
				const d = document.createElement("div");
				d.className = "ll";
				d.innerHTML = `<span class="lt">${now}</span><span class="lx ${type}">${esc(l)}</span>`;
				out.appendChild(d);
			});
		out.scrollTop = out.scrollHeight;
	}

	toggle() {
		const S = this.app.S;
		S.logCol = !S.logCol;
		document.getElementById("lp").classList.toggle("col", S.logCol);
		document.getElementById("ltogico").setAttribute("points", S.logCol ? "6 9 12 15 18 9" : "18 15 12 9 6 15");
	}

	clear(e) {
		e.stopPropagation();
		document.getElementById("lo").innerHTML = "";
	}
}
