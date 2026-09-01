"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type Politica = "descuento" | "ajuste" | "simple";
export type Direccion = "cobro" | "pago";
export type ModoCobro = "entero" | "parcial" | "sin";

export type PayloadCobro = {
  cuentaId: string;
  modo: ModoCobro;
  monto: number;
  medio: string | null;
  notaMedio: string;
  ajuste: number;
  ajusteMotivo: string;
  referencia: number;
  total: number;
  saldo: number;
  valido: boolean;
};

/**
 * Paso compartido de cobro/pago (Cobro.dc.html). Toma la referencia y decide
 * cuánto se mueve, por qué medio, con qué descuento/ajuste, y qué queda. No
 * persiste nada: emite su decisión por `onChange` y el host la guarda.
 *
 *   total = max(0, referencia − ajuste)
 *   mueve = modo 'sin' ? 0 : modo 'entero' ? total : monto
 *   saldo = max(0, total − mueve)
 */
export default function Cobro({
  sujeto,
  detalle,
  referencia,
  referenciaLabel = "Referencia",
  politica,
  direccion,
  medios,
  permitirSinCobro = true,
  cuentaId,
  onChange,
}: {
  sujeto?: string;
  detalle?: string;
  referencia: number;
  referenciaLabel?: string;
  politica: Politica;
  direccion: Direccion;
  medios: string[];
  permitirSinCobro?: boolean;
  cuentaId: string;
  onChange?: (p: PayloadCobro) => void;
}) {
  const sinReferencia = !(referencia > 0);
  const [modo, setModo] = useState<ModoCobro>(sinReferencia ? "parcial" : "entero");
  const [monto, setMonto] = useState("");
  const [medio, setMedio] = useState<string | null>(null);
  const [notaMedio, setNotaMedio] = useState("");
  const [descAbierto, setDescAbierto] = useState(false);
  const [ajuste, setAjuste] = useState("");
  const [ajusteMotivo, setAjusteMotivo] = useState("");

  // Cambiar de cuenta/referencia reinicia el paso. Patrón de "ajustar estado
  // en render" (React: You Might Not Need an Effect), no un efecto.
  const claveActual = `${cuentaId}|${referencia}`;
  const [claveReset, setClaveReset] = useState(claveActual);
  if (claveReset !== claveActual) {
    setClaveReset(claveActual);
    setModo(referencia > 0 ? "entero" : "parcial");
    setMonto("");
    setMedio(null);
    setNotaMedio("");
    setDescAbierto(false);
    setAjuste("");
    setAjusteMotivo("");
  }

  const parse = (s: string) => {
    const n = Number(s.replace(/[^\d.,]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const ajusteNum = politica === "simple" ? 0 : parse(ajuste);
  const total = Math.max(0, referencia - ajusteNum);
  const mueve = modo === "sin" ? 0 : modo === "entero" ? total : parse(monto);
  const saldo = Math.max(0, total - mueve);

  const esOtro = medio ? /otro/i.test(medio) : false;
  const valido = useMemo(() => {
    if (modo === "parcial" && parse(monto) <= 0) return false;
    if (modo !== "sin" && mueve > 0 && !medio) return false;
    if (ajusteNum > 0 && !ajusteMotivo.trim()) return false;
    return true;
  }, [modo, monto, mueve, medio, ajusteNum, ajusteMotivo]);

  // Emitir el payload al host sin causar loops (onChange en ref).
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    onChangeRef.current?.({
      cuentaId,
      modo,
      monto: parse(monto),
      medio,
      notaMedio,
      ajuste: ajusteNum,
      ajusteMotivo,
      referencia,
      total,
      saldo,
      valido,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuentaId, modo, monto, medio, notaMedio, ajuste, ajusteMotivo, referencia]);

  const etiquetasModo: Record<ModoCobro, string> =
    direccion === "cobro"
      ? { entero: "Cuota entera", parcial: "Otro monto", sin: "No cobra hoy" }
      : { entero: "Pago total", parcial: "Pago a cuenta", sin: "No paga hoy" };
  const labelMueve = direccion === "cobro" ? "Cobra hoy" : "Paga hoy";
  const labelAjuste = politica === "ajuste" ? "Registrar un ajuste" : "Aplicar un descuento";

  const fmt = (n: number) => `Bs. ${n}`;

  return (
    <div className="space-y-4">
      {sujeto && (
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold">{sujeto}</div>
            {detalle && <div className="text-sm text-[var(--texto-tenue)]">{detalle}</div>}
          </div>
          <div className="text-right">
            <div className="text-sm text-[var(--texto-tenue)]">{referenciaLabel}</div>
            <div className="titulo text-2xl">{fmt(referencia)}</div>
          </div>
        </div>
      )}

      {!sinReferencia && (
        <div className="flex flex-wrap gap-2">
          {(["entero", "parcial", ...(permitirSinCobro ? (["sin"] as const) : [])] as ModoCobro[]).map(
            (m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModo(m)}
                className={`flex-1 min-w-[110px] px-4 py-2.5 text-base rounded-[var(--radio-control)] border ${
                  modo === m
                    ? "bg-[var(--primario)] text-[var(--primario-texto)] border-[var(--primario)] font-semibold"
                    : "border-[var(--borde)] hover:border-[var(--primario)]"
                }`}
              >
                {etiquetasModo[m]}
              </button>
            )
          )}
        </div>
      )}

      {(modo === "parcial" || sinReferencia) && (
        <label className="block">
          <span className="block text-base font-medium mb-1.5">Monto (Bs.)</span>
          <input value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="decimal" className="entrada" />
        </label>
      )}

      {modo !== "sin" && (
        <div>
          <span className="block text-base font-medium mb-1.5">Medio de pago</span>
          <div className="flex flex-wrap gap-2">
            {medios.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMedio(m)}
                className={`px-4 py-2 text-sm rounded-[var(--radio-control)] border ${
                  medio === m
                    ? "bg-[var(--primario)] text-[var(--primario-texto)] border-[var(--primario)] font-semibold"
                    : "border-[var(--borde)] hover:border-[var(--primario)]"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          {esOtro && (
            <input
              value={notaMedio}
              onChange={(e) => setNotaMedio(e.target.value)}
              placeholder="Detalle del medio"
              className="entrada mt-2"
            />
          )}
        </div>
      )}

      {politica !== "simple" && (
        <div>
          {!descAbierto ? (
            <button type="button" onClick={() => setDescAbierto(true)} className="text-[var(--primario)] text-base">
              {labelAjuste}
            </button>
          ) : (
            <div className="p-4 rounded-[var(--radio-panel)] border border-[var(--borde)] bg-[var(--accent-100)] space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-sm font-medium mb-1">{labelAjuste} (Bs.)</span>
                  <input value={ajuste} onChange={(e) => setAjuste(e.target.value)} inputMode="decimal" className="entrada" />
                </label>
                <label className="block">
                  <span className="block text-sm font-medium mb-1">Motivo (obligatorio)</span>
                  <input value={ajusteMotivo} onChange={(e) => setAjusteMotivo(e.target.value)} className="entrada" />
                </label>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDescAbierto(false);
                  setAjuste("");
                  setAjusteMotivo("");
                }}
                className="text-sm text-[var(--texto-tenue)]"
              >
                Quitar
              </button>
            </div>
          )}
        </div>
      )}

      <div className="border-t border-[var(--borde)] pt-3 space-y-1">
        {ajusteNum > 0 && (
          <div className="flex justify-between text-[var(--exito-texto)]">
            <span>{labelAjuste}</span>
            <span>− {fmt(ajusteNum)}</span>
          </div>
        )}
        <div className="flex justify-between text-base">
          <span className="text-[var(--texto-tenue)]">{labelMueve}</span>
          <span className="titulo text-xl">{fmt(mueve)}</span>
        </div>
        <div className="flex justify-between text-sm text-[var(--texto-tenue)]">
          <span>Queda pendiente</span>
          <span>{fmt(saldo)}</span>
        </div>
      </div>
    </div>
  );
}
