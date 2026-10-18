"use strict";
const VERSION = 1, $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), clone = o => JSON.parse(JSON.stringify(o));
const rid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// Código en enunciados: ```bloque``` y `en línea`.
const rich = s => esc(s).replace(/```(?:[a-z0-9]*\n)?([\s\S]*?)```/gi, (_, c) => `<pre><code>${c.replace(/\n$/, "")}</code></pre>`).replace(/`([^`\n]+)`/g, "<code>$1</code>");
const mem = {}, LS = {
  read(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return mem[k] ?? null; } },
  write(k, v) { mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};
const DIFF = ["", "Fácil", "Media", "Difícil"];
const PALETTE = ["#e0457b", "#2f7de1", "#e8a21a", "#2a9d6f", "#8e5ad7", "#e8663d", "#17a2b8", "#7a8a2b", "#c2417d", "#5c6bc0"];
const colorOf = (e, c) => e.colors[c] || PALETTE[Math.max(0, e.categories.indexOf(c)) % PALETTE.length], qColor = (e, q) => (q.cat ? colorOf(e, q.cat) : "transparent");

/* ---------- modelo ---------- */
const newOpt = () => ({ t: "", ok: false, why: "" });
const newQ = () => ({ id: rid("q"), text: "", options: [{ ...newOpt(), ok: true }, newOpt(), newOpt(), newOpt()], multiple: false, cat: "", diff: 2, weight: 3, expl: "", flag: false });
const newExam = () => ({ id: rid("e"), updated: Date.now(), name: "Nuevo examen", desc: "", minutes: 60, perExam: 20, categories: [], colors: {}, opts: { back: true, shuffle: true, feedback: false }, questions: [] });
const oneOk = opts => { let f = false; opts.forEach(o => { if (o.ok && f) o.ok = false; f = f || o.ok; }); };

function cleanQ(r) {
  r = r && typeof r === "object" ? r : {};
  const opts = (Array.isArray(r.options) ? r.options : []).slice(0, 8).map(o => typeof o === "string" ? { t: o.slice(0, 300), ok: false, why: "" } : { t: String(o && o.t != null ? o.t : "").slice(0, 300), ok: !!(o && o.ok), why: String(o && o.why != null ? o.why : "").slice(0, 500) });
  while (opts.length < 2) opts.push(newOpt());
  const multiple = !!r.multiple; if (!multiple) oneOk(opts);
  return { id: typeof r.id === "string" && r.id ? r.id.slice(0, 40) : rid("q"), text: String(r.text ?? "").slice(0, 2000), options: opts, multiple,
    cat: String(r.cat ?? "").trim().slice(0, 30), diff: clamp(Math.round(+r.diff) || 2, 1, 3), weight: clamp(Math.round(+r.weight) || 3, 1, 5), expl: String(r.expl ?? "").slice(0, 1500), flag: !!r.flag };
}
// Construye un examen válido a partir de cualquier dato (JSON importado, versiones futuras, etc.).
function migrate(r) {
  r = r && typeof r === "object" ? r : {};
  const qs = (Array.isArray(r.questions) ? r.questions : []).slice(0, 1000).map(cleanQ), seen = new Set();
  qs.forEach(q => { if (seen.has(q.id)) q.id = rid("q"); seen.add(q.id); });
  const cats = [...new Set([...(Array.isArray(r.categories) ? r.categories : []).map(c => String(c).trim().slice(0, 30)), ...qs.map(q => q.cat)].filter(Boolean))].slice(0, 40);
  qs.forEach(q => { if (!cats.includes(q.cat)) q.cat = ""; });
  const colors = {}; cats.forEach((c, i) => { const v = r.colors && r.colors[c]; colors[c] = typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : PALETTE[i % PALETTE.length]; });
  return { id: typeof r.id === "string" && r.id ? r.id.slice(0, 40) : rid("e"), updated: Number(r.updated) || 0, name: String(r.name ?? "Examen").slice(0, 60), desc: String(r.desc ?? "").slice(0, 300),
    minutes: clamp(Math.round(+r.minutes) || 60, 1, 600), perExam: clamp(Math.round(+r.perExam) || 20, 1, 500), categories: cats, colors, opts: { back: !(r.opts && r.opts.back === false), shuffle: !(r.opts && r.opts.shuffle === false), feedback: !!(r.opts && r.opts.feedback) }, questions: qs };
}
const incomplete = q => { const o = q.options.filter(x => x.t.trim()); return !q.text.trim() || o.length < 2 || !o.some(x => x.ok); };

/* ---------- estado y guardado automático ---------- */
let exams = (Array.isArray(LS.read("exam-bank")) ? LS.read("exam-bank") : []).map(migrate);
let curId = LS.read("exam-current"); if (!exams.some(e => e.id === curId)) curId = null;
const cur = () => exams.find(e => e.id === curId) || null;
let saveOk = true, timer = null, toastT;
function flush() { clearTimeout(timer); timer = null; saveOk = LS.write("exam-bank", exams) && LS.write("exam-current", curId); status(); }
function touch() { const e = cur(); if (e) e.updated = Date.now(); clearTimeout(timer); timer = setTimeout(flush, 400); }
window.addEventListener("beforeunload", () => { if (timer) flush(); });
document.addEventListener("visibilitychange", () => { if (document.hidden && timer) flush(); });
function backupText() {
  const l = Number(LS.read("exam-lastexport")) || 0;
  if (!l) return exams.length ? "Sin respaldo" : "";
  const d = Math.floor((Date.now() - l) / 864e5);
  return "Último respaldo " + (d < 1 ? "hoy" : d === 1 ? "hace 1 día" : `hace ${d} días`);
}
function status() {
  const e = cur();
  $("stName").textContent = e ? e.name || "Sin nombre" : "Sin examen abierto";
  $("stState").textContent = saveOk ? "Guardado en este navegador" : "No se pudo guardar: almacenamiento lleno";
  $("stState").style.color = saveOk ? "" : "var(--warn)";
  $("stBackup").textContent = backupText();
}
function say(m) { const t = $("toast"); t.textContent = m; t.classList.remove("act"); t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2800); }
const slug = s => (s || "examen").toLowerCase().replace(/[^a-z0-9áéíóúñ]+/gi, "-").replace(/^-|-$/g, "") || "examen";
function saveFile(name, blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }

// Diálogo propio: confirm() y prompt() quedan bloqueados dentro de iframes sandbox (p. ej. la vista previa de Claude).
function ask(msg, def, yesL, noL) {
  return new Promise(res => {
    const d = $("dlg"), i = $("dIn"), txt = def !== undefined;
    $("dMsg").textContent = msg; $("dYes").textContent = yesL || "Aceptar"; $("dNo").textContent = noL || "Cancelar"; i.hidden = !txt; i.value = def || ""; d.hidden = false; (txt ? i : $("dYes")).focus();
    const end = v => { d.hidden = true; $("dYes").onclick = $("dNo").onclick = d.onkeydown = null; res(v); };
    $("dYes").onclick = () => end(txt ? i.value : true); $("dNo").onclick = () => end(txt ? null : false);
    d.onkeydown = ev => { if (ev.key === "Escape") $("dNo").click(); else if (ev.key === "Enter" && ev.target === i) $("dYes").click(); };
  });
}
/* ---------- modo claro / oscuro de la app ---------- */
const sysDark = () => !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
const curMode = () => document.documentElement.dataset.theme || (sysDark() ? "dark" : "light");
function applyMode(m) { if (m === "light" || m === "dark") document.documentElement.dataset.theme = m; $("modeBtn").textContent = curMode() === "dark" ? "☀" : "☾"; }
{ const sv = LS.read("exam-ui"); applyMode(sv && sv.mode); }
$("modeBtn").onclick = () => { const m = curMode() === "dark" ? "light" : "dark"; applyMode(m); LS.write("exam-ui", { mode: m }); };
