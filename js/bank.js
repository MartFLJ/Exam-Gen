"use strict";
/* ---------- preguntas: examen y categorías ---------- */
function renderQ() {
  const e = cur(); $("qEmpty").hidden = !!e; $("qMain").hidden = !e; if (!e) return;
  $("eName").value = e.name; $("eDesc").value = e.desc; $("eMin").value = e.minutes; $("ePer").value = e.perExam;
  renderMeta(); renderCats(); renderList(); syncOpts(); updBulk();
}
function renderMeta() {
  const e = cur(), n = e.questions.length, h = $("eHint");
  h.hidden = n >= e.perExam;
  h.textContent = n ? `Tienes ${n} pregunta${n > 1 ? "s" : ""} y cada examen usa ${e.perExam}: se usarán todas.` : "Aún no hay preguntas. Agrégalas en el banco de abajo.";
}
$("eName").oninput = ev => { cur().name = ev.target.value; touch(); status(); };
$("eDesc").oninput = ev => { cur().desc = ev.target.value; touch(); };
$("eMin").onchange = ev => { const e = cur(); e.minutes = clamp(Math.round(+ev.target.value) || 60, 1, 600); ev.target.value = e.minutes; touch(); };
const OPT_SW = { swBack: "back", swShuf: "shuffle", swFb: "feedback" };
function syncOpts() { const e = cur(); for (const [id, k] of Object.entries(OPT_SW)) { $(id).classList.toggle("active", e.opts[k]); $(id).setAttribute("aria-checked", e.opts[k]); } }
for (const [id, k] of Object.entries(OPT_SW)) $(id).onclick = () => { const e = cur(); e.opts[k] = !e.opts[k]; syncOpts(); touch(); };
$("ePer").onchange = ev => { const e = cur(); e.perExam = clamp(Math.round(+ev.target.value) || 20, 1, 500); ev.target.value = e.perExam; renderMeta(); touch(); };

function renderCats() {
  const e = cur(), box = $("catChips"); box.innerHTML = "";
  e.categories.forEach(c => {
    const n = e.questions.filter(q => q.cat === c).length, s = document.createElement("span"); s.className = "chip";
    s.innerHTML = `<input type="color" class="cc" value="${colorOf(e, c)}" aria-label="Color de ${esc(c)}"><span style="margin:0 4px 0 6px">${esc(c)} (${n})</span><button title="Renombrar" aria-label="Renombrar">✎</button><button title="Quitar" aria-label="Quitar">×</button>`;
    const [r, x] = s.querySelectorAll("button"); const cp = s.firstChild; cp.onchange = () => { e.colors[c] = cp.value; touch(); renderList(); }; r.onclick = () => renameCat(c); x.onclick = () => delCat(c); box.appendChild(s);
  });
  const f = $("qFilter"), v = f.options.length ? f.value : "*";
  f.innerHTML = '<option value="*">Todas las categorías</option><option value="__flag">⚑ Solo marcadas</option><option value="">Sin categoría</option>' + e.categories.map(c => `<option>${esc(c)}</option>`).join("");
  f.value = [...f.options].some(o => o.value === v) ? v : "*";
}
async function renameCat(c) {
  const e = cur(), n = ((await ask("Nuevo nombre de la categoría:", c)) || "").trim().slice(0, 30);
  if (!n || n === c) return;
  if (e.categories.includes(n)) { say("Ya existe una categoría con ese nombre."); return; }
  e.colors[n] = colorOf(e, c); delete e.colors[c]; e.categories = e.categories.map(x => x === c ? n : x); e.questions.forEach(q => { if (q.cat === c) q.cat = n; });
  touch(); renderCats(); renderList();
}
async function delCat(c) {
  const e = cur(), n = e.questions.filter(q => q.cat === c).length;
  if (!await ask(`¿Quitar la categoría «${c}»?` + (n ? ` Sus ${n} pregunta${n > 1 ? "s" : ""} quedarán sin categoría.` : ""))) return;
  delete e.colors[c]; e.categories = e.categories.filter(x => x !== c); e.questions.forEach(q => { if (q.cat === c) q.cat = ""; });
  touch(); renderCats(); renderList();
}
$("catAdd").onclick = () => {
  const e = cur(), n = $("catNew").value.trim().slice(0, 30);
  if (!n) return;
  if (e.categories.includes(n)) { say("Esa categoría ya existe."); return; }
  if (e.categories.length >= 40) { say("Máximo 40 categorías."); return; }
  e.colors[n] = PALETTE[e.categories.length % PALETTE.length]; e.categories.push(n); $("catNew").value = ""; touch(); renderCats(); renderList();
};
$("catNew").onkeydown = ev => { if (ev.key === "Enter") $("catAdd").click(); };

