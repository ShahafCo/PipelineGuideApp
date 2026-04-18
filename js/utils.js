"use strict";

const GUIDE_ICONS = [
	"📋",
	"📖",
	"📄",
	"📝",
	"📚",
	"⚙️",
	"🔧",
	"🔨",
	"🏗️",
	"🛠️",
	"🚀",
	"🔄",
	"🎯",
	"✅",
	"💡",
	"⚠️",
	"🚨",
	"🔍",
	"📊",
	"📈",
	"🗄️",
	"🔐",
	"🔑",
	"🌐",
	"💾",
	"🔔",
	"📌",
	"🧩",
	"📡",
	"☁️",
	"🎛️",
	"🔬",
	"🏛️",
	"🖥️",
	"🐛",
	"🔒",
	"🔓",
	"🧪",
	"📦",
	"🗂️",
	"🔗",
	"📎",
	"🗃️",
	"🖨️",
	"🖱️",
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
	return `<div class="es"><div class="spin2"></div><p>${m}</p></div>`;
}
