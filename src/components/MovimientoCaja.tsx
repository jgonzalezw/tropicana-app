"use client";

import { useMemo, useState } from "react";
import Cobro, { type PayloadCobro } from "@/components/Cobro";
import Toggle from "@/components/Toggle";
import { gs, isoFecha } from "@/lib/inscripcion";
import {
  bucketDeMotivo,
  etiquetaMotivo,
  NOMBRE_BUCKET,
  politicaDeMotivo,
  type ContextoMovimiento,
  type Direccion,
  type EntradaMovimiento,
  type LineaPendiente,
} from "@/lib/caja";

/**
 * Registrar un movimiento de caja (`Caja y resumen.dc.html`, "Movimiento de
 * caja"). Se llega de dos maneras y las dos terminan acá:
 *
 *  - **Desde la operación** (inscripción, estado de cuenta de un alumno o
 *    profesor): llega con `contexto` ya resuelto y va directo al cobro, sin
 *    volver a preguntar qué se cobra ni a quién.
 *  - **Desde Caja**: se navega hasta la deuda — dirección, motivo y titular.
 *
 * La plata siempre la maneja el paso `Cobro` compartido, montado con el saldo
 * de la línea elegida: cobrarle la cuota a un alumno y pagarle la comisión a un
 * profesor se ven y se comportan igual, y ninguna se puede hacer sin ver lo que
 * se debe.
 */