/* ---------- preguntas: banco ---------- */
let selMode = false; const selIds = new Set(), vis = [];
const sumHtml = q => `${selMode ? `<input type="checkbox" class="sel" data-sid="${q.id}" ${selIds.has(q.id) ? "checked" : ""} aria-label="Seleccionar">` : ""}<span class="qt">${esc(q.text || "(sin enunciado)")}</span><span class="badges">${q.flag ? '<span class="badge w">⚑</span>' : ""}${incomplete(q) ? '<span class="badge w">Incompleta</span>' : ""}${q.multiple ? '<span class="badge">Múltiple</span>' : ""}${q.cat ? `<span class="badge"><i class="dot2" style="background:${colorOf(cur(), q.cat)}"></i>${esc(q.cat)}</span>` : ""}<span class="badge">${DIFF[q.diff]} · peso ${q.weight}</span></span>`;
function renderList() {
  const e = cur(), f = $("qFilter").value, s = $("qSearch").value.trim().toLowerCase(), box = $("qList"), dd = +$("qDiff").value; box.innerHTML = ""; vis.length = 0;
  let n = 0;
  e.questions.forEach(q => {
    if ((f === "__flag" ? !q.flag : f !== "*" && q.cat !== f) || (s && !q.text.toLowerCase().includes(s)) || (dd && q.diff !== dd)) return; n++; vis.push(q.id);
    const d = document.createElement("details"); d.className = "q"; d.dataset.id = q.id; d.style.borderLeft = `4px solid ${qColor(e, q)}`; d.innerHTML = `<summary>${sumHtml(q)}</summary>`;
    d.addEventListener("toggle", () => { if (d.open && !d.dataset.built) { d.dataset.built = 1; buildForm(d, q); } });
    box.appendChild(d);
  });
  if (!n) box.innerHTML = '<p class="muted">No hay preguntas en esta vista.</p>';
}
$("qFilter").onchange = renderList; $("qSearch").oninput = renderList; $("qDiff").onchange = renderList;
$("addQ").onclick = () => {
  const e = cur(), f = $("qFilter").value;
  if (e.questions.length >= 1000) { say("Máximo 1000 preguntas por examen."); return; }
  const q = newQ(); if (f !== "*" && f !== "__flag") q.cat = f; $("qSearch").value = ""; $("qDiff").value = "0";
  e.questions.unshift(q); touch(); renderCats(); renderMeta(); renderList();
  const d = document.querySelector(`[data-id="${q.id}"]`); if (d) { d.open = true; d.scrollIntoView({ block: "nearest" }); }
};
function buildForm(d, q) {
  const e = cur(), b = document.createElement("div"); b.className = "qbody";
  b.innerHTML = `<div class="fg" style="margin-top:12px"><label>Enunciado <small>usa &#96;&#96;&#96; para bloques de código y &#96;código&#96; en línea</small></label><textarea rows="3" maxlength="2000" data-k="text">${esc(q.text)}</textarea></div>
<label>Opciones <small>marca las correctas; el texto de abajo de cada una explica por qué</small></label><div class="opts"></div><button class="add" data-a="opt">+ Agregar opción</button>
<div class="grid3"><div class="fg"><label>Categoría</label><select data-k="cat"><option value="">Sin categoría</option>${e.categories.map(c => `<option>${esc(c)}</option>`).join("")}</select></div>
<div class="fg"><label>Dificultad</label><select data-k="diff"><option value="1">Fácil</option><option value="2">Media</option><option value="3">Difícil</option></select></div>
<div class="fg"><label>Peso (importancia)</label><select data-k="weight">${[1, 2, 3, 4, 5].map(n => `<option>${n}</option>`).join("")}</select></div></div>
<div class="option"><span>Selección múltiple (todo o nada)</span><button class="switch" data-a="multi" role="switch"><span class="dot"></span></button></div>
<div class="fg"><label>Explicación de la respuesta correcta</label><textarea rows="3" maxlength="1500" data-k="expl">${esc(q.expl)}</textarea></div>
<div class="row"><button class="btn sm" data-a="flag">${q.flag ? "⚑ Quitar marca" : "⚑ Marcar"}</button><button class="btn sm" data-a="up">▲ Subir</button><button class="btn sm" data-a="down">▼ Bajar</button><button class="btn sm" data-a="dup">Duplicar</button><button class="btn sm danger" data-a="del">Borrar</button></div>`;
  for (const k of ["cat", "diff", "weight"]) b.querySelector(`[data-k=${k}]`).value = q[k];
  const sw = b.querySelector("[data-a=multi]"), ob = b.querySelector(".opts");
  const sum = () => { d.querySelector("summary").innerHTML = sumHtml(q); touch(); };
  const drawO = () => {
    sw.classList.toggle("active", q.multiple); sw.setAttribute("aria-checked", q.multiple); ob.innerHTML = "";
    q.options.forEach((o, i) => {
      const r = document.createElement("div"); r.className = "orow";
      r.innerHTML = `<input type="${q.multiple ? "checkbox" : "radio"}" name="r${q.id}" ${o.ok ? "checked" : ""} aria-label="Correcta" title="Correcta"><input type="text" maxlength="300" value="${esc(o.t)}" placeholder="Opción ${i + 1}"><button class="icon" title="Quitar" aria-label="Quitar" ${q.options.length <= 2 ? "disabled" : ""}>×</button><input type="text" class="why" maxlength="500" value="${esc(o.why)}" placeholder="Por qué es correcta o incorrecta (opcional)">`;
      const [ok, t, x, w] = r.children;
      ok.onchange = () => { if (q.multiple) o.ok = ok.checked; else q.options.forEach(p => { p.ok = p === o; }); sum(); };
      t.oninput = () => { o.t = t.value; sum(); };
      w.oninput = () => { o.why = w.value; touch(); };
      x.onclick = () => { q.options.splice(i, 1); drawO(); sum(); };
      ob.appendChild(r);
    });
  };
  b.addEventListener("input", ev => {
    const k = ev.target.dataset.k; if (!k) return;
    q[k] = k === "diff" || k === "weight" ? +ev.target.value : ev.target.value;
    if (k === "cat") { renderCats(); d.style.borderLeftColor = qColor(e, q); }
    sum();
  });
  b.addEventListener("click", async ev => {
    const el = ev.target.closest("[data-a]"), a = el && el.dataset.a;
    if (a === "opt") { if (q.options.length < 8) { q.options.push(newOpt()); drawO(); sum(); } }
    else if (a === "multi") { q.multiple = !q.multiple; if (!q.multiple) oneOk(q.options); drawO(); sum(); }
    else if (a === "flag") { q.flag = !q.flag; el.textContent = q.flag ? "⚑ Quitar marca" : "⚑ Marcar"; sum(); }
    else if (a === "up" || a === "down") { const i = e.questions.indexOf(q), j = i + (a === "up" ? -1 : 1); if (j < 0 || j >= e.questions.length) return; [e.questions[i], e.questions[j]] = [e.questions[j], e.questions[i]]; touch(); renderList(); const d2 = document.querySelector(`[data-id="${q.id}"]`); if (d2) { d2.open = true; d2.scrollIntoView({ block: "nearest" }); } }
    else if (a === "dup") { const c = cleanQ(clone(q)); c.id = rid("q"); e.questions.splice(e.questions.indexOf(q) + 1, 0, c); touch(); renderCats(); renderMeta(); renderList(); say("Pregunta duplicada."); }
    else if (a === "del") delQs(e, new Set([q.id]));
  });
  drawO(); d.appendChild(b);
}

