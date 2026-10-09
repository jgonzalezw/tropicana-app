import test from "node:test";
import assert from "node:assert/strict";
import { salasPermitidasDeMembresia } from "./salasDelPlan.ts";

// Admin falso: cada tabla devuelve sus filas; registra a qué tablas se consultó.
function falso(tablas: Record<string, unknown>) {
  const consultadas: string[] = [];
  const a = {
    from(t: string) {
      consultadas.push(t);
      const r = { data: tablas[t], error: null };
      const q: Record<string, unknown> = {
        select: () => q,
        eq: () => q,
        maybeSingle: () => Promise.resolve(r),
        then: (ok: (x: unknown) => unknown) => Promise.resolve(r).then(ok),
      };
      return q;
    },
  };
  return { a: a as never, consultadas };
}

test("un alquiler sin plan no tiene restricción de salas y no consulta el plan", async () => {
  const { a, consultadas } = falso({ membresias: { plan_id: null } });
  assert.equal(await salasPermitidasDeMembresia(a, 1), null);
  assert.deepEqual(consultadas, ["membresias"]);
});

test("plan con salas_modo «solo»: las del plan más las que la membresía ya usa", async () => {
  const { a } = falso({
    membresias: { plan_id: 7 },
    planes: { salas_modo: "solo" },
    plan_salas: [{ sala_id: 1 }, { sala_id: 2 }],
    membresia_salas: [{ sala_id: 2 }, { sala_id: 3 }],
  });
  assert.deepEqual((await salasPermitidasDeMembresia(a, 1))!.sort(), [1, 2, 3]);
});

test("plan que no restringe: sin restricción", async () => {
  const { a } = falso({ membresias: { plan_id: 7 }, planes: { salas_modo: "todas" } });
  assert.equal(await salasPermitidasDeMembresia(a, 1), null);
});
