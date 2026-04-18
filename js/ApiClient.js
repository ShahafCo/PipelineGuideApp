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
		const r = await fetch(`${S.apiBase}${endpoint}`, opts);
		const data = await r.json();
		if (!r.ok) throw new Error(data.error || r.statusText);
		return data;
	}
}
