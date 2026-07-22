"use strict";

class AppState {
	constructor() {
		this.host = "";
		this.apiBase = "";
		this.apiToken = "";
		this.userRole = null;
		this.apiUser = null;
		this.guides = [];
		this.recent = [];
		this.cur = null;
		this.done = new Set();
		this.startedAt = null; // when the current guide's progress began
		this.view = "home";
		this.cat = null;
		this.q = "";
		this.tag = "";
		this.logCol = true; // log panel starts collapsed (quiet chrome)
		this.navPath = [];
		this.history = [];
		this.collapsedCats = new Set();
		this.catIcons = {};
	}
}
