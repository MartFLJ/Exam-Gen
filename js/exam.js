"use strict";
/* ---------- examen completo ---------- */
const sum = a => a.reduce((x, y) => x + y, 0), fmtT = s => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
const hist = () => { const h = LS.read("exam-history"); return Array.isArray(h) ? h : []; };
function loadRun() {
  const r = LS.read("exam-run");
  if (!r || !Array.isArray(r.qs) || !r.qs.length || !Array.isArray(r.ans)) return null;
  r.qs = r.qs.map(cleanQ);
  r.ans = r.qs.map((q, i) => (Array.isArray(r.ans[i]) ? r.ans[i] : []).filter(n => Number.isInteger(n) && n >= 0 && n < q.options.length));
  r.fl = r.qs.map((_, i) => !!(Array.isArray(r.fl) && r.fl[i])); r.chk = r.qs.map((_, i) => !!(Array.isArray(r.chk) && r.chk[i])); r.t = r.qs.map((_, i) => Math.max(0, +(Array.isArray(r.t) && r.t[i]) || 0)); r.back = r.back !== false; r.fb = !!r.fb; r.lap = Date.now(); if (r.el === undefined) { r.el = 0; r.ts = Number(r.start) || Date.now(); } r.el = Math.max(0, +r.el || 0); r.ts = Math.max(0, Number(r.ts) || 0); r.limit = r.limit !== false; r.warned = !!r.warned; r.mode = ["review", "daily", "fails", "marked", "study"].includes(r.mode) ? r.mode : "full"; r.i = clamp(Math.round(+r.i) || 0, 0, r.qs.length - 1); r.start = Number(r.start) || Date.now(); r.secs = clamp(Math.round(+r.secs) || 60, 60, 36000);
  r.examName = String(r.examName || "Examen").slice(0, 60); return r;
}
let run = loadRun(), results = null;
const elapsed = r => (r || run).el + ((r || run).ts ? (Date.now() - (r || run).ts) / 1000 : 0), left = () => Math.max(0, Math.ceil(run.secs - elapsed())), saveRun = () => LS.write("exam-run", run);
const shuffle = (a, r = Math.random) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// Muestreo ponderado sin reemplazo: las preguntas de más peso salen con más frecuencia.
function pickQ(ok, n, r, shuf) {
  const p = ok.map((q, i) => ({ q, i, k: Math.pow(r(), 1 / q.weight) })).sort((a, b) => b.k - a.k).slice(0, n);
  return (shuf ? shuffle(p, r) : p.sort((a, b) => a.i - b.i)).map(x => clone(x.q));
}
const good = e => e.questions.filter(q => !incomplete(q));
const sample = e => pickQ(good(e), Math.min(e.perExam, good(e).length), Math.random, e.opts.shuffle);
// Reto diario: misma semilla (fecha + examen) = mismas 10 preguntas para quien tenga el mismo banco.
function rng(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } let a = h >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ a >>> 15, a | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const ymd = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"), today = () => ymd(new Date());
const daily = e => pickQ(good(e), Math.min(10, good(e).length), rng(today() + "|" + e.id), true);
function streak() {
  const s = LS.read("exam-streak"), y = ymd(new Date(Date.now() - 864e5));
  if (!s || !s.last) return { n: 0, done: false };
  return { n: s.last === today() || s.last === y ? s.n : 0, done: s.last === today() };
}
function bumpStreak() {
  const s = LS.read("exam-streak") || {}, y = ymd(new Date(Date.now() - 864e5)); if (s.last === today()) return;
  const n = s.last === y ? (s.n || 0) + 1 : 1; LS.write("exam-streak", { last: today(), n, best: Math.max(n, s.best || 0) });
}
// Banco de fallos persistente: entra lo que fallas; sale al acertarlo en el modo «Repasar fallos».
const fails = () => { let f = LS.read("exam-fails"); if (!Array.isArray(f)) { f = []; hist().slice().reverse().forEach(h => (h.items || []).forEach(i => { const k = f.findIndex(z => z.e === h.exam && z.q === i.q); if (!i.ok && k < 0) f.push({ e: h.exam, q: i.q, c: i.c, n: 1 }); else if (i.ok && k >= 0) f.splice(k, 1); })); } return f; };
const pending = e => fails().filter(z => z.e === e.id && e.questions.some(q => q.id === z.q && !incomplete(q)));
function updFails(r, items) {
  const f = fails();
  items.forEach(x => { const i = f.findIndex(z => z.e === r.examId && z.q === x.q.id); if (!x.ok) { if (i >= 0) { f[i].n++; f[i].c = x.q.cat; } else f.push({ e: r.examId, q: x.q.id, c: x.q.cat, n: 1 }); } else if (i >= 0 && r.mode === "fails") f.splice(i, 1); });
  LS.write("exam-fails", f);
}
let sel = { limit: true, tutor: null };
function begin(e, qs, name, mode, o = {}) {
  const now = Date.now();
  run = { examId: e.id, examName: name, mode, limit: o.limit !== false, start: now, el: 0, ts: now, lap: now, secs: secsFor(e, qs.length), i: 0, qs, ans: qs.map(() => []), fl: qs.map(q => !!q.flag), chk: qs.map(() => false), t: qs.map(() => 0), back: o.back != null ? o.back : e.opts.back, fb: o.fb != null ? o.fb : e.opts.feedback };
  saveRun(); renderExam();
}
function togglePause() { if (run.ts) { lap(run); run.el = elapsed(); run.ts = 0; } else { run.ts = Date.now(); run.lap = run.ts; } saveRun(); drawQ(); }
const lap = r => { const n = Date.now(); r.t[r.i] = (r.t[r.i] || 0) + (n - r.lap) / 1000; r.lap = n; };
const secsFor = (e, n) => Math.max(60, Math.round(e.minutes * 60 * n / e.perExam));
const wide = on => document.querySelector(".content").classList.toggle("wide", on);
function toggleFlag() {
  run.fl[run.i] = !run.fl[run.i]; saveRun();
  const e = exams.find(x => x.id === run.examId), bq = e && e.questions.find(x => x.id === run.qs[run.i].id);
  if (bq) { bq.flag = run.fl[run.i]; clearTimeout(timer); timer = setTimeout(flush, 400); }
  drawQ();
}
document.addEventListener("keydown", ev => {
  if (!run || !run.ts || ev.ctrlKey || ev.metaKey || ev.altKey || !$("qCard") || !$("dlg").hidden || !document.querySelector("[data-panel=exam].active")) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName) && ev.target.type !== "radio" && ev.target.type !== "checkbox") return;
  const k = ev.key;
  if (k === "ArrowRight") go(run.i + 1); else if (k === "ArrowLeft") go(run.i - 1);
  else if (k === "f" || k === "F") toggleFlag();
  else if (/^[1-8]$/.test(k)) { const o = document.querySelectorAll("#qCard .opt input")[+k - 1]; if (o) o.click(); }
  else return;
  ev.preventDefault();
});
setInterval(() => { const t = $("tbClock"); if (!run) { if (t.textContent) t.textContent = ""; return; } const l = left(), c = $("clock"), txt = run.limit ? fmtT(l) : fmtT(Math.floor(elapsed())), low = run.limit && l <= 300;
  if (c) { c.textContent = txt; c.classList.toggle("warn", low && l >= 60); c.classList.toggle("low", run.limit && l < 60); }
  t.textContent = (run.ts ? "⏱ " : "⏸ ") + txt; t.classList.toggle("warn", low && l >= 60);
  const w = $("warnMsg"); if (w) w.hidden = !(low && run.ts);
  if (low && run.ts && !run.warned) { run.warned = true; saveRun(); say("Quedan 5 minutos."); }
  if (run.limit && run.ts && l === 0) finish(true); }, 1000);

