/**
 * Certificación del motor de liquidación.
 *
 * Cada caso fija **una regla de negocio** contra números verificables a mano.
 * Corren sin base de datos y sin dependencias: `node --test`, TypeScript
 * nativo. Si alguno se pone rojo, o el motor cambió o la regla cambió — y las
 * dos cosas tienen que pasar por `docs/REGLAS.md` antes que por acá.
 *
 * El principio que las ordena a todas (Javier, 2026-09-18): **las clases solo
 * afectan contadores**. La plata sale de membresías completadas (agotadas) y
 * cobradas al 100%; el conteo de clases es apenas el insumo del prorrateo.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularDevengos, type DatosMotor, type MembresiaLiq } from "./motor.ts";
import type { Curso } from "../tipos.ts";

// ── Fixtures ─────────────────────────────────────────────────────────────

const HASTA = "2026-08-31"; // último día del mes vencido

function curso(id: number, nombre: string, dias: number[], extra: Partial<Curso> = {}): Curso {
  return {
    id,
    nombre,
    linea: null,
    nivel: null,
    dias_semana: dias,
    hora: "19:00",
    duracion_min: 60,
    sala_id: 1,
    precio_mensual: 400,
    activo: true,
    vigente_desde: null,
    vigente_hasta: null,
    creado_en: "2026-01-01",
    actualizado_en: "2026-01-01",
    ...extra,
  };
}

function membresia(id: number, extra: Partial<MembresiaLiq> = {}): MembresiaLiq {
  return {
    id,
    alumno_id: 1,
    curso_id: 1,
    plan_id: 1,
    es_prueba: false,
    acompanantes: null,
    fecha_inicio: "2026-08-03",
    fecha_fin: "2026-08-24",
    ...extra,
  };
}

/** Los cuatro lunes de agosto 2026: 3, 10, 17 y 24. */
const LUNES = ["2026-08-03", "2026-08-10", "2026-08-17", "2026-08-24"];
/** Los miércoles del mismo tramo: 5, 12, 19. */
const MIERCOLES = ["2026-08-05", "2026-08-12", "2026-08-19"];

function dictadas(cursoId: number, fechas: string[]): DatosMotor["sesiones"] {
  return fechas.map((fecha) => ({ curso_id: cursoId, fecha, estado: "dictada", reemplazo_motivo: null }));
}

/**
 * Arma el escenario base: una membresía cobrada al 100%, con lo mínimo para
 * que el motor tenga algo que repartir. Cada test pisa lo que necesita.
 */
function datos(over: Partial<DatosMotor> = {}): DatosMotor {
  return {
    membresias: [membresia(1)],
    cursosDeMembresia: [{ inscripcion_id: 1, curso_id: 1, dias: [1], fecha: null }],
    comisionesPrevias: [],
    cuotas: [{ id: 1, inscripcion_id: 1, monto_devengado: 400, descuento_adelanto: 0 }],
    pagos: [{ cuota_id: 1, monto: 400, descuento: 0 }],
    sesiones: dictadas(1, LUNES),
    cursos: [curso(1, "Salsa", [1])],
    tarifas: [{ curso_id: 1, modalidad: "clase", precio: 50 }],
    asignaciones: [
      { id: 1, curso_id: 1, profesor_id: 1, pct_ingresos: 50, desde: "2026-01-01", hasta: null },
    ],
    alumnos: [{ id: 1, nombre: "Ana", apellido: "Pérez" }],
    profesores: [
      { id: 1, nombre: "Oscar", apellido: "Núñez" },
      { id: 2, nombre: "Natalia", apellido: "Salek" },
    ],
    ...over,
  };
}

// ── 1. Qué entra a liquidarse ────────────────────────────────────────────

test("1. solo entra la membresía cobrada al 100%, y solo hasta el mes vencido", () => {
  // Cobrada entera: entra.
  assert.equal(calcularDevengos(datos(), HASTA).pendientes.length, 1);

  // Con saldo pendiente NO entra: la comisión se devenga sobre lo cobrado
  // (reglas 1 y 8) — agotada pero con deuda, la venta no terminó.
  const conSaldo = calcularDevengos(
    datos({ pagos: [{ cuota_id: 1, monto: 300, descuento: 0 }] }),
    HASTA
  );
  assert.deepEqual(conSaldo.pendientes, []);

  // Un ciclo que terminó DESPUÉS del mes vencido no corresponde a este período.
  const futura = calcularDevengos(
    datos({ membresias: [membresia(1, { fecha_fin: "2026-09-07" })] }),
    HASTA
  );
  assert.deepEqual(futura.pendientes, []);
});

