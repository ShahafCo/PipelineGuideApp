"use strict";

const GUIDE_ICONS = [
	"📋", "📖", "📄", "📝", "📚", "⚙️", "🔧", "🔨", "🏗️", "🛠️",
	"🚀", "🔄", "🎯", "✅", "💡", "⚠️", "🚨", "🔍", "📊", "📈",
	"🗄️", "🔐", "🔑", "🌐", "💾", "🔔", "📌", "🧩", "📡", "☁️",
	"🎛️", "🔬", "🏛️", "🖥️", "🐛", "🔒", "🔓", "🧪", "📦", "🗂️",
	"🔗", "📎", "🗃️", "🖨️", "🖱️",
];

function esc(s) {
	return String(s || "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function cap(s) {
	return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function v(id) {
	return document.getElementById(id)?.value?.trim() || "";
}

function setC(h) {
	document.getElementById("ct").innerHTML = h;
}

function ldg(m) {
	return `<div class="ldg" role="status"><span class="spinner" aria-hidden="true"></span><p>${esc(m)}</p></div>`;
}

/* skeleton card grid — known shape, no layout shift on arrival */
function skels(n = 6) {
	const card = `<div class="skel-card" aria-hidden="true">
    <div style="display:flex;gap:12px;margin-bottom:14px">
      <div class="skel" style="width:40px;height:40px;border-radius:8px"></div>
      <div style="flex:1"><div class="skel" style="height:14px;width:70%;margin-bottom:8px"></div><div class="skel" style="height:11px;width:40%"></div></div>
    </div>
    <div class="skel" style="height:12px;width:100%;margin-bottom:6px"></div>
    <div class="skel" style="height:12px;width:80%"></div>
  </div>`;
	return `<div class="gv" role="status" aria-label="טוען מדריכים"><div class="gg">${card.repeat(n)}</div></div>`;
}

/* wrap opposite-direction fragments so mixed Hebrew/English lines don't scramble */
function bdi(s) {
	return `<bdi>${esc(s)}</bdi>`;
}

/* highlight query matches inside already-escaped text */
function hl(text, q) {
	const safe = esc(text);
	if (!q) return safe;
	const rx = new RegExp(esc(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
	return safe.replace(rx, (m) => `<mark>${m}</mark>`);
}

/* Hebrew relative time for freshness / progress context */
function relTimeHe(ms) {
	if (!ms) return "";
	const s = Math.max(0, (Date.now() - ms) / 1000);
	if (s < 90) return "לפני רגע";
	const m = Math.round(s / 60);
	if (m < 60) return `לפני ${m} דקות`;
	const h = Math.round(m / 60);
	if (h === 1) return "לפני שעה";
	if (h < 24) return `לפני ${h} שעות`;
	const d = Math.round(h / 24);
	if (d === 1) return "אתמול";
	if (d < 30) return `לפני ${d} ימים`;
	const mo = Math.round(d / 30);
	if (mo === 1) return "לפני חודש";
	if (mo < 12) return `לפני ${mo} חודשים`;
	const y = Math.round(mo / 12);
	return y === 1 ? "לפני שנה" : `לפני ${y} שנים`;
}

function fmtDateHe(iso) {
	if (!iso) return "—";
	const t = new Date(iso).getTime();
	return t ? new Date(t).toLocaleDateString("he-IL", { year: "numeric", month: "short", day: "numeric" }) : "—";
}

/* freshness stamp: glyph + Hebrew word + tint — never color alone */
function freshStamp(updatedAt) {
	const ms = updatedAt ? new Date(updatedAt).getTime() : 0;
	if (!ms) return { cls: "", label: "—", chip: '<span class="chip">—</span>' };
	const age = Date.now() - ms;
	const YEAR = 365 * 24 * 3600 * 1000;
	const SIX_MO = 183 * 24 * 3600 * 1000;
	if (age > YEAR) return { cls: "stale", label: "לא עודכן", chip: `<span class="chip bad">■ לא עודכן</span>` };
	if (age > SIX_MO) return { cls: "aging", label: "מתיישן", chip: `<span class="chip warn">▲ מתיישן</span>` };
	return { cls: "fresh", label: "עדכני", chip: `<span class="chip ok">● עדכני</span>` };
}
