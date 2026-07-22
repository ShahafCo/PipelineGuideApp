"use strict";

/*
 * Step progress is not persisted between guide entries.
 * Each guide open starts fresh, and save is a no-op.
 */
class ProgressStore {
	_key(path) {
		return "pg:done:" + path;
	}

	/* returns { done:Set<number>, startedAt:number|null, migrated:boolean } */
	load(path, titles) {
		return { done: new Set(), startedAt: null, migrated: false };
	}

	save(path, titles, doneSet, startedAt) {
		// Persistence disabled: do not write progress to localStorage.
	}

	clear(path) {
		try {
			localStorage.removeItem(this._key(path));
		} catch {}
	}

	/* raw snapshot for one guide (for cards) — progress no longer persists */
	summary(path) {
		return null;
	}

	/* no persisted in-progress guides */
	all() {
		return [];
	}
}
