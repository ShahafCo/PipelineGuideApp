"use strict";

class ApiClient {
	constructor(app) {
		this.app = app;
	}

	async call(method, endpoint, body) {
		const S = this.app.S;
		const opts = {
			method,
			headers: { Authorization: `Bearer ${S.apiToken}`, "Content-Type": "application/json" },
		};
		if (body !== undefined) opts.body = JSON.stringify(body);
		let r;
		try {
			r = await fetch(`${S.apiBase}${endpoint}`, opts);
		} catch (err) {
			// network-level failure (server unreachable) — not an HTTP error
			this.app.onConnLost?.();
			throw new Error("השרת אינו זמין");
		}
		this.app.onConnRestored?.();
		const data = await r.json();
		if (!r.ok) throw new Error(data.error || r.statusText);
		return data;
	}
}