function renderExam() {
  const box = $("exBox");
  wide(true);
  if (results) return renderResults(box);
  if (run) { if (run.limit && left() === 0) return finish(true); return renderRun(box); }
  const e = cur();
  if (!e) { box.innerHTML = '<div class="card"><p style="margin:0 0 12px">No hay un examen abierto. Ábrelo desde la Biblioteca.</p><button class="btn primary">Ir a la Biblioteca</button></div>'; box.querySelector("button").onclick = () => openPanel("library"); return; }
  const ok = good(e).length, bad = e.questions.length - ok, n = Math.min(e.perExam, ok), last = hist().find(h => h.exam === e.id && (h.mode === "full" || h.mode === "daily")), st = streak(), pf = pending(e).length, mk = good(e).filter(q => q.flag).length;
  if (sel.tutor === null) sel.tutor = e.opts.feedback;
  const view = LS.read("exam-view") === "study" ? "study" : "exam";
  const tabs = `<div class="seg vtabs"><button data-view="exam" class="${view === "exam" ? "on" : ""}">Examen</button><button data-view="study" class="${view === "study" ? "on" : ""}">Estudiar</button></div>`;
  if (view === "study") { renderStudy(box, e, tabs, lastOk(e)); return; }
  const seg = (k, v, o) => `<div class="seg" data-seg="${k}">${o.map(([x, l]) => `<button data-v="${x}" class="${v === x ? "on" : ""}">${l}</button>`).join("")}</div>`;
  box.innerHTML = tabs + `<div class="exgrid"><div class="exmain"><div class="card"><div class="rh"><h3 style="margin:0">${esc(e.name)}</h3><span class="badge" title="Racha diaria">🔥 ${st.n} día${st.n === 1 ? "" : "s"}</span></div>`
    + `<div class="mgrid" style="margin-top:12px"><div><small>Preguntas en el examen</small><div class="mv">${n}</div></div><div><small>Tiempo total</small><div class="mv">${Math.round(secsFor(e, n) / 60)} min</div></div><div><small>Último intento</small><div class="mv" style="font-size:16px">${last ? String(last.score).replace(".", ",") + " % · " + fmt(last.date) : "—"}</div></div><div><small>Banco</small><div class="mv" style="font-size:16px">${e.questions.length} preguntas</div></div></div>`
    + `<label style="margin-top:18px">Tiempo</label>${seg("limit", +sel.limit, [[1, "Simulacro · cuenta regresiva"], [0, "Práctica · sin límite"]])}`
    + `<label style="margin-top:12px">Estilo</label>${seg("tutor", +sel.tutor, [[0, "Examen · explicaciones al final"], [1, "Tutor · respuesta inmediata"]])}`
    + `<div class="muted" style="margin-top:14px">` + (ok > n ? `<p style="margin:0 0 6px">Hay ${ok} preguntas y el examen usa ${n}: se eligen al azar y las de más peso salen con más frecuencia.</p>` : "") + (n && n < e.perExam ? '<p style="margin:0 0 6px">Hay menos preguntas que las configuradas, así que el tiempo se reduce en proporción.</p>' : "") + (bad ? `<p style="margin:0">Tienes ${bad} pregunta(s) incompleta(s); no entrarán en el examen.</p>` : "") + `</div></div></div>`
    + `<div class="exside"><div class="card"><h3>Iniciar</h3>`
    + `<button class="btn primary full" id="go" ${n ? "" : "disabled"}>Examen completo</button>`
    + `<button class="btn full" id="goDaily" style="margin-top:8px" ${ok ? "" : "disabled"}>🚀 Reto del día (10 preguntas)${st.done ? " · ✓ hecho hoy" : ""}</button>`
    + `<button class="btn full" id="goFails" style="margin-top:8px" ${pf ? "" : "disabled"}>🧠 Repasar fallos (${pf} pendiente${pf === 1 ? "" : "s"})</button>`
    + `<button class="btn full" id="goMark" style="margin-top:8px" ${mk ? "" : "disabled"}>⚑ Practicar marcadas (${mk})</button><button class="btn full" id="goPrint" style="margin-top:16px" ${n ? "" : "disabled"}>🖨 Imprimir un examen (PDF)</button></div></div></div>`;
  bindSeg(box);
  const o = () => ({ limit: sel.limit, fb: sel.tutor });
  $("go").onclick = () => { const qs = sample(e); if (qs.length) begin(e, qs, e.name, "full", o()); };
  $("goDaily").onclick = () => { const qs = daily(e); if (qs.length) begin(e, qs, e.name + " · reto diario", "daily", o()); };
  $("goFails").onclick = () => { const qs = pending(e).sort((a, b) => b.n - a.n).slice(0, e.perExam).map(z => clone(e.questions.find(q => q.id === z.q))); if (qs.length) begin(e, qs, e.name + " · fallos", "fails", o()); };
  $("goMark").onclick = () => { const qs = good(e).filter(q => q.flag).slice(0, 100).map(q => clone(q)); if (qs.length) begin(e, qs, e.name + " · marcadas", "marked", o()); };
  $("goPrint").onclick = () => printQs(e.name, sample(e), "k");
}
// Último resultado de cada pregunta según el historial (true = acertada).
function lastOk(e) { const m = new Map(); hist().forEach(h => { if (h.exam === e.id) (h.items || []).forEach(i => { if (!m.has(i.q)) m.set(i.q, !!i.ok); }); }); return m; }
function bindSeg(box) {
  box.querySelectorAll("[data-seg]").forEach(g => g.querySelectorAll("button").forEach(b => { b.onclick = () => { const v = b.dataset.v === "1"; if (g.dataset.seg === "limit") sel.limit = v; else sel.tutor = v; g.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b)); }; }));
  box.querySelectorAll("[data-view]").forEach(b => { b.onclick = () => { LS.write("exam-view", b.dataset.view); renderExam(); }; });
}
function renderStudy(box, e, tabs, lm) {
  const pool = v => good(e).filter(q => v === "__all" || q.cat === v);
  const cl = [{ v: "__all", l: "Todas las categorías" }, ...[...new Set(good(e).map(q => q.cat))].sort().map(c => ({ v: c, l: c || "Sin categoría" }))];
  if (!cl.some(x => x.v === sel.cat)) sel.cat = "__all";
  const rows = cl.map(x => { const p = pool(x.v), a = p.filter(q => lm.get(q.id) === true).length, pc = p.length ? Math.round(a / p.length * 100) : 0; return { ...x, n: p.length, a, pc }; });
  const act = rows.find(r => r.v === sel.cat), nn = Math.min(100, act.n);
  const modeL = sel.limit ? "Simulacro · cuenta regresiva" : "Práctica · sin límite", styleL = sel.tutor ? "Tutor · respuesta inmediata" : "Examen · explicaciones al final";
  box.innerHTML = tabs + `<div class="exgrid"><div class="exmain"><div class="card"><h3>Categorías</h3><p class="muted" style="margin-top:0">Toca una categoría para elegirla. Se muestra cuántas preguntas tiene y cuántas acertaste la última vez.</p>`
    + rows.map((r, i) => `<button class="catrow ${r.v === sel.cat ? "on" : ""}" data-cat="${i}"><span class="rh"><strong>${esc(r.l)}</strong><small>${r.a}/${r.n} acertadas · ${r.pc} %</small></span><div class="bar"><i style="width:${r.pc}%"></i></div></button>`).join("")
    + `</div></div><div class="exside"><div class="card"><h3>${esc(act.l)}</h3>`
    + `<p style="margin:0 0 6px">${act.n} pregunta${act.n === 1 ? "" : "s"} en la categoría · se usan ${nn}</p>`
    + `<p class="muted" style="margin:0 0 14px">Tiempo: ${modeL}${sel.limit ? ` (${Math.round(secsFor(e, nn) / 60)} min)` : ""}<br>Estilo: ${styleL}</p>`
    + `<button class="btn full" id="modeLink">Cambiar tiempo o estilo</button>`
    + `<button class="btn primary full" id="goStudy" style="margin-top:8px" ${nn ? "" : "disabled"}>📖 Estudiar esta categoría</button></div></div></div>`;
  bindSeg(box);
  box.querySelectorAll("[data-cat]").forEach(b => { b.onclick = () => { sel.cat = cl[+b.dataset.cat].v; renderExam(); }; });
  $("modeLink").onclick = () => { LS.write("exam-view", "exam"); renderExam(); };
  $("goStudy").onclick = async () => {
    const qs = pickQ(pool(sel.cat), nn, Math.random, e.opts.shuffle), name = act.l;
    if (!qs.length) return;
    const t = sel.limit ? "simulacro con cuenta regresiva de " + Math.round(secsFor(e, qs.length) / 60) + " min" : "sin límite de tiempo";
    if (!await ask(`¿Empezar el estudio de «${name}»?\n\n${qs.length} pregunta${qs.length === 1 ? "" : "s"} · ${t} · ${sel.tutor ? "modo tutor" : "modo examen"}`, undefined, "Empezar", "Cancelar")) return;
    begin(e, qs, e.name + " · estudio: " + name, "study", { limit: sel.limit, fb: sel.tutor });
  };
}
function renderRun(box) {
  box.innerHTML = '<div class="exgrid"><div class="exmain"><div class="card" id="qCard"></div></div><div class="exside"><div class="card"><div class="rh"><strong id="prog"></strong><span class="clock" id="clock"></span></div><button class="btn" id="pause" style="width:100%;margin-top:10px">⏸ Pausar</button><p class="warnMsg" id="warnMsg" hidden>⏱ Quedan menos de 5 minutos</p></div><div class="card"><div class="qnav" id="qnav"></div><p class="muted">⚑ = marcada para volver. Atajos: 1–8 elegir · ← → mover · F marcar.</p></div><div class="card"><div class="row"><button class="btn" id="prev">← Anterior</button><button class="btn" id="next">Siguiente →</button></div><button class="btn flag" id="flag" style="width:100%;margin-top:8px"></button><div class="row" style="margin-top:16px"><button class="btn primary" id="fin">Finalizar examen</button><button class="btn danger" id="quit">Abandonar</button></div></div></div></div>';
  $("clock").textContent = run.limit ? fmtT(left()) : fmtT(Math.floor(elapsed())); $("pause").onclick = togglePause;
  $("prev").onclick = () => go(run.i - 1); $("next").onclick = () => go(run.i + 1);
  $("flag").onclick = toggleFlag;
  $("fin").onclick = async () => { const n = run.ans.filter(a => !a.length).length, f = run.fl.filter(Boolean).length, t = [n && `${n} sin responder`, f && `${f} marcada${f > 1 ? "s" : ""}`].filter(Boolean).join(" y "); if (await ask(t ? `Tienes ${t}. ¿Finalizar el examen?` : "¿Finalizar el examen?")) finish(false); };
  $("quit").onclick = async () => {
    const n = run.qs.length, done = run.ans.filter(a => a.length).length, f = run.fl.filter(Boolean).length;
    const msg = `Vas en la pregunta ${run.i + 1} de ${n}, con ${done} respondida${done === 1 ? "" : "s"}${run.limit ? ` y quedan ${fmtT(left())}` : ""}.\n\nSi abandonas:\n• No se guarda ningún resultado en el historial ni en la racha.\n• Se pierden las respuestas de este intento.\n${f ? `• Las ${f} marcada${f === 1 ? "" : "s"} se conservan en el banco.\n` : ""}\n¿Abandonar?`;
    if (await ask(msg, undefined, "Sí, abandonar", "Seguir")) { run = null; LS.write("exam-run", null); renderExam(); }
  };
  drawQ();
}
function go(i) { if (!run.ts || i < 0 || i >= run.qs.length || (!run.back && i < run.i)) return; lap(run); run.i = i; saveRun(); drawQ(); }
function drawQ() {
  const q = run.qs[run.i], a = run.ans[run.i], n = run.qs.length, P = !run.ts;
  $("pause").textContent = P ? "▶ Reanudar" : "⏸ Pausar"; ["prev", "next", "flag"].forEach(id => { $(id).disabled = P; });
  if (P) { $("prog").textContent = `Pregunta ${run.i + 1} de ${n}`; $("qCard").innerHTML = '<p class="qtext">Examen en pausa</p><p class="muted" style="margin:0 0 14px">Las preguntas están ocultas mientras el tiempo está detenido.</p>'; const b = document.createElement("button"); b.className = "btn primary"; b.textContent = "▶ Reanudar"; b.onclick = togglePause; $("qCard").appendChild(b); $("qnav").innerHTML = ""; return; }
  $("prog").textContent = `Pregunta ${run.i + 1} de ${n}`; $("prev").disabled = run.i === 0 || !run.back; $("next").disabled = run.i === n - 1; $("flag").classList.toggle("on", run.fl[run.i]); $("flag").textContent = run.fl[run.i] ? "⚑ Marcada (quitar marca)" : "⚑ Marcar para volver";
  $("qCard").innerHTML = `<div class="qtext">${rich(q.text)}</div>` + (q.multiple ? '<p class="muted" style="margin:-6px 0 12px">Selección múltiple: marca todas las correctas.</p>' : "");
  if (run.chk[run.i]) revRows(q, a, $("qCard")); else q.options.forEach((o, k) => {
    if (!o.t.trim()) return;
    const l = document.createElement("label"); l.className = "opt";
    l.innerHTML = `<input type="${q.multiple ? "checkbox" : "radio"}" name="o" ${a.includes(k) ? "checked" : ""}><span><b>${$("qCard").querySelectorAll(".opt").length + 1}.</b> ${rich(o.t)}</span>`;
    l.firstChild.onclick = ev => { const c = run.ans[run.i], has = c.includes(k); run.ans[run.i] = q.multiple ? (has ? c.filter(j => j !== k) : [...c, k].sort((x, y) => x - y)) : has ? [] : [k]; ev.target.checked = run.ans[run.i].includes(k); if (run.fb && !q.multiple && run.ans[run.i].length) run.chk[run.i] = true; saveRun(); if (run.chk[run.i]) drawQ(); else drawNav(); };
    $("qCard").appendChild(l);
  });
  if (run.fb && q.multiple && !run.chk[run.i]) { const b = document.createElement("button"); b.className = "btn"; b.style.marginTop = "6px"; b.textContent = "Comprobar respuesta"; b.onclick = () => { if (!run.ans[run.i].length) { say("Elige una respuesta primero."); return; } run.chk[run.i] = true; saveRun(); drawQ(); }; $("qCard").appendChild(b); }
  drawNav();
}
function revRows(q, p, box) {
  const right = q.options.map((o, k) => o.ok && o.t.trim() ? k : -1).filter(k => k >= 0);
  box.insertAdjacentHTML("beforeend", q.options.map((o, k) => !o.t.trim() ? "" : `<div class="ro ${right.includes(k) ? "good" : p.includes(k) ? "bad" : ""}"><b>${right.includes(k) ? "✓" : p.includes(k) ? "✗" : "·"}</b><div>${rich(o.t)}${p.includes(k) ? " <small>(tu respuesta)</small>" : ""}${o.why ? `<small>${rich(o.why)}</small>` : ""}</div></div>`).join("") + (q.expl ? `<div class="muted"><b>Explicación:</b> ${rich(q.expl)}</div>` : ""));
}
function drawNav() {
  const b = $("qnav"); b.innerHTML = "";
  run.qs.forEach((_, i) => { const x = document.createElement("button"); x.className = "nb" + (run.ans[i].length ? " on" : "") + (i === run.i ? " cur" : "") + (run.fl[i] ? " fl" : ""); x.textContent = i + 1; x.disabled = !run.back; x.setAttribute("aria-label", "Ir a la pregunta " + (i + 1)); x.onclick = () => go(i); b.appendChild(x); });
}
// Todo o nada: la pregunta cuenta solo si el conjunto marcado coincide exactamente con las correctas.
function finish(timeout) {
  const r = run; if (r.ts) lap(r); run = null; LS.write("exam-run", null);
  const used = Math.round(r.limit ? Math.min(r.secs, elapsed(r)) : elapsed(r));
  const items = r.qs.map((q, i) => { const p = r.ans[i], right = q.options.map((o, k) => o.ok && o.t.trim() ? k : -1).filter(k => k >= 0); return { q, p, right, ok: p.length === right.length && right.every(k => p.includes(k)), t: Math.round(r.t[i] || 0) }; });
  const correct = items.filter(x => x.ok).length, score = Math.round(sum(items.filter(x => x.ok).map(x => x.q.weight)) / sum(items.map(x => x.q.weight)) * 1000) / 10;
  results = { r, items, used, score, correct, timeout }; updFails(r, items); if (r.mode === "daily") bumpStreak();
  LS.write("exam-history", [{ id: rid("a"), exam: r.examId, name: r.examName, mode: r.mode || "full", date: Date.now(), used, score, correct, total: items.length, items: items.map(x => ({ q: x.q.id, c: x.q.cat, w: x.q.weight, ok: x.ok, t: x.t })) }, ...hist()].slice(0, 300));
  openPanel("exam"); if (timeout) say("Se acabó el tiempo.");
}
const csvCell = v => { let s = String(v); if (/^[=@\t\r]/.test(s) || (/^[+-]/.test(s) && !/^[+-]?\d+(\.\d+)?$/.test(s))) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
function toCsv(R) {
  const txt = (q, idx) => idx.map(k => q.options[k].t).join(" | ");
  const rows = [["N", "Pregunta", "Categoría", "Peso", "Resultado", "Tiempo (s)", "Tu respuesta", "Respuesta correcta"], ...R.items.map((x, i) => [i + 1, x.q.text, x.q.cat, x.q.weight, x.ok ? "Correcta" : "Fallada", x.t, txt(x.q, x.p), txt(x.q, x.right)])];
  return "\ufeff" + rows.map(r => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
function renderResults(box) {
  const R = results, g = {};
  R.items.forEach(x => { const c = x.q.cat || "Sin categoría"; (g[c] = g[c] || [0, 0])[1]++; if (x.ok) g[c][0]++; });
  box.innerHTML = `<div class="exgrid"><div class="exside"><div class="card"><h3>${esc(R.r.examName)}</h3><p class="big">${String(R.score).replace(".", ",")} %</p><p style="margin:4px 0 0">${R.correct} de ${R.items.length} correctas · ${fmtT(R.used)}${R.r.limit ? " de " + fmtT(R.r.secs) : ""}</p><p class="muted" style="margin:4px 0 0">Media por pregunta: ${Math.round(R.used / R.items.length)} s</p>${R.timeout ? '<p class="muted">Se acabó el tiempo: las preguntas sin responder cuentan como falladas.</p>' : ""}<p class="muted">La puntuación pondera cada pregunta por su peso.</p>${R.r.mode === "daily" ? `<p>🔥 Racha: ${streak().n} día${streak().n === 1 ? "" : "s"}</p>` : ""}</div>`
    + `<div class="card"><h3>Por categoría</h3>${Object.entries(g).map(([c, [a, t]]) => { const p = Math.round(a / t * 100); return `<div style="margin-top:10px"><div style="display:flex;justify-content:space-between;gap:8px"><span>${esc(c)}</span><small>${a}/${t} · ${p} %</small></div><div class="bar"><i style="width:${p}%"></i></div></div>`; }).join("")}</div>`
    + '<button class="btn primary full" id="rvDone">Terminar revisión</button><button class="btn full" id="rvFail">Repasar fallos</button><button class="btn full" id="rvCsv">Exportar resultados (CSV)</button><button class="btn full" id="rvUnflag" hidden>Desmarcar las acertadas</button></div><div class="exmain"><div class="card"><h3>Revisión</h3><select id="rvF"><option value="*">Todas las preguntas</option><option value="x">Solo falladas</option></select><div id="rvList"></div></div></div></div>';
  const draw = () => {
    const f = $("rvF").value, l = $("rvList"); l.innerHTML = "";
    R.items.forEach((x, n) => {
      if (f === "x" && x.ok) return;
      const d = document.createElement("details"); d.className = "q " + (x.ok ? "good" : "bad");
      d.innerHTML = `<summary><span class="qt"><span class="mk">${x.ok ? "✓" : "✗"}</span> ${n + 1}. ${esc(x.q.text)}</span><span class="badge">${x.t} s</span></summary><div class="qbody"><div class="qtext" style="font-size:14px;margin-top:10px">${rich(x.q.text)}</div>` + (x.p.length ? "" : '<p class="muted">Sin responder.</p>')
        + x.q.options.map((o, k) => !o.t.trim() ? "" : `<div class="ro ${x.right.includes(k) ? "good" : x.p.includes(k) ? "bad" : ""}"><b>${x.right.includes(k) ? "✓" : x.p.includes(k) ? "✗" : "·"}</b><div>${rich(o.t)}${x.p.includes(k) ? " <small>(tu respuesta)</small>" : ""}${o.why ? `<small>${rich(o.why)}</small>` : ""}</div></div>`).join("")
        + (x.q.expl ? `<div class="muted"><b>Explicación:</b> ${rich(x.q.expl)}</div>` : "") + "</div>";
      l.appendChild(d);
    });
    if (!l.children.length) l.innerHTML = '<p class="muted">No hay preguntas en esta vista.</p>';
  };
  $("rvF").onchange = draw; draw();
  $("rvDone").onclick = () => { results = null; renderExam(); };
  $("rvFail").hidden = !R.items.some(x => !x.ok);
  $("rvFail").onclick = () => { const e = exams.find(x => x.id === R.r.examId); if (!e) { say("El examen original ya no existe."); return; } const qs = R.items.filter(x => !x.ok).map(x => clone(x.q)); results = null; begin(e, qs, e.name + " (repaso)", "review"); };
  $("rvCsv").onclick = () => { saveFile(slug(R.r.examName) + "-resultado.csv", new Blob([toCsv(R)], { type: "text/csv;charset=utf-8" })); say("CSV descargado."); };
  $("rvUnflag").hidden = R.r.mode !== "marked" || !R.items.some(x => x.ok);
  $("rvUnflag").onclick = () => { const e = exams.find(x => x.id === R.r.examId); if (!e) return; const ids = new Set(R.items.filter(x => x.ok).map(x => x.q.id)); e.questions.forEach(q => { if (ids.has(q.id)) q.flag = false; }); flush(); $("rvUnflag").hidden = true; say("Acertadas desmarcadas."); };
}