// ── 2. Mono-curso: el conteo no decide su número (regla 16a) ─────────────

test("2. mono-curso: lo cobrado va entero al curso, se dicten 4 clases o 2", () => {
  const cuatro = calcularDevengos(datos(), HASTA).pendientes;
  assert.equal(cuatro.length, 1);
  assert.equal(cuatro[0].base, 400);
  assert.equal(cuatro[0].monto, 200); // 50% de 400

  // Se suspenden dos de las cuatro: el conteo baja, la plata no se mueve.
  const dos = calcularDevengos(
    datos({
      sesiones: [
        ...dictadas(1, LUNES.slice(0, 2)),
        ...LUNES.slice(2).map((fecha) => ({
          curso_id: 1,
          fecha,
          estado: "suspendida",
          reemplazo_motivo: null,
        })),
      ],
    }),
    HASTA
  ).pendientes;
  assert.equal(dos.length, 1);
  assert.equal(dos[0].clases, 2, "el conteo sí baja");
  assert.equal(dos[0].base, 400, "pero la base es la misma: es mono-curso");
});

// ── 3. Multi-curso: prorrateo, y las partes suman lo cobrado (regla 10) ──

test("3. multi-curso: reparte por (clases × precio de una clase) y suma exacto", () => {
  const d = datos({
    membresias: [membresia(1)],
    cursosDeMembresia: [
      { inscripcion_id: 1, curso_id: 1, dias: [1], fecha: null }, // 4 lunes
      { inscripcion_id: 1, curso_id: 2, dias: [3], fecha: null }, // 3 miércoles
    ],
    cuotas: [{ id: 1, inscripcion_id: 1, monto_devengado: 800, descuento_adelanto: 0 }],
    pagos: [{ cuota_id: 1, monto: 800, descuento: 0 }],
    sesiones: [...dictadas(1, LUNES), ...dictadas(2, MIERCOLES)],
    cursos: [curso(1, "Salsa", [1]), curso(2, "Bachata", [3])],
    tarifas: [
      { curso_id: 1, modalidad: "clase", precio: 50 },
      { curso_id: 2, modalidad: "clase", precio: 50 },
    ],
    asignaciones: [
      { id: 1, curso_id: 1, profesor_id: 1, pct_ingresos: 50, desde: "2026-01-01", hasta: null },
      { id: 2, curso_id: 2, profesor_id: 2, pct_ingresos: 50, desde: "2026-01-01", hasta: null },
    ],
  });
  const p = calcularDevengos(d, HASTA).pendientes;
  assert.equal(p.length, 2);

  // Pesos: Salsa 4×50 = 200, Bachata 3×50 = 150. Total 350.
  const salsa = p.find((x) => x.cursoId === 1)!;
  const bachata = p.find((x) => x.cursoId === 2)!;
  // 80000 × 200/350 = 45714,28… → 45714 ; 80000 × 150/350 = 34285,71… → 34285
  // Sobra 1 centavo y va al de mayor peso (Salsa).
  assert.equal(salsa.base, 457.15);
  assert.equal(bachata.base, 342.85);
  assert.equal(
    Math.round((salsa.base + bachata.base) * 100) / 100,
    800,
    "las partes suman exactamente lo cobrado"
  );
});

// ── 4. Calendario menos suspendidas (reglas 10 y 4) ──────────────────────

test("4. una suspendida no cuenta; una falta sí — la clase ocurrió", () => {
  // Una falta es una asistencia 'ausente' sobre una sesión que igual se
  // dictó: para el conteo, la sesión sigue siendo dictada.
  const conFalta = calcularDevengos(datos(), HASTA).pendientes[0];
  assert.equal(conFalta.clases, 4);

  const conSuspendida = calcularDevengos(
    datos({
      sesiones: [
        ...dictadas(1, LUNES.slice(0, 3)),
        { curso_id: 1, fecha: LUNES[3], estado: "suspendida", reemplazo_motivo: null },
      ],
    }),
    HASTA
  ).pendientes[0];
  assert.equal(conSuspendida.clases, 3);
});

