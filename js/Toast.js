"use strict";

/*
 * Toast system — transient feedback for user actions.
 * Container is aria-live=polite; error toasts persist until dismissed.
 * Max 3 visible; extras queue. Hover pauses the auto-dismiss timer.
 */
class Toast {
	constructor() {
		this.el = document.getElementById("toasts");
		this.queue = [];
		this.MAX = 3;
	}

	/* success | error | info; opts: { timeout, action: {label, cb} } */
	show(msg, type = "info", opts = {}) {
		if (this.el.children.length >= this.MAX) {
			this.queue.push([msg, type, opts]);
			return;
		}
		const t = document.createElement("div");
		t.className = `toast ${type}`;
		if (type === "error") t.setAttribute("role", "alert");
		const ico = type === "success" ? "✓" : type === "error" ? "✕" : "›";
		t.innerHTML = `<span class="tico" aria-hidden="true">${ico}</span><span class="tmsg"></span>`;
		t.querySelector(".tmsg").innerHTML = msg; // callers pass esc()'d / bdi()'d content

		if (opts.action) {
			const a = document.createElement("button");
			a.className = "tact";
			a.textContent = opts.action.label;
			a.onclick = () => {
				opts.action.cb();
				this._remove(t);
			};
			t.appendChild(a);
		}

		const x = document.createElement("button");
		x.className = "tclose";
		x.setAttribute("aria-label", "סגור הודעה");
		x.textContent = "✕";
		x.onclick = () => this._remove(t);
		t.appendChild(x);

		this.el.appendChild(t);

		// errors persist until acknowledged; others auto-dismiss, paused on hover/focus
		if (type !== "error") {
			const ttl = opts.timeout || (opts.action ? 8000 : 4500);
			let remaining = ttl;
			let started = Date.now();
			let timer = setTimeout(() => this._remove(t), remaining);
			const pause = () => {
				clearTimeout(timer);
				remaining -= Date.now() - started;
			};
			const resume = () => {
				started = Date.now();
				timer = setTimeout(() => this._remove(t), Math.max(800, remaining));
			};
			t.addEventListener("mouseenter", pause);
			t.addEventListener("mouseleave", resume);
			t.addEventListener("focusin", pause);
			t.addEventListener("focusout", resume);
		}
	}

	success(msg, opts) { this.show(msg, "success", opts); }
	error(msg, opts) { this.show(msg, "error", opts); }

	/* screen-reader-only announcement, no visual toast */
	announce(msg) {
		const live = document.getElementById("sr-live");
		live.textContent = "";
		setTimeout(() => (live.textContent = msg), 30);
	}

	_remove(t) {
		if (!t.isConnected) return;
		t.classList.add("out");
		setTimeout(() => {
			t.remove();
			const next = this.queue.shift();
			if (next) this.show(...next);
		}, 150);
	}
}
