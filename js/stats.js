"use strict";
/* ---------- estadísticas ---------- */
let stSel = null;
const MODE_L = { review: "Repaso", fails: "Fallos", daily: "Diario", marked: "Marcadas", study: "Estudio" };
const pct = (a, b) => (b ? Math.round(a / b * 100) : 0), dshort = t => new Date(t).toLocaleDateString("es", { day: "numeric", month: "short" });
function lineSvg(F) {
  const W = 600, H = 190, L = 34, Rr = 12, T = 12, B = 26, x = i => (F.length < 2 ? (L + W - Rr) / 2 : L + i * (W - L - Rr) / (F.length - 1)), y = v => T + (100 - v) * (H - T - B) / 100;
  let h = [0, 50, 100].map(v => `<line x1="${L}" y1="${y(v)}" x2="${W - Rr}" y2="${y(v)}" stroke="var(--border)"/><text x="${L - 6}" y="${y(v)}" text-anchor="end" dominant-baseline="central" font-size="11" fill="var(--muted)">${v}</text>`).join("");
  h += `<polyline points="${F.map((f, i) => x(i).toFixed(1) + "," + y(f.score).toFixed(1)).join(" ")}" fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linejoin="round"/>`;
  h += F.map((f, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(f.score).toFixed(1)}" r="4" fill="var(--primary)"><title>${dshort(f.date)}: ${f.score} %</title></circle>`).join("");
  h += `<text x="${L}" y="${H - 6}" font-size="11" fill="var(--muted)">${dshort(F[0].date)}</text>` + (F.length > 1 ? `<text x="${W - Rr}" y="${H - 6}" text-anchor="end" font-size="11" fill="var(--muted)">${dshort(F[F.length - 1].date)}</text>` : "");
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Puntaje por intento">${h}</svg>`;
}
function radarSvg(c) {
  const N = c.length, cx = 190, cy = 140, R = 88, a = i => -Math.PI / 2 + i * 2 * Math.PI / N, pt = (i, r) => [cx + Math.cos(a(i)) * r, cy + Math.sin(a(i)) * r], pts = f => c.map((_, i) => pt(i, R * f(i)).map(v => v.toFixed(1)).join(",")).join(" ");
  let h = [.25, .5, .75, 1].map(k => `<polygon points="${pts(() => k)}" fill="none" stroke="var(--border)"/>`).join("");
  c.forEach((_, i) => { const [x, y] = pt(i, R); h += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--border)"/>`; });
  h += `<polygon points="${pts(i => c[i].p / 100)}" fill="var(--primary)" fill-opacity=".18" stroke="var(--primary)" stroke-width="2.5" stroke-linejoin="round"/>`;
  c.forEach((x, i) => { const [px, py] = pt(i, R + 14), co = Math.cos(a(i)); h += `<text x="${px.toFixed(1)}" y="${py.toFixed(1)}" text-anchor="${co > .3 ? "start" : co < -.3 ? "end" : "middle"}" dominant-baseline="central" font-size="11" font-weight="600" fill="var(--text)">${esc(x.name.slice(0, 12))} ${x.p}%</text>`; });
  return `<svg viewBox="0 0 380 280" style="width:100%;height:auto" role="img" aria-label="Precisión por categoría">${h}</svg>`;
}
function trendSvg(tr, n) {
  const W = 600, H = 200, L = 34, Rr = 12, T = 12, B = 22, x = k => (n < 2 ? (L + W - Rr) / 2 : L + k * (W - L - Rr) / (n - 1)), y = v => T + (100 - v) * (H - T - B) / 100;
  let h = [0, 50, 100].map(v => `<line x1="${L}" y1="${y(v)}" x2="${W - Rr}" y2="${y(v)}" stroke="var(--border)"/><text x="${L - 6}" y="${y(v)}" text-anchor="end" dominant-baseline="central" font-size="11" fill="var(--muted)">${v}</text>`).join("");
  tr.forEach(s => { h += `<polyline points="${s.pts.map(p => x(p.k).toFixed(1) + "," + y(p.p).toFixed(1)).join(" ")}" fill="none" stroke="${s.col}" stroke-width="2.5" stroke-linejoin="round"/>` + s.pts.map(p => `<circle cx="${x(p.k).toFixed(1)}" cy="${y(p.p).toFixed(1)}" r="3.5" fill="${s.col}"><title>${esc(s.name)}: ${p.p} %</title></circle>`).join(""); });
  h += `<text x="${L}" y="${H - 5}" font-size="11" fill="var(--muted)">Intento 1</text><text x="${W - Rr}" y="${H - 5}" text-anchor="end" font-size="11" fill="var(--muted)">Intento ${n}</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Tendencia por categoría">${h}</svg>`;
}
function renderStats() {
  const box = $("stBox"), all = hist();
  if (!all.length) { box.innerHTML = '<div class="card"><p style="margin:0">Aún no hay intentos. Termina un examen para ver aquí tu historial y tus estadísticas.</p></div>'; return; }
  const names = new Map(); all.forEach(h => { if (!names.has(h.exam)) names.set(h.exam, String(h.name || "Examen").replace(/ (\(repaso\)| · reto diario| · fallos| · marcadas| · estudio.*)$/, "")); });
  if (stSel !== "*" && !names.has(stSel)) stSel = cur() && names.has(cur().id) ? cur().id : "*";
  const H = all.filter(h => stSel === "*" || h.exam === stSel), F = H.filter(h => h.mode === "full" || h.mode === "daily").sort((a, b) => a.date - b.date);
  const idx = new Map(); exams.forEach(e => e.questions.forEach(q => idx.set(e.id + "|" + q.id, q)));
  const ex = exams.find(e => e.id === stSel), its = F.flatMap(h => h.items || []), n = F.length;
  const g = {}; its.forEach(i => { const c = i.c || "Sin categoría", o = g[c] = g[c] || [0, 0, 0]; o[1]++; o[2] += i.t || 0; if (i.ok) o[0]++; });
  const cats = Object.entries(g).map(([name, [ok, t, tt]]) => ({ name, ok, t, p: pct(ok, t), s: Math.round(tt / t) })).sort((a, b) => a.name.localeCompare(b.name));
  const m = {};
  F.forEach(h => (h.items || []).forEach(i => { const key = h.exam + "|" + i.q, o = m[key] = m[key] || { key, n: 0, f: 0, t: 0, c: i.c }; o.n++; o.t += i.t || 0; if (!i.ok) o.f++; }));
  const top = Object.values(m).filter(o => o.f).sort((a, b) => b.f / b.n - a.f / a.n || b.f - a.f).slice(0, 10);
  const avg = n ? Math.round(sum(F.map(h => +h.score || 0)) / n * 10) / 10 : 0, mv = (l, v) => `<div><small>${l}</small><div class="mv">${v}</div></div>`, f1 = v => String(v).replace(".", ",");
  const side = `<div class="exside ns"><div class="card"><h3>Resumen</h3><select id="stSel" aria-label="Examen"><option value="*">Todos los exámenes</option>${[...names].map(([id, nm]) => `<option value="${esc(id)}">${esc(nm)}</option>`).join("")}</select>`
    + `<div class="mgrid">${mv("Intentos", n)}${mv("Promedio", n ? f1(avg) + " %" : "—")}${mv("Mejor", n ? f1(Math.max(...F.map(h => +h.score || 0))) + " %" : "—")}${mv("Último", n ? f1(F[n - 1].score) + " %" : "—")}${mv("Preguntas", its.length)}${mv("Seg. por pregunta", its.length ? Math.round(sum(its.map(i => i.t || 0)) / its.length) : "—")}</div>`
    + '<p class="muted">Los repasos de fallos aparecen en la lista pero no cuentan en las métricas.</p></div>'
    + `<div class="card"><h3>Por categoría</h3>${cats.length >= 3 ? radarSvg(cats) : ""}${cats.map(c => { const col = ex && ex.categories.includes(c.name) ? colorOf(ex, c.name) : "var(--primary)"; return `<div style="margin-top:10px"><div style="display:flex;justify-content:space-between;gap:8px"><span>${esc(c.name)}</span><small>${c.ok}/${c.t} · ${c.p} % · ${c.s} s</small></div><div class="bar"><i style="width:${c.p}%;background:${col}"></i></div></div>`; }).join("") || '<p class="muted" style="margin:0">Sin datos todavía.</p>'}</div></div>`;
  const attempts = H.slice().sort((a, b) => b.date - a.date).slice(0, 100).map(h => {
    const gg = {}; (h.items || []).forEach(i => { const c = i.c || "Sin categoría", o = gg[c] = gg[c] || [0, 0]; o[1]++; if (i.ok) o[0]++; });
    const bad = (h.items || []).filter(i => !i.ok).map(i => idx.get(h.exam + "|" + i.q)), nm = String(h.name || "Examen");
    return `<details class="q"><summary><span class="qt">${dshort(h.date)} · ${esc(nm)} · <b>${f1(h.score)} %</b> (${h.correct}/${h.total}) · ${fmtT(h.used || 0)}</span>${MODE_L[h.mode] ? `<span class="badge">${MODE_L[h.mode]}</span>` : ""}</summary><div class="qbody"><p class="muted">${Object.entries(gg).map(([c, [a, t]]) => `${esc(c)}: ${a}/${t}`).join(" · ")}</p>${bad.length ? bad.map(q => `<div class="ro bad"><b>✗</b><div>${q ? esc(q.text) : "(pregunta eliminada)"}</div></div>`).join("") : '<p class="muted">Sin fallos.</p>'}<button class="btn sm danger" style="margin-top:10px" data-del="${esc(h.id)}">Borrar intento</button></div></details>`;
  }).join("");
  const ser = {}; F.forEach((h, k) => { const g2 = {}; (h.items || []).forEach(i => { const c = i.c || "Sin categoría", o = g2[c] = g2[c] || [0, 0]; o[1]++; if (i.ok) o[0]++; }); Object.entries(g2).forEach(([c, [a, t]]) => (ser[c] = ser[c] || []).push({ k, p: Math.round(a / t * 100) })); });
  const tr = Object.entries(ser).filter(([, p]) => p.length >= 2).sort((a, b) => b[1].length - a[1].length).slice(0, 6).map(([name, pts], i) => { const h2 = Math.max(1, Math.floor(pts.length / 2)), av = a => Math.round(sum(a.map(x => x.p)) / a.length); return { name, pts, d: av(pts.slice(-h2)) - av(pts.slice(0, h2)), col: ex && ex.categories.includes(name) ? colorOf(ex, name) : PALETTE[i % PALETTE.length] }; });
  const trendCard = `<div class="card"><h3>Tendencia por categoría</h3>${tr.length ? trendSvg(tr, n) + `<div>${tr.map(s => `<span style="display:inline-flex;align-items:center;gap:6px;margin:8px 14px 0 0"><i class="dot2" style="background:${s.col};margin:0"></i>${esc(s.name)} <small style="color:${s.d > 0 ? "#2a8a4a" : s.d < 0 ? "var(--danger)" : "var(--muted)"}">${s.d > 0 ? "▲ +" + s.d : s.d < 0 ? "▼ " + s.d : "="} pts</small></span>`).join("")}</div><p class="muted">Compara la primera mitad de tus intentos con la segunda.</p>` : '<p class="muted" style="margin:0">Necesitas al menos 2 intentos con la misma categoría.</p>'}</div>`;
  const gavg = its.length ? sum(its.map(i => i.t || 0)) / its.length : 0, need = Math.min(2, n);
  const slow = Object.values(m).filter(o => o.n >= need && gavg > 0 && o.t / o.n > gavg * 1.5).sort((a, b) => b.t / b.n - a.t / a.n).slice(0, 8);
  const slowCard = `<div class="card"><h3>Preguntas que más te toman</h3>${slow.map(o => { const q = idx.get(o.key), av = Math.round(o.t / o.n); return `<div class="ro"><b>${av} s</b><div>${q ? esc(q.text) : "(pregunta eliminada)"}<small>×${(av / gavg).toFixed(1).replace(".", ",")} de tu media (${Math.round(gavg)} s)${o.c ? " · " + esc(o.c) : ""}</small></div></div>`; }).join("") || '<p class="muted" style="margin:0">Sin preguntas atípicas todavía.</p>'}<p class="muted">Cuentan las que tardas más de 1,5 veces tu media; suelen ser las confusas.</p></div>`;
  const main = `<div class="exmain st"><div class="card"><h3>Histórico</h3>${n ? lineSvg(F) : '<p class="muted" style="margin:0">Aún no hay intentos de examen completo.</p>'}</div>`
    + trendCard + `<div class="card"><h3>Preguntas más falladas</h3>${top.map(o => { const q = idx.get(o.key); return `<div class="ro bad"><b>${o.f}/${o.n}</b><div>${q ? esc(q.text) : "(pregunta eliminada)"}<small>${o.c ? esc(o.c) + " · " : ""}${Math.round(o.t / o.n)} s de media</small></div></div>`; }).join("") || '<p class="muted" style="margin:0">No hay fallos registrados.</p>'}</div>`
    + slowCard + `<div class="card"><h3>Intentos</h3>${attempts}<button class="btn sm danger" id="stClear" style="margin-top:12px">Borrar historial${stSel === "*" ? "" : " de este examen"}</button></div></div>`;
  box.innerHTML = `<div class="exgrid">${side}${main}</div>`;
  $("stSel").value = stSel;
  $("stSel").onchange = ev => { stSel = ev.target.value; renderStats(); };
  box.querySelectorAll("[data-del]").forEach(b => { b.onclick = async () => { if (!await ask("¿Borrar este intento?")) return; LS.write("exam-history", hist().filter(h => h.id !== b.dataset.del)); renderStats(); }; });
  $("stClear").onclick = async () => { if (!await ask(stSel === "*" ? "¿Borrar todo el historial?" : "¿Borrar el historial de este examen?")) return; LS.write("exam-history", hist().filter(h => stSel !== "*" && h.exam !== stSel)); renderStats(); say("Historial borrado."); };
}