/* ---------- selección múltiple y deshacer ---------- */
const refreshQ = () => { renderCats(); renderMeta(); renderList(); updBulk(); };
function updBulk() {
  const e = cur(); if (!e) return;
  [...selIds].forEach(id => { if (!e.questions.some(q => q.id === id)) selIds.delete(id); });
  $("bulk").hidden = !selMode; $("selBtn").textContent = selMode ? "✕ Salir de la selección" : "☑ Seleccionar";
  $("bN").textContent = `${selIds.size} seleccionada${selIds.size === 1 ? "" : "s"}`;
  $("bCat").innerHTML = '<option value="">Mover a categoría…</option><option value="__none">Sin categoría</option>' + e.categories.map(c => `<option>${esc(c)}</option>`).join("");
  ["bCat", "bDiffS", "bW", "bDel"].forEach(id => { $(id).disabled = !selIds.size; });
}
function sayUndo(msg, fn) {
  const t = $("toast"); t.textContent = msg + " "; const b = document.createElement("button"); b.className = "tb"; b.textContent = "Deshacer";
  b.onclick = () => { fn(); t.classList.remove("show", "act"); }; t.appendChild(b); t.classList.add("show", "act");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show", "act"), 8000);
}
function delQs(e, ids) {
  const items = []; e.questions.forEach((q, i) => { if (ids.has(q.id)) items.push({ q, i }); });
  if (!items.length) return;
  e.questions = e.questions.filter(q => !ids.has(q.id)); ids.forEach(id => selIds.delete(id)); touch(); refreshQ();
  sayUndo(items.length === 1 ? "Pregunta borrada." : `${items.length} preguntas borradas.`, () => {
    items.forEach(({ q, i }) => { if (!e.categories.includes(q.cat)) q.cat = ""; e.questions.splice(Math.min(i, e.questions.length), 0, q); });
    touch(); if (cur() === e) refreshQ();
  });
}
$("selBtn").onclick = () => { selMode = !selMode; selIds.clear(); renderList(); updBulk(); };
$("qList").addEventListener("change", ev => { const t = ev.target; if (!t.classList.contains("sel")) return; if (t.checked) selIds.add(t.dataset.sid); else selIds.delete(t.dataset.sid); updBulk(); });
$("bAll").onclick = () => { vis.forEach(id => selIds.add(id)); renderList(); updBulk(); };
$("bNone").onclick = () => { selIds.clear(); renderList(); updBulk(); };
const bulk = fn => { const e = cur(), n = selIds.size; e.questions.forEach(q => { if (selIds.has(q.id)) fn(q); }); touch(); refreshQ(); say(`${n} pregunta${n === 1 ? "" : "s"} actualizada${n === 1 ? "" : "s"}.`); };
$("bCat").onchange = ev => { const v = ev.target.value; if (v) bulk(q => { q.cat = v === "__none" ? "" : v; }); };
$("bDiffS").onchange = ev => { const v = +ev.target.value; if (v) bulk(q => { q.diff = v; }); ev.target.value = ""; };
$("bW").onchange = ev => { const v = +ev.target.value; if (v) bulk(q => { q.weight = v; }); ev.target.value = ""; };
$("bDel").onclick = () => delQs(cur(), new Set(selIds));

