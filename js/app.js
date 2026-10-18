"use strict";
/* ---------- inicio ---------- */
renderLib(); status();
(async () => {
  if (!run) return;
  if (run.limit && left() === 0) { finish(true); return; }
  const done = run.ans.filter(a => a.length).length;
  if (await ask(`Tienes un examen en curso: «${run.examName}» (${done}/${run.qs.length} respondidas${run.limit ? ", quedan " + fmtT(left()) : ""}). ¿Quieres continuarlo o empezar uno nuevo?`, undefined, "Continuar", "Empezar uno nuevo")) openPanel("exam");
  else { run = null; LS.write("exam-run", null); say("Examen anterior descartado."); }
})();
