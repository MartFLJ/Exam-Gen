"use strict";
/* ---------- navegación ---------- */
function openPanel(name) {
  document.querySelectorAll("[data-panel]").forEach(p => p.classList.toggle("active", p.dataset.panel === name));
  document.querySelectorAll("[data-nav]").forEach(b => { if (b.closest(".nav,.mobile-nav")) b.classList.toggle("active", b.dataset.nav === name); });
  if (name === "questions") renderQ();
  wide(name === "questions" || name === "stats");
  if (name === "stats") renderStats();
  if (name === "exam") renderExam();
  window.scrollTo(0, 0);
}
document.querySelectorAll("[data-nav]").forEach(b => { b.onclick = () => openPanel(b.dataset.nav); });

/* ---------- biblioteca ---------- */
const fmt = t => (t ? new Date(t).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" }) : "—");
function renderLib() {
  const box = $("examList"); box.innerHTML = "";
  exams.forEach(e => {
    const d = document.createElement("div"); d.className = "item" + (e.id === curId ? " cur" : "");
    d.innerHTML = `<strong>${esc(e.name)}</strong><span class="meta">${e.questions.length} preguntas · ${e.minutes} min · ${e.perExam} por examen · ${e.categories.length} categorías</span><span class="meta">Última edición: ${fmt(e.updated)}</span><div class="row"><button class="btn sm">Abrir</button><button class="btn sm">Duplicar</button><button class="btn sm">Exportar</button><button class="btn sm danger">Borrar</button></div>`;
    const [op, dup, ex, del] = d.querySelectorAll("button");
    op.onclick = () => { curId = e.id; flush(); renderLib(); openPanel("questions"); };
    dup.onclick = () => { const c = migrate(clone(e)); c.id = rid("e"); c.name = e.name.slice(0, 50) + " (copia)"; c.updated = Date.now(); exams.unshift(c); flush(); renderLib(); say("Examen duplicado."); };
    ex.onclick = () => exportList([e], slug(e.name) + ".json");
    del.onclick = async () => { if (!await ask(`¿Borrar «${e.name}» con sus ${e.questions.length} preguntas?`)) return; exams = exams.filter(x => x.id !== e.id); if (curId === e.id) curId = null; flush(); renderLib(); say("Examen borrado."); };
    box.appendChild(d);
  });
  $("emptyLib").hidden = exams.length > 0;
  const last = Number(LS.read("exam-lastexport")) || 0, pend = last ? exams.filter(e => (e.updated || 0) > last).length : exams.length;
  const nudge = pend > 0 && (!last || Date.now() - last > 14 * 864e5), b = $("backup");
  b.className = !exams.length ? "" : nudge ? "hint" : "muted";
  b.innerHTML = exams.length ? `<span>Último respaldo: ${last ? fmt(last) : "nunca"}${pend ? ` · ${pend} examen${pend > 1 ? "es" : ""} sin respaldar` : ""}</span>` + (nudge ? '<button class="btn sm" id="bkNow">Respaldar</button>' : "") : "";
  if (nudge) $("bkNow").onclick = () => $("expAll").click();
  status();
}
function addExam(e) { exams.unshift(e); curId = e.id; flush(); renderLib(); openPanel("questions"); }
document.querySelectorAll("[data-act=new]").forEach(b => { b.onclick = () => { addExam(newExam()); say("Examen creado."); $("eName").select(); }; });
$("newBtn").onclick = () => document.querySelector("[data-act=new]").click();
$("exBtn").onclick = () => {
  const O = (t, ok, why) => ({ t, ok: !!ok, why: why || "" });
  addExam(migrate({ id: "ejemplo", updated: Date.now(), name: "Ejemplo: fundamentos de nube", desc: "Examen de muestra con dos preguntas. Puedes editarlo o borrarlo.", minutes: 10, perExam: 2, questions: [
    { text: "¿Qué servicio de AWS ofrece almacenamiento de objetos?", options: [O("Amazon S3", 1, "S3 es el servicio de almacenamiento de objetos."), O("Amazon EC2", 0, "EC2 ofrece servidores virtuales."), O("Amazon RDS", 0, "RDS es para bases de datos relacionales.")], cat: "Almacenamiento", diff: 1, weight: 3, expl: "Los archivos se guardan como objetos dentro de buckets de S3." },
    { text: "¿Cuáles son características de Amazon EC2? (elige dos)", multiple: true, options: [O("Capacidad de cómputo redimensionable", 1), O("DNS administrado"), O("Pago por uso de las instancias", 1), O("Almacenamiento de objetos ilimitado")], cat: "EC2", diff: 2, weight: 4, expl: "EC2 es cómputo elástico con precios por uso." }] }));
};

/* ---------- exportar / importar ---------- */
function exportList(list, name) {
  saveFile(name, new Blob([JSON.stringify({ format: "exam-generator", version: VERSION, exported: new Date().toISOString(), examenes: list.map(migrate) }, null, 2)], { type: "application/json" }));
  say(list.length === 1 ? "Examen exportado." : `${list.length} exámenes exportados.`);
}
$("expAll").onclick = () => { if (!exams.length) { say("No hay exámenes para exportar."); return; } exportList(exams, "exam-generator-examenes.json"); LS.write("exam-lastexport", Date.now()); renderLib(); };
async function importText(raw) {
  let data; try { data = JSON.parse(raw); } catch (e) { say("Eso no es un JSON válido."); return false; }
  if (data && data.format === "exam-gen-backup") return importBackup(data);
  const list = (Array.isArray(data) ? data : data && Array.isArray(data.examenes) ? data.examenes : data && typeof data === "object" ? [data] : [])
    .slice(0, 50).filter(x => x && typeof x === "object" && Array.isArray(x.questions));
  if (!list.length) { say("El JSON no contiene exámenes."); return false; }
  const items = list.map(migrate), taken = new Set(exams.map(e => e.id)), dups = items.filter(x => taken.has(x.id)).length;
  if (!await ask(`Se importarán ${items.length} examen${items.length > 1 ? "es" : ""}` + (dups ? `; ${dups} ya existía${dups > 1 ? "n" : ""} y se guardará${dups > 1 ? "n" : ""} como copia` : "") + ". ¿Continuar?")) return false;
  items.forEach(it => { if (taken.has(it.id)) { it.name = it.name.slice(0, 50) + " (copia)"; it.id = rid("e"); } taken.add(it.id); it.updated = Date.now(); });
  exams = [...items, ...exams]; flush(); renderLib(); say(`${items.length} examen${items.length > 1 ? "es importados" : " importado"}.`);
  return true;
}
function importFile(f) {
  if (f.size > 5e6) { say("El archivo es demasiado grande (máximo 5 MB)."); return Promise.resolve(); }
  return new Promise(done => { const r = new FileReader(); r.onerror = () => { say("No se pudo leer el archivo."); done(); }; r.onload = async () => { await importText(r.result); done(); }; r.readAsText(f); });
}
$("impBtn").onclick = () => $("impFile").click();
$("impFile").onchange = e => { const f = e.target.files[0]; e.target.value = ""; if (f) importFile(f); };
$("pasteBtn").onclick = () => { $("pasteBox").hidden = !$("pasteBox").hidden; if (!$("pasteBox").hidden) $("pasteText").focus(); };
$("pasteCancel").onclick = () => { $("pasteText").value = ""; $("pasteBox").hidden = true; };
$("pasteLoad").onclick = async () => { const t = $("pasteText").value.trim(); if (!t) { say("Pega primero el contenido del JSON."); return; } if (await importText(t)) { $("pasteText").value = ""; $("pasteBox").hidden = true; } };
const hasFiles = e => e.dataTransfer && [...(e.dataTransfer.types || [])].includes("Files");
window.addEventListener("dragover", e => { if (hasFiles(e)) { e.preventDefault(); $("drop").classList.add("over"); } });
window.addEventListener("dragleave", e => { if (!e.relatedTarget) $("drop").classList.remove("over"); });
window.addEventListener("drop", async e => {
  if (!hasFiles(e)) return; e.preventDefault(); $("drop").classList.remove("over");
  const fs = [...e.dataTransfer.files].filter(f => /\.json$/i.test(f.name) || f.type === "application/json").slice(0, 5);
  if (!fs.length) { say("Solo se pueden cargar archivos .json."); return; }
  openPanel("library"); for (const f of fs) await importFile(f);
});

/* ---------- respaldo completo: exámenes + historial + racha + fallos ---------- */
function exportBackup() {
  const data = { format: "exam-gen-backup", version: 1, exported: new Date().toISOString(),
    examenes: exams.map(migrate), history: hist(), fails: fails(), streak: LS.read("exam-streak") || null };
  saveFile("exam-gen-respaldo-completo.json", new Blob([JSON.stringify(data)], { type: "application/json" }));
  LS.write("exam-lastexport", Date.now()); renderLib(); say("Respaldo completo descargado.");
}
async function importBackup(d) {
  const ex = (Array.isArray(d.examenes) ? d.examenes : []).filter(x => x && Array.isArray(x.questions)).slice(0, 200).map(migrate);
  const hi = (Array.isArray(d.history) ? d.history : []).filter(x => x && typeof x === "object" && x.id && x.exam).slice(0, 300);
  const fa = (Array.isArray(d.fails) ? d.fails : []).filter(x => x && x.e && x.q).slice(0, 5000);
  const st = d.streak && typeof d.streak === "object" ? { last: String(d.streak.last || ""), n: Math.max(0, +d.streak.n || 0), best: Math.max(0, +d.streak.best || 0) } : null;
  const info = `Respaldo con ${ex.length} examen${ex.length === 1 ? "" : "es"}, ${hi.length} intento${hi.length === 1 ? "" : "s"} y ${fa.length} fallo${fa.length === 1 ? "" : "s"} pendiente${fa.length === 1 ? "" : "s"}.`;
  if (await ask(info + "\n\n¿Combinar con lo que ya tienes? Se añade lo que no existe y se conserva lo tuyo.", undefined, "Combinar", "Otras opciones")) {
    const ids = new Set(exams.map(e => e.id)); let added = 0, kept = 0;
    ex.forEach(e => { if (ids.has(e.id)) { kept++; return; } ids.add(e.id); exams.push(e); added++; });
    const hids = new Set(hist().map(h => h.id)), hmerged = [...hist(), ...hi.filter(h => !hids.has(h.id))].sort((a, b) => (b.date || 0) - (a.date || 0)).slice(0, 300);
    const f = fails(), fk = new Map(f.map(z => [z.e + "|" + z.q, z]));
    fa.forEach(z => { const k = z.e + "|" + z.q, m = fk.get(k); if (!m) { const c = { e: z.e, q: z.q, c: z.c || "", n: Math.max(1, +z.n || 1) }; f.push(c); fk.set(k, c); } else m.n = Math.max(m.n, +z.n || 1); });
    const mine = LS.read("exam-streak") || {};
    if (st) { const later = st.last > (mine.last || "") ? st : mine.last > st.last ? mine : { ...mine, n: Math.max(mine.n || 0, st.n), best: 0 }; LS.write("exam-streak", { last: later.last || mine.last || st.last, n: later.n || 0, best: Math.max(mine.best || 0, st.best || 0, later.n || 0) }); }
    LS.write("exam-history", hmerged); LS.write("exam-fails", f); flush();
    renderLib(); if (document.querySelector("[data-panel=exam].active")) renderExam();
    say(`Combinado: ${added} examen${added === 1 ? "" : "es"} nuevo${added === 1 ? "" : "s"}${kept ? `, ${kept} ya existía${kept === 1 ? "" : "n"} y se conservó el tuyo` : ""}.`);
    return true;
  }
  if (await ask("¿Reemplazar todo tu progreso por este respaldo? Se pierde lo que tienes ahora.", undefined, "Reemplazar", "Cancelar")) {
    exams = ex; if (!exams.some(e => e.id === curId)) curId = null;
    LS.write("exam-history", hi); LS.write("exam-fails", fa.map(z => ({ e: z.e, q: z.q, c: z.c || "", n: Math.max(1, +z.n || 1) })));
    if (st) LS.write("exam-streak", st); else LS.write("exam-streak", null);
    flush(); renderLib(); if (document.querySelector("[data-panel=exam].active")) renderExam();
    say("Progreso reemplazado por el respaldo."); return true;
  }
  say("Importación cancelada."); return false;
}
$("expAll").onclick = exportBackup;
