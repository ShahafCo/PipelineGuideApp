"use strict";

/*
 * Persistent per-guide step progress (localStorage).
 * Stored per guide path: { v, titles, done, startedAt, updatedAt }.
 * Progress is keyed to step TITLES, so when a guide is edited we migrate:
 * completion is kept for steps whose titles still exist; anything else is
 * dropped and the caller is told, so stale checkmarks never lie.
 */
class ProgressStore {
	_key(path) {
		return "pg:done:" + path;
	}

	/* returns { done:Set<number>, startedAt:number|null, migrated:boolean } */
	load(path, titles) {
		let raw = null;
		try {
			raw = JSON.parse(localStorage.getItem(this._key(path)) || "null");
		} catch {}
		if (!raw || !Array.isArray(raw.titles) || !Array.isArray(raw.done)) {
			return { done: new Set(), startedAt: null, migrated: false };
		}
		const same = raw.titles.length === titles.length && raw.titles.every((t, i) => t === titles[i]);
		if (same) {
			return { done: new Set(raw.done.filter((i) => i >= 0 && i < titles.length)), startedAt: raw.startedAt || null, migrated: false };
		}
		// guide changed since last visit — migrate by title match
		const doneTitles = new Set(raw.done.map((i) => raw.titles[i]).filter(Boolean));
		const done = new Set();
		titles.forEach((t, i) => {
			if (doneTitles.has(t)) done.add(i);
		});
		return { done, startedAt: raw.startedAt || null, migrated: true };
	}

	save(path, titles, doneSet, startedAt) {
		try {
			if (!doneSet.size) {
				localStorage.removeItem(this._key(path));
				return;
			}
			localStorage.setItem(
				this._key(path),
				JSON.stringify({
					v: 1,
					titles,
					done: [...doneSet].sort((a, b) => a - b),
					startedAt: startedAt || Date.now(),
					updatedAt: Date.now(),
				}),
			);
		} catch {}
	}

	clear(path) {
		try {
			localStorage.removeItem(this._key(path));
		} catch {}
	}

	/* raw snapshot for one guide (for cards) — null if none */
	summary(path) {
		try {
			const raw = JSON.parse(localStorage.getItem(this._key(path)) || "null");
			if (!raw || !Array.isArray(raw.done) || !Array.isArray(raw.titles)) return null;
			return { done: raw.done.length, total: raw.titles.length, startedAt: raw.startedAt || null, updatedAt: raw.updatedAt || null };
		} catch {
			return null;
		}
	}

	/* all in-progress guides, most recent first (for resume beacons) */
	all() {
		const out = [];
		try {
			for (let i = 0; i < localStorage.length; i++) {
				const k = localStorage.key(i);
				if (!k || !k.startsWith("pg:done:")) continue;
				const path = k.slice("pg:done:".length);
				const s = this.summary(path);
				if (s && s.done > 0) out.push({ path, ...s });
			}
		} catch {}
		return out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
	}
}
