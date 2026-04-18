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
		this.view = "home";
		this.cat = null;
		this.q = "";
		this.tag = "";
		this.logCol = false;
		this.navPath = [];
		this.history = [];
		this.collapsedCats = new Set();
		this.catIcons = {};
	}
}