// ── 5. La comisión es de quien dictó (regla 10) ──────────────────────────

test("5. cambio de titular a mitad de ciclo: dos líneas, cada una con sus clases", () => {
  const p = calcularDevengos(
    datos({
      asignaciones: [
        { id: 1, curso_id: 1, profesor_id: 1, pct_ingresos: 50, desde: "2026-01-01", hasta: "2026-08-12" },
        { id: 2, curso_id: 1, profesor_id: 2, pct_ingresos: 50, desde: "2026-08-13", hasta: null },
      ],
    }),
    HASTA
  ).pendientes;

  assert.equal(p.length, 2, "el curso deja dos líneas, una por profesor");
  const anterior = p.find((x) => x.profesorId === 1)!;
  const nuevo = p.find((x) => x.profesorId === 2)!;
  assert.equal(anterior.clases, 2); // 3 y 10 de agosto
  assert.equal(nuevo.clases, 2); //    17 y 24
  assert.equal(anterior.base, 200);
  assert.equal(nuevo.base, 200);
  assert.equal(anterior.base + nuevo.base, 400, "entre los dos se llevan el curso entero");
});

// ── 6. Reemplazo administrativo: esa clase no es de nadie (regla 20b) ────

test("6. reemplazo administrativo: la clase cuenta, pero su parte queda para Tropicana", () => {
  const r = calcularDevengos(
    datos({
      sesiones: [
        ...dictadas(1, LUNES.slice(0, 3)),
        { curso_id: 1, fecha: LUNES[3], estado: "dictada", reemplazo_motivo: "administrativo" },
      ],
    }),
    HASTA
  );
  const p = r.pendientes[0];
  assert.equal(p.clasesDelCurso, 4, "la clase se dictó: cuenta para el peso del curso");
  assert.equal(p.clases, 3, "pero no es del titular");
  assert.equal(p.base, 300, "cobra 3 de las 4 partes");

  const linea = p.reparto.find((l) => l.cursoId === 1)!;
  assert.equal(linea.sinAsignar, 1);
  assert.equal(linea.parteSinAsignar, 100, "los otros 100 quedan para Tropicana");
});

// ── 7. Reemplazo atribuible al titular: la clase le cuenta (regla 20a) ───

test("7. reemplazo del titular: la clase le cuenta y la cobra entera", () => {
  const p = calcularDevengos(
    datos({
      sesiones: [
        ...dictadas(1, LUNES.slice(0, 3)),
        { curso_id: 1, fecha: LUNES[3], estado: "dictada", reemplazo_motivo: "titular" },
      ],
    }),
    HASTA
  ).pendientes[0];
  assert.equal(p.clases, 4, "no se le descuenta del conteo");
  assert.equal(p.base, 400, "cobra el curso entero; el costo del suplente es un descuento aparte");
});

// ── 8. Registrar es imperativo, pero solo donde hay prorrateo (regla 17) ─

test("8. una clase sin registrar bloquea multi-curso, no bloquea mono-curso", () => {
  // Mono-curso con una clase sin sesión: se liquida igual, su número no cambia.
  const mono = calcularDevengos(datos({ sesiones: dictadas(1, LUNES.slice(0, 3)) }), HASTA);
  assert.equal(mono.bloqueadas.length, 0);
  assert.equal(mono.pendientes.length, 1);
  assert.equal(mono.pendientes[0].base, 400);

  // Multi-curso con una clase sin sesión: espera.
  const multi = calcularDevengos(
    datos({
      cursosDeMembresia: [
        { inscripcion_id: 1, curso_id: 1, dias: [1], fecha: null },
        { inscripcion_id: 1, curso_id: 2, dias: [3], fecha: null },
      ],
      sesiones: [...dictadas(1, LUNES), ...dictadas(2, MIERCOLES.slice(0, 2))],
      cursos: [curso(1, "Salsa", [1]), curso(2, "Bachata", [3])],
      tarifas: [
        { curso_id: 1, modalidad: "clase", precio: 50 },
        { curso_id: 2, modalidad: "clase", precio: 50 },
      ],
      asignaciones: [
        { id: 1, curso_id: 1, profesor_id: 1, pct_ingresos: 50, desde: "2026-01-01", hasta: null },
        { id: 2, curso_id: 2, profesor_id: 2, pct_ingresos: 50, desde: "2026-01-01", hasta: null },
      ],
    }),
    HASTA
  );
  assert.equal(multi.pendientes.length, 0, "la membresía entera espera");
  assert.equal(multi.bloqueadas.length, 1);
  assert.deepEqual(multi.bloqueadas[0].cursos[0].fechas, ["2026-08-19"]);
});

