"use strict";
/* ---------- PDF (diálogo de impresión del navegador: «Guardar como PDF») ---------- */
function printQs(title, qs, mode) {
  if (!qs.length) { say("No hay preguntas para exportar."); return; }
  const L = "ABCDEFGH", sh = q => q.options.map((o, k) => ({ o, k })).filter(x => x.o.t.trim());
  const body = qs.map((q, i) => `<div class="pq"><div class="pt"><b>${i + 1}.</b> ${rich(q.text)}${q.multiple ? " <i>(elige todas las correctas)</i>" : ""}</div>`
    + sh(q).map((x, j) => `<div class="po">${mode === "a" && x.o.ok ? "☑" : "☐"} <b>${L[j]}.</b> ${rich(x.o.t)}${mode === "a" && x.o.why ? `<div class="pw">${rich(x.o.why)}</div>` : ""}</div>`).join("")
    + (mode === "a" && q.expl ? `<div class="pe"><b>Explicación:</b> ${rich(q.expl)}</div>` : "") + "</div>").join("");
  const key = mode === "k" ? `<div class="pk"><b>Clave de respuestas</b><br>${qs.map((q, i) => `${i + 1}: ${sh(q).map((x, j) => (x.o.ok ? L[j] : "")).join("")}`).join(" · ")}</div>` : "";
  $("printArea").innerHTML = `<h1>${esc(title)}</h1><p class="pm">${qs.length} pregunta${qs.length === 1 ? "" : "s"} · ${fmt(Date.now())}</p>${body}${key}`;
  try { window.print(); say("En el diálogo de impresión elige «Guardar como PDF»."); } catch (err) { say("Tu navegador no permite imprimir desde aquí."); }
}
$("pdfGo").onclick = () => { const e = cur(); if (!e) return; const ids = selIds.size ? new Set(selIds) : new Set(vis); printQs(e.name, e.questions.filter(q => ids.has(q.id) && !incomplete(q)).map(q => clone(q)), $("pdfMode").value); };
