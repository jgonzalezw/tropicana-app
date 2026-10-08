/**
 * Simulación del cierre del período en curso (D29, I-005) — capa pura.
 *
 * No toca el motor: transforma las filas que el motor lee para que «parezca»
 * que el período ya cerró, y el mismo `calcularDevengos` / `calcularDevengosParticulares`
 * calcula la proyección. Así la simulación no puede discrepar del cálculo real.
 *
 * Qué simula:
 *  - Una membresía **activa** cuyo fin cae dentro del período y que está
 *    cobrada al 100 % pasa a `completada`.
 *  - Las clases **futuras** del período (después de hoy) que nadie registró
 *    cuentan como dictadas, para que no traben la regla 17.
 *  - En particulares, las reservas futuras `confirmada`/`reprogramada` del
 *    período cuentan como dadas.
 *
 * Límites que se declaran (LIMITES_SIMULACION): una suspensión futura no se
 * puede prever; las ilimitadas cuentan solo lo asistido y se subestiman; el
 * saldo es el de hoy.
 */
import { clasesDelCiclo, type DatosMotor, type SesionLiq } from "./motor.ts";
import { cobroPorMembresia } from "./cobro.ts";
import type { DatosParticulares } from "./particulares.ts";

export const LIMITES_SIMULACION = [
  "Una suspensión futura no se puede prever: las clases del resto del período se cuentan como dictadas.",
  "Las membresías ilimitadas cuentan solo lo asistido hasta hoy, así que se subestiman.",
  "El saldo y lo cobrado son los de hoy: lo que se cobre después no está.",
  "Los reemplazos que se dicten de acá al cierre no están en la liquidez.",
] as const;

const EPS = 0.005;

export function simularCierre(datos: DatosMotor, hoyISO: string, finPeriodoISO: string): DatosMotor {
  const { saldo } = cobroPorMembresia(datos.cuotas, datos.pagos);

  const membresias = datos.membresias.map((m) =>
    m.estado === "activa" &&
    m.fecha_fin != null &&
    m.fecha_fin <= finPeriodoISO &&
    (saldo[m.id] ?? 0) <= EPS
      ? { ...m, estado: "completada" }
      : m
  );

  // Clases futuras sin registrar → sesiones dictadas sintéticas.
  const suspendidas = new Set(
    datos.sesiones.filter((s) => s.estado === "suspendida").map((s) => `${s.curso_id}|${s.fecha}`)
  );
  const registradas = new Set(datos.sesiones.map((s) => `${s.curso_id}|${s.fecha}`));
  const cursoPorId = new Map(datos.cursos.map((c) => [c.id, c]));
  const porMembresia = new Map<number, typeof datos.cursosDeMembresia>();
  for (const r of datos.cursosDeMembresia) {
    const ya = porMembresia.get(r.membresia_id);
    if (ya) ya.push(r);
    else porMembresia.set(r.membresia_id, [r]);
  }

  const nuevas: SesionLiq[] = [];
  const vistas = new Set<string>();
  for (const m of membresias) {
    const propios = porMembresia.get(m.id) ?? [
      { membresia_id: m.id, curso_id: m.curso_id, dias: null, fecha: null },
    ];
    for (const ic of propios) {
      const { faltan } = clasesDelCiclo(ic, m, cursoPorId.get(ic.curso_id), suspendidas, registradas);
      for (const f of faltan) {
        if (f <= hoyISO || f > finPeriodoISO) continue; // lo pasado sin registrar sigue trabando: es real
        const k = `${ic.curso_id}|${f}`;
        if (vistas.has(k)) continue;
        vistas.add(k);
        nuevas.push({ curso_id: ic.curso_id, fecha: f, estado: "dictada", reemplazo_motivo: null });
      }
    }
  }

  return { ...datos, membresias, sesiones: [...datos.sesiones, ...nuevas] };
}

export function simularParticulares(
  datos: DatosParticulares,
  hoyISO: string,
  finPeriodoISO: string
): DatosParticulares {
  const reservas = datos.reservas.map((r) =>
    r.fecha > hoyISO &&
    r.fecha <= finPeriodoISO &&
    (r.estado === "confirmada" || r.estado === "reprogramada")
      ? { ...r, estado: "realizada" }
      : r
  );
  return { ...datos, reservas };
}