export default function MovimientoCaja({
  motivosIngreso,
  motivosEgreso,
  lineas,
  medios,
  diasCompromiso,
  contexto,
  onGuardar,
  onCancelar,
}: {
  motivosIngreso: string[];
  motivosEgreso: string[];
  lineas: LineaPendiente[];
  medios: string[];
  /** Parámetro `dias_compromiso_pago`: tope de días para la fecha de compromiso. */
  diasCompromiso: number;
  /** Si viene, el movimiento arranca resuelto y no se navega. */
  contexto?: ContextoMovimiento;
  onGuardar: (m: EntradaMovimiento) => Promise<{ ok?: true; error?: string; resumen?: string }>;
  onCancelar?: () => void;
}) {
  const fijo = contexto != null;
  const [direccion, setDireccion] = useState<Direccion>(contexto?.direccion ?? "ingreso");
  const [motivo, setMotivo] = useState<string>(
    contexto?.motivo ?? motivosIngreso[0] ?? "otro"
  );
  const [claveLinea, setClaveLinea] = useState<string>(contexto?.linea.clave ?? "");
  const [glosa, setGlosa] = useState("");
  const [glosaTocada, setGlosaTocada] = useState(false);
  const [pago, setPago] = useState<PayloadCobro | null>(null);
  const [fechaCompromiso, setFechaCompromiso] = useState("");
  // Registro atrasado: la fecha solo cuenta si el toggle esta encendido, mismo
  // criterio que la inscripcion retroactiva de /inscribir (Toggle + fecha).
  const [retroActivo, setRetroActivo] = useState(false);
  const [fechaEfectiva, setFechaEfectiva] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Misma regla que la venta (/inscribir): si el cobro deja saldo en la cuota,
  // hace falta la fecha de compromiso de pago, con el mismo tope de días.
  const hoy = useMemo(() => new Date(), []);
  const maxCompromiso = useMemo(() => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    d.setDate(d.getDate() + Math.max(1, diasCompromiso));
    return d;
  }, [hoy, diasCompromiso]);
  const fechaCompromisoEfectiva = fechaCompromiso || isoFecha(maxCompromiso);

  const motivos = direccion === "ingreso" ? motivosIngreso : motivosEgreso;
  const bucket = bucketDeMotivo(motivo);
  const politica = politicaDeMotivo(motivo);

  const candidatas = useMemo(
    () => (bucket ? lineas.filter((l) => l.bucket === bucket) : []),
    [bucket, lineas]
  );
  const linea = fijo
    ? contexto!.linea
    : candidatas.find((l) => l.clave === claveLinea) ?? null;

  // pago.saldo ya es lo que queda en la cuota tras este movimiento (Cobro.tsx
  // calcula total = referencia − descuento, saldo = total − mueve): solo se
  // pide fecha de compromiso cuando hay una cuota real de por medio.
  const pideCompromiso = linea?.cuotaId != null && pago != null && pago.saldo > 0;

  function cambiarDireccion(d: Direccion) {
    setDireccion(d);
    setMotivo((d === "ingreso" ? motivosIngreso : motivosEgreso)[0] ?? "otro");
    setClaveLinea("");
    setFechaCompromiso("");
    setGlosaTocada(false);
    setError(null);
  }
  function cambiarMotivo(m: string) {
    setMotivo(m);
    setClaveLinea("");
    setFechaCompromiso("");
    setGlosaTocada(false);
    setError(null);
  }
  function cambiarLinea(clave: string) {
    setClaveLinea(clave);
    setFechaCompromiso("");
    setGlosaTocada(false);
    setError(null);
  }

  // La línea viva que explica el efecto exacto sobre el saldo de esa persona.
  const efecto = (() => {
    if (!bucket) return "Este motivo no descuenta ninguna deuda: solo mueve la caja.";
    if (!candidatas.length)
      return `No hay saldos abiertos en ${NOMBRE_BUCKET[bucket]}: el movimiento solo entra a la caja.`;
    if (!linea)
      return `Elegí el sujeto para descontar su saldo de ${NOMBRE_BUCKET[bucket]}.`;
    const mueve = pago ? pago.total - pago.saldo : 0;
    const queda = Math.max(0, linea.saldo - mueve);
    const desc = pago && pago.ajuste > 0 ? `, con ${gs(pago.ajuste)} de descuento` : "";
    return `${linea.sujeto} · ${linea.detalle}: ${gs(linea.saldo)} pendiente → queda ${gs(queda)}${
      queda === 0 ? " (saldo cerrado)" : ""
    }${desc}.`;
  })();

  // La glosa se sugiere sola con el mismo texto explicativo de arriba —
  // mientras el usuario no la toque a mano — porque el contexto ya deja claro
  // de qué se trata (Javier, 2026-09-10). Solo cuando hay una línea resuelta:
  // los mensajes "elegí el sujeto"/"no hay saldos" no son una glosa útil.
  // Patrón de "ajustar estado en render" (mismo que usa Cobro.tsx), sin efecto.
  const claveSugerencia = linea ? `${linea.clave}|${pago?.total ?? 0}|${pago?.saldo ?? 0}|${pago?.ajuste ?? 0}` : "";
  const [claveSugerenciaPrevia, setClaveSugerenciaPrevia] = useState(claveSugerencia);
  if (claveSugerenciaPrevia !== claveSugerencia) {
    setClaveSugerenciaPrevia(claveSugerencia);
    if (!glosaTocada && linea) setGlosa(efecto);
  }

  async function guardar() {
    setError(null);
    const mueve = pago ? pago.total - pago.saldo : 0;
    const descuento = pago?.ajuste ?? 0;
    // Validaciones en el orden del handoff.
    if (mueve + descuento <= 0) return setError("Escribí el monto del movimiento.");
    if (!glosa.trim()) return setError("Poné una glosa corta, para saber después de qué fue.");
    if (bucket && candidatas.length && !linea)
      return setError(
        direccion === "ingreso" ? "Elegí a quién se le cobra." : "Elegí a quién se le paga."
      );
    if (pago && !pago.valido)
      return setError("Revisá el monto, el medio de pago o el motivo del descuento.");
    if (pideCompromiso && !fechaCompromisoEfectiva)
      return setError("Cargá la fecha de compromiso de pago del saldo.");
    if (retroActivo && !fechaEfectiva)
      return setError("Cargá la fecha en que ocurrió el movimiento, o apagá el interruptor.");
    if (retroActivo && fechaEfectiva > isoFecha(hoy))
      return setError("La fecha en que ocurrió el movimiento no puede ser futura.");

    setGuardando(true);
    const res = await onGuardar({
      direccion,
      motivo,
      glosa: glosa.trim(),
      cuotaId: linea?.cuotaId ?? null,
      monto: mueve,
      medio: pago?.medio ?? null,
      notaMedio: pago?.notaMedio ?? "",
      descuento,
      descuentoMotivo: pago?.ajusteMotivo ?? "",
      fechaCompromiso: pideCompromiso ? fechaCompromisoEfectiva : null,
      fechaEfectiva: retroActivo ? fechaEfectiva : null,
    });
    setGuardando(false);
    if (res.error) return setError(res.error);
    setAviso(res.resumen ?? "Movimiento registrado.");
    setGlosa("");
    setGlosaTocada(false);
    setRetroActivo(false);
    setFechaEfectiva("");
    setPago(null);
    setFechaCompromiso("");
    if (!fijo) setClaveLinea("");
  }

  const etiquetaSujeto = direccion === "ingreso" ? "¿A quién se le cobra?" : "¿A quién se le paga?";
  const referenciaLabel = direccion === "ingreso" ? "Saldo pendiente" : "Saldo a pagar";

  return (
    <div className="rounded-[var(--radio-tarjeta)] bg-[var(--fondo-elevado)] border border-[var(--borde)] p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="titulo text-2xl">Movimiento de caja</h2>
        {onCancelar && (
          <button onClick={onCancelar} className="text-sm text-[var(--texto-tenue)]">
            Cancelar
          </button>
        )}
      </div>

      {aviso && (
        <div className="rounded-[var(--radio-panel)] bg-[var(--exito-fill)] text-[var(--exito-texto)] p-4 text-base">
          {aviso}
        </div>
      )}

      {fijo ? (
        <div className="rounded-[var(--radio-panel)] border border-[var(--borde)] p-4">
          <div className="text-sm text-[var(--texto-tenue)]">
            {direccion === "ingreso" ? "Cobro" : "Pago"} · {etiquetaMotivo(motivo)}
          </div>
          <div className="text-lg font-semibold mt-0.5">{contexto!.linea.sujeto}</div>
          <div className="text-sm text-[var(--texto-tenue)]">{contexto!.linea.detalle}</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <span className="block text-base font-medium mb-1.5">¿Entra o sale?</span>
            <div className="flex gap-2">
              {(["ingreso", "egreso"] as Direccion[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => cambiarDireccion(d)}
                  className={`flex-1 px-4 py-2.5 text-base rounded-[var(--radio-control)] border ${
                    direccion === d
                      ? "bg-[var(--primario)] text-[var(--primario-texto)] border-[var(--primario)] font-semibold"
                      : "border-[var(--borde)] hover:border-[var(--primario)]"
                  }`}
                >
                  {d === "ingreso" ? "Ingreso" : "Egreso"}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="block text-base font-medium mb-1.5">Motivo</span>
            <select value={motivo} onChange={(e) => cambiarMotivo(e.target.value)} className="entrada">
              {motivos.map((m) => (
                <option key={m} value={m}>
                  {etiquetaMotivo(m)}
                </option>
              ))}
            </select>
          </label>

          {bucket && candidatas.length > 0 && (
            <label className="block sm:col-span-2">
              <span className="block text-base font-medium mb-1.5">{etiquetaSujeto}</span>
              <select
                value={claveLinea}
                onChange={(e) => cambiarLinea(e.target.value)}
                className="entrada"
              >
                <option value="">
                  {direccion === "ingreso" ? "Elegí el deudor" : "Elegí el acreedor"}
                </option>
                {candidatas.map((l) => (
                  <option key={l.clave} value={l.clave}>
                    {l.sujeto} · {l.detalle} · debe {gs(l.saldo)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      <label className="block">
        <span className="block text-base font-medium mb-1.5">Glosa (detalle)</span>
        <input
          value={glosa}
          onChange={(e) => {
            setGlosa(e.target.value);
            setGlosaTocada(true);
          }}
          placeholder="ej. cuota de agosto de Virginia Martínez"
          className="entrada"
        />
      </label>

      <div className="space-y-2">
        <Toggle
          checked={retroActivo}
          onChange={(v) => {
            setRetroActivo(v);
            if (!v) setFechaEfectiva("");
            setError(null);
          }}
          label="Ocurrió en fecha pasada"
          descripcion="Se registra igual como movimiento de hoy (para el arqueo); la fecha es para saber cuándo pasó de verdad."
        />
        {retroActivo && (
          <label className="block max-w-[220px]">
            <span className="block text-base font-medium mb-1.5">¿Cuándo ocurrió?</span>
            <input
              type="date"
              value={fechaEfectiva}
              max={isoFecha(hoy)}
              onChange={(e) => {
                setFechaEfectiva(e.target.value);
                setError(null);
              }}
              className="entrada"
            />
          </label>
        )}
      </div>

      <div className="rounded-[var(--radio-panel)] border border-[var(--borde)] bg-[var(--fondo-panel)] p-4">
        <Cobro
          sujeto={linea?.sujeto}
          detalle={linea?.detalle}
          referencia={linea?.saldo ?? 0}
          referenciaLabel={referenciaLabel}
          politica={politica}
          direccion={direccion === "ingreso" ? "cobro" : "pago"}
          medios={medios}
          permitirSinCobro={false}
          cuentaId={linea?.clave ?? `suelto:${direccion}:${motivo}`}
          onChange={setPago}
        />

        {pideCompromiso && (
          <div className="pt-3 mt-3 border-t border-[var(--borde)]">
            <label className="text-sm text-[var(--texto-tenue)] block mb-1.5">
              Fecha de compromiso de pago del saldo
            </label>
            <input
              type="date"
              value={fechaCompromisoEfectiva}
              min={isoFecha(hoy)}
              max={isoFecha(maxCompromiso)}
              onChange={(e) => {
                setFechaCompromiso(e.target.value);
                setError(null);
              }}
              className="entrada max-w-[200px]"
            />
            <p className="text-sm text-[var(--texto-tenue)] mt-1.5">
              Queda saldo pendiente. Debe pagarse a más tardar esta fecha (máx. {diasCompromiso} días
              desde hoy).
            </p>
          </div>
        )}
      </div>

      <p className="text-sm text-[var(--primario-hover)]">{efecto}</p>

      {error && (
        <p className="text-[var(--peligro)] text-base" role="alert">
          {error}
        </p>
      )}

      <button
        onClick={guardar}
        disabled={guardando}
        className="w-full px-5 py-3 text-lg font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] hover:bg-[var(--primario-hover)] disabled:opacity-40"
      >
        {guardando ? "Guardando…" : "Guardar movimiento"}
      </button>
    </div>
  );
}