// ── 9. La vigencia del curso acota el calendario (0033) ──────────────────

test("9. fuera de la vigencia del curso no hay clase que contar", () => {
  const p = calcularDevengos(
    datos({ cursos: [curso(1, "Salsa", [1], { vigente_desde: "2026-08-11" })] }),
    HASTA
  ).pendientes[0];
  assert.equal(p.clases, 2, "solo los lunes 17 y 24: antes el curso no corría");
});

// ── 10. La prueba es el caso general con 1 clase por curso (regla 11) ────

test("10. prueba grupal: una clase por curso, y el peso escala por personas", () => {
  const r = calcularDevengos(
    datos({
      membresias: [
        membresia(1, {
          es_prueba: true,
          acompanantes: 1, // titular + 1 = 2 personas
          fecha_inicio: "2026-08-03",
          fecha_fin: "2026-08-05",
        }),
      ],
      cursosDeMembresia: [
        { inscripcion_id: 1, curso_id: 1, dias: null, fecha: "2026-08-03" },
        { inscripcion_id: 1, curso_id: 2, dias: null, fecha: "2026-08-05" },
      ],
      cuotas: [{ id: 1, inscripcion_id: 1, monto_devengado: 120, descuento_adelanto: 0 }],
      pagos: [{ cuota_id: 1, monto: 120, descuento: 0 }],
      sesiones: [...dictadas(1, ["2026-08-03"]), ...dictadas(2, ["2026-08-05"])],
      cursos: [curso(1, "Salsa", [1]), curso(2, "Bachata", [3])],
      tarifas: [
        { curso_id: 1, modalidad: "prueba", precio: 30 },
        { curso_id: 2, modalidad: "prueba", precio: 30 },
      ],
      asignaciones: [
        { id: 1, curso_id: 1, profesor_id: 1, pct_ingresos: 50, desde: "2026-01-01", hasta: null },
        { id: 2, curso_id: 2, profesor_id: 2, pct_ingresos: 50, desde: "2026-01-01", hasta: null },
      ],
    }),
    HASTA
  );
  assert.equal(r.pendientes.length, 2);
  for (const p of r.pendientes) {
    assert.equal(p.clases, 1, "una sola clase por curso");
    assert.equal(p.personas, 2);
    assert.equal(p.base, 60, "los dos cursos pesan igual: 120 ÷ 2");
  }
});

// ── 11. Agregar una membresía no toca lo ya repartido (regla 16b) ────────

test("11. una membresía retroactiva devenga la suya y no mueve la de otro alumno", () => {
  const r = calcularDevengos(
    datos({
      membresias: [membresia(1), membresia(2, { alumno_id: 2 })],
      cursosDeMembresia: [
        { inscripcion_id: 1, curso_id: 1, dias: [1], fecha: null },
        { inscripcion_id: 2, curso_id: 1, dias: [1], fecha: null },
      ],
      cuotas: [
        { id: 1, inscripcion_id: 1, monto_devengado: 400, descuento_adelanto: 0 },
        { id: 2, inscripcion_id: 2, monto_devengado: 400, descuento_adelanto: 0 },
      ],
      pagos: [
        { cuota_id: 1, monto: 400, descuento: 0 },
        { cuota_id: 2, monto: 400, descuento: 0 },
      ],
      // La #1 ya se liquidó y se pagó; la #2 es la que se inscribió tarde.
      comisionesPrevias: [
        {
          id: 10,
          membresia_id: 1,
          curso_id: 1,
          profesor_id: 1,
          base: 400,
          monto: 200,
          tipo: "comision",
          periodo: "2026-08-01",
        },
      ],
      alumnos: [
        { id: 1, nombre: "Ana", apellido: "Pérez" },
        { id: 2, nombre: "Luis", apellido: "Gómez" },
      ],
    }),
    HASTA
  );
  assert.equal(r.pendientes.length, 1, "solo devenga la nueva");
  assert.equal(r.pendientes[0].membresiaId, 2);
  assert.equal(r.pendientes[0].base, 400, "con su propia plata, entera");
});