/* ---------- añadir preguntas por JSON ---------- */
function checkQ(r) {
  if (!r || typeof r !== "object") return "no es un objeto";
  if (typeof r.text !== "string" || !r.text.trim()) return "falta el enunciado (text)";
  if (!Array.isArray(r.options) || r.options.length < 2) return "necesita al menos 2 opciones (options)";
  if (r.options.length > 8) return "máximo 8 opciones";
  const o = r.options.map(x => (typeof x === "string" ? { t: x } : x));
  if (o.some(x => !x || typeof x.t !== "string" || !x.t.trim())) return "hay una opción sin texto (t)";
  const ok = o.filter(x => x.ok === true || x.ok === 1).length;
  if (!ok) return "ninguna opción está marcada como correcta (ok: true)";
  if (ok > 1 && !r.multiple) return "hay varias correctas pero falta multiple: true";
  return null;
}
function addQuestions(raw) {
  const e = cur(), out = $("jsRes");
  const show = (okMsg, msgs) => { out.innerHTML = (okMsg ? `<p class="muted"><b>${okMsg}</b></p>` : "") + msgs.slice(0, 15).map(m => `<div class="ro bad"><b>✗</b><div>${esc(m)}</div></div>`).join("") + (msgs.length > 15 ? `<p class="muted">…y ${msgs.length - 15} más.</p>` : ""); };
  let d; try { d = JSON.parse(raw); } catch (err) { show("", ["JSON no válido: " + err.message]); return; }
  const src = Array.isArray(d) ? d : d && Array.isArray(d.examenes) ? d.examenes : [d], qs = src.flatMap(x => (x && Array.isArray(x.questions) ? x.questions : [x]));
  if (!qs.length) { show("", ["No encontré preguntas en el JSON."]); return; }
  const bad = [], add = [], seen = new Set(e.questions.map(q => q.text.trim().toLowerCase()));
  qs.forEach((r, i) => {
    const m = checkQ(r); if (m) { bad.push(`Pregunta ${i + 1}: ${m}`); return; }
    const q = cleanQ({ ...r, id: undefined }), k = q.text.trim().toLowerCase();
    if (seen.has(k)) { bad.push(`Pregunta ${i + 1}: ya existe en el banco, se omitió.`); return; }
    seen.add(k); add.push(q);
  });
  const room = Math.max(0, 1000 - e.questions.length);
  if (add.length > room) { bad.push(`Solo caben ${room} preguntas más (máximo 1000); el resto se omitió.`); add.length = room; }
  add.forEach(q => {
    if (q.cat && !e.categories.includes(q.cat)) { if (e.categories.length < 40) { e.colors[q.cat] = PALETTE[e.categories.length % PALETTE.length]; e.categories.push(q.cat); } else q.cat = ""; }
    e.questions.push(q);
  });
  if (add.length) { touch(); renderCats(); renderMeta(); renderList(); $("jsText").value = ""; }
  show(add.length ? `${add.length} pregunta${add.length > 1 ? "s" : ""} importada${add.length > 1 ? "s" : ""}.` : "", bad);
}
$("jsGo").onclick = () => { if (!cur()) return; const t = $("jsText").value.trim(); if (!t) { say("Pega primero el JSON."); return; } addQuestions(t); };
$("jsFile").onclick = () => $("jsFileIn").click();
$("jsFileIn").onchange = ev => { const f = ev.target.files[0]; ev.target.value = ""; if (!f) return; if (f.size > 5e6) { say("Archivo demasiado grande (máx. 5 MB)."); return; } const r = new FileReader(); r.onload = () => { $("jsText").value = r.result; addQuestions(r.result); }; r.readAsText(f); };
