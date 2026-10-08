import test from "node:test";
import assert from "node:assert/strict";
import { CRITERIOS_LIQ, etiquetaCriterio, leyendaCriterios, siglaCriterio, textoCriterio } from "./criterios.ts";

test("hay un solo catálogo: sigla, etiqueta de planes y texto del comprobante salen de él", () => {
  for (const n of [1, 2, 3, 4, 5]) {
    assert.equal(siglaCriterio(n), `C${n}`);
    assert.ok(etiquetaCriterio(n).startsWith(`${n} — `));
    assert.ok(textoCriterio(n).startsWith(`Criterio ${n}: `));
    assert.ok(etiquetaCriterio(n).endsWith(CRITERIOS_LIQ[n].texto));
  }
});

test("sin criterio no hay sigla, y la leyenda trae solo los usados, sin repetir y en orden", () => {
  assert.equal(siglaCriterio(null), "—");
  assert.equal(leyendaCriterios([]), "");
  assert.equal(
    leyendaCriterios([2, null, 1, 2]),
    "C1 = Al completar la membresía, período vencido · C2 = Proporcional al avance, período vencido"
  );
});