// ── 12. El delta: lo que todavía NO existe ───────────────────────────────

/** La comisión original de la membresía 1, curso 1, profesor 1: 400 base / 200 monto. */
const YA_DEVENGADO = [
  {
    id: 10,
    membresia_id: 1,
    curso_id: 1,
    profesor_id: 1,
    base: 400,
    monto: 200,
    tipo: "comision",
    periodo: "2026-08-01",
  },
];

test("12. si el reparto de una membresía ya devengada cambia, se emite el delta", () => {
  // La membresía se liquidó cuando el curso figuraba con 4 clases y el
  // profesor se llevó 400. Después se registró tarde una clase con reemplazo
  // administrativo: su parte ya no es de él, le corresponden 300.
  const r = calcularDevengos(
    datos({
      comisionesPrevias: YA_DEVENGADO,
      sesiones: [
        ...dictadas(1, LUNES.slice(0, 3)),
        { curso_id: 1, fecha: LUNES[3], estado: "dictada", reemplazo_motivo: "administrativo" },
      ],
    }),
    HASTA
  );
  assert.equal(r.pendientes.length, 1, "tiene que emitir el ajuste");
  const a = r.pendientes[0];
  assert.equal(a.tipo, "ajuste");
  assert.equal(a.base, -100, "le correspondían 300 y ya tenía 400");
  assert.equal(a.monto, -50, "el 50% de esos 100");
  assert.equal(a.periodo, "2026-08-01", "va al período de la comisión original, como complemento");
  assert.equal(a.ajustaComisionId, 10, "y deja la traza de a cuál corrige");
});

test("12.b nada que ajustar cuando el recálculo da lo mismo", () => {
  const r = calcularDevengos(datos({ comisionesPrevias: YA_DEVENGADO }), HASTA);
  assert.deepEqual(r.pendientes, [], "no se emite un ajuste de cero");
});

test("12.c el delta también corrige hacia arriba", () => {
  // Se habia liquidado con 400 de base; ahora al curso le corresponde mas
  // porque el otro curso del plan dejo de poner clases.
  const r = calcularDevengos(
    datos({
      comisionesPrevias: [{ ...YA_DEVENGADO[0], base: 300, monto: 150 }],
    }),
    HASTA
  );
  assert.equal(r.pendientes.length, 1);
  assert.equal(r.pendientes[0].tipo, "ajuste");
  assert.equal(r.pendientes[0].base, 100, "le faltaban 100");
  assert.equal(r.pendientes[0].monto, 50);
});

test("12.d un cambio de titular sobre lo ya devengado no paga el curso dos veces", () => {
  // El caso que el tope viejo resolvia dejando al segundo profesor sin cobrar:
  // una comision vieja se llevo el curso entero y despues el calculo dice que
  // lo dictaron dos. Ahora al primero le sale el ajuste hacia abajo y al
  // segundo su comision — y el curso sigue sumando lo mismo.
  const r = calcularDevengos(
    datos({
      comisionesPrevias: YA_DEVENGADO,
      asignaciones: [
        { id: 1, curso_id: 1, profesor_id: 1, pct_ingresos: 50, desde: "2026-01-01", hasta: "2026-08-12" },
        { id: 2, curso_id: 1, profesor_id: 2, pct_ingresos: 50, desde: "2026-08-13", hasta: null },
      ],
    }),
    HASTA
  );
  assert.equal(r.pendientes.length, 2);
  const uno = r.pendientes.find((p) => p.profesorId === 1)!;
  const dos = r.pendientes.find((p) => p.profesorId === 2)!;
  assert.equal(uno.tipo, "ajuste");
  assert.equal(uno.base, -200, "se queda con la mitad que sí dictó");
  assert.equal(dos.tipo, "comision");
  assert.equal(dos.base, 200);
  assert.equal(
    400 + uno.base + dos.base,
    400,
    "el curso sigue repartiendo exactamente lo mismo que ya se habia devengado"
  );
});
