import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tienePermiso } from "@/lib/sesion";
import { estadoDeCuenta } from "@/lib/cuentas";
import { gs } from "@/lib/inscripcion";
import SinAcceso from "@/components/SinAcceso";
import ImprimirCuenta from "./ImprimirCuenta";
import type { CuotaCuenta, MembresiaCuenta } from "@/lib/tipos";

export const dynamic = "force-dynamic";

/**
 * El estado de cuenta de un alumno: qué compró, qué consumió, qué pagó y qué
 * debe, en un solo lugar. Es la contracara de Caja — allá se ve la deuda de
 * toda la escuela, acá la de una persona — y usa la misma pieza de datos
 * (`estadoDeCuenta`), para que las dos digan lo mismo.
 *
 * Cada cuota con saldo enlaza al cobro ya apuntado a esa deuda, y cada pago a
 * su recibo: desde acá se cierra el circuito sin volver a buscar nada.
 */
export default async function PaginaCuenta({ params }: { params: Promise<{ id: string }> }) {
  if (!(await tienePermiso("alumnos", "ver"))) return <SinAcceso />;

  const { id } = await params;
  const alumnoId = Number(id);
  if (!Number.isFinite(alumnoId)) notFound();

  const sb = await createClient();
  const cuenta = await estadoDeCuenta(sb, alumnoId);
  if (!cuenta) notFound();

  const puedeCobrar = await tienePermiso("caja", "crear");
  const { alumno, membresias, pagos, deuda } = cuenta;

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto pb-20">
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/alumnos" className="text-[var(--primario)] text-base">
            ← Volver a Alumnos
          </Link>
          <h1 className="text-3xl mt-2">
            {alumno.apellido}, {alumno.nombre}
          </h1>
          <p className="text-base text-[var(--texto-tenue)] mt-1">
            Estado de cuenta: qué compró, qué consumió y qué debe.
          </p>
        </div>
        <ImprimirCuenta datos={cuenta} />
      </div>

      {/* Lo primero que se busca al abrir esta pantalla. */}
      <div className="rounded-[var(--radio-tarjeta)] bg-[var(--fondo-panel)] border border-[var(--borde)] p-6 mb-4">
        <div className="text-sm uppercase tracking-wider text-[var(--primario)] font-semibold">
          Deuda total
        </div>
        <div
          className={`titulo text-5xl mt-1 tabular-nums ${
            deuda > 0 ? "text-[var(--peligro)]" : ""
          }`}
        >
          {gs(deuda)}
        </div>
        {deuda === 0 && (
          <p className="text-base text-[var(--texto-tenue)] mt-1">Está al día.</p>
        )}
      </div>

      <section className="mb-4">
        <h2 className="titulo text-xl mb-2">Membresías</h2>
        {membresias.length === 0 ? (
          <p className="text-base text-[var(--texto-tenue)]">Todavía no compró ninguna.</p>
        ) : (
          <div className="space-y-3">
            {membresias.map((m) => (
              <Membresia key={m.id} m={m} puedeCobrar={puedeCobrar} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[var(--radio-tarjeta)] bg-[var(--fondo-panel)] border border-[var(--borde)] p-5">
        <h2 className="titulo text-xl mb-3">Pagos</h2>
        {pagos.length === 0 ? (
          <p className="text-base text-[var(--texto-tenue)]">Todavía no registró ningún pago.</p>
        ) : (
          <ul className="divide-y divide-[var(--borde)]">
            {pagos.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/caja/recibo/${p.id}`}
                  className="block py-2.5 px-2 -mx-2 rounded-[var(--radio-control)] hover:bg-[var(--fondo-elevado)]"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 text-base font-medium truncate">
                      {p.concepto ?? "Pago"}
                    </span>
                    <span className="shrink-0 text-base tabular-nums text-[var(--exito)]">
                      {gs(p.monto)}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--texto-tenue)] mt-0.5">
                    {[
                      fechaCorta(p.fecha),
                      p.descuento > 0
                        ? `${gs(p.descuento)} de descuento${
                            p.descuentoMotivo ? ` (${p.descuentoMotivo})` : ""
                          }`
                        : null,
                      p.monto > 0 ? p.medio : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    {" · ver recibo"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Membresia({ m, puedeCobrar }: { m: MembresiaCuenta; puedeCobrar: boolean }) {
  const consumo = m.progreso
    ? `${m.progreso.hechas}/${m.progreso.total} clases`
    : m.restantes != null
    ? `${m.restantes} ${m.restantes === 1 ? "clase" : "clases"} por usar`
    : "Sin límite de clases";
  const faltas = [
    m.faltasSinLicencia > 0
      ? `${m.faltasSinLicencia} sin licencia`
      : null,
    m.faltasConLicencia > 0 ? `${m.faltasConLicencia} con licencia` : null,
  ].filter(Boolean);

  return (
    <div className="rounded-[var(--radio-tarjeta)] bg-[var(--fondo-panel)] border border-[var(--borde)] p-5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-lg font-semibold">{m.plan ?? m.curso ?? "Membresía"}</div>
          <div className="text-sm text-[var(--texto-tenue)]">
            {[m.curso, `${fechaCorta(m.fechaInicio)} → ${fechaCorta(m.fechaFin)}`]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
        <span className="text-sm px-3 py-1 rounded-[var(--radio-control)] bg-[var(--fondo-elevado)]">
          {m.estado}
        </span>
      </div>

      <div className="text-sm text-[var(--texto-tenue)] mt-2">
        {consumo}
        {faltas.length > 0 ? ` · faltas: ${faltas.join(", ")}` : ""}
        {m.bono > 0 ? ` · ${m.bono} de bono de tolerancia por usar` : ""}
      </div>

      <ul className="divide-y divide-[var(--borde)] mt-3 border-t border-[var(--borde)]">
        {m.cuotas.map((c) => (
          <Cuota key={c.id} c={c} puedeCobrar={puedeCobrar} />
        ))}
      </ul>
    </div>
  );
}

function Cuota({ c, puedeCobrar }: { c: CuotaCuenta; puedeCobrar: boolean }) {
  const limite = c.fechaCompromiso ?? c.vencimiento;
  const detalle = [
    `Vale ${gs(c.devengado)}`,
    c.cubierto > 0 ? `cubierto ${gs(c.cubierto)}` : null,
    limite ? `${c.saldo > 0 ? "vence" : "vencía"} el ${fechaCorta(limite)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const fila = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-base truncate">
          {periodoLargo(c.periodo)}
          <span className="text-sm text-[var(--texto-tenue)]"> · {c.estado}</span>
        </span>
        <span
          className={`shrink-0 text-base tabular-nums ${
            c.saldo > 0 ? "text-[var(--peligro)]" : "text-[var(--texto-tenue)]"
          }`}
        >
          {gs(c.saldo)}
        </span>
      </div>
      <p className="text-sm text-[var(--texto-tenue)] mt-0.5">
        {detalle}
        {c.saldo > 0 && puedeCobrar ? " · cobrar" : ""}
      </p>
    </>
  );

  return (
    <li>
      {c.saldo > 0 && puedeCobrar ? (
        <Link
          href={`/caja?linea=cuota:${c.id}`}
          className="block py-2.5 px-2 -mx-2 rounded-[var(--radio-control)] hover:bg-[var(--fondo-elevado)]"
        >
          {fila}
        </Link>
      ) : (
        <div className="py-2.5">{fila}</div>
      )}
    </li>
  );
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function fechaCorta(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00" : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function periodoLargo(iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  return m ? `${MESES[Number(m[2]) - 1]} ${m[1]}` : iso;
}
