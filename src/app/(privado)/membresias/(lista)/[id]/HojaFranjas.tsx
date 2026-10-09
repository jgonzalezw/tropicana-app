"use client";

/**
 * «+ Nueva reserva» de la ficha de Membresías, como `Nueva reserva franjas.dc.html`
 * (handoff v4): la fecha por semana, la sala, la grilla de franjas con lo libre
 * y lo ocupado, y un resumen fijo sobre los botones. La ocupación sale del
 * servidor con la misma lógica que valida al guardar (`consultarFranjasReserva`);
 * acá solo se arma la grilla y la selección (`lib/franjasReserva.ts`, pura y
 * con pruebas). Al guardar, `crearReserva` valida de nuevo. La pantalla vieja
 * (`NuevaReserva` en `marco="pagina"`) no cambia.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import HojaLateral from "@/components/nuevo/HojaLateral";
import { PanelResultado, type ResultadoNueva } from "@/components/NuevaReserva";
import { aHora, aMinutos, formatearHoras } from "@/lib/horarios";
import { faltaNuevaReserva } from "@/lib/reservas";
import { fechaTexto } from "@/lib/fichaMembresia";
import { isoLocal } from "@/lib/calendarioCiclo";
import {
  armarFranjas,
  clicEnFranja,
  fh,
  horasLibresTexto,
  lineaDeHorario,
  minimoEfectivo,
  seleccionValida,
  vistaFranjas,
  type DatosFranjas,
  type Seleccion,
} from "@/lib/franjasReserva";
import { consultarFranjasReserva, crearReserva } from "@/app/(privado)/particulares/acciones";
import SemanaChips from "./SemanaChips";
import type { DatosReservas } from "./PestanasFicha";

const MS_DIA = 86_400_000;
const aUTC = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const sumar = (iso: string, n: number) => new Date(aUTC(iso) + n * MS_DIA).toISOString().slice(0, 10);
/** El primer día de la semana (de a 7, contando desde el primer día pedible) que contiene la fecha. */
const semanaDe = (fecha: string, desde: string) => sumar(desde, Math.floor((aUTC(fecha) - aUTC(desde)) / MS_DIA / 7) * 7);

const LEYENDA: [string, string][] = [
  ["transparent", "Libre"],
  ["var(--n-sel)", "Elegida"],
  ["var(--n-hover)", "Ocupada"],
  ["var(--n-prof-bg)", "Profesor ocupado"],
];
const BORDE_LEYENDA: Record<string, string> = { Libre: "var(--n-linea)", Elegida: "var(--n-acc)" };

export default function HojaFranjas({
  datos,
  inicial,
  onCerrar,
}: {
  datos: DatosReservas;
  inicial?: { fecha?: string; hora?: string; salaId?: number };
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  // Reloj del navegador, fijo mientras la hoja está abierta: solo marca las franjas «Pasada» de hoy.
  const [ahora] = useState(() => new Date());
  const hoy = isoLocal(ahora);
  const desde = [hoy, datos.fechaInicio].sort()[1];
  // La vigencia manda: ni antes del primer día pedible ni después del vencimiento.
  const fechaInicial = [datos.fechaFin, [inicial?.fecha ?? desde, desde].sort()[1]].sort()[0];

  const [fecha, setFecha] = useState(fechaInicial);
  const [semanaDesde, setSemanaDesde] = useState(semanaDe(fechaInicial, desde));
  const [salaTipo, setSalaTipo] = useState<"propia" | "externa">("propia");
  const [salaId, setSalaId] = useState<number | null>(inicial?.salaId ?? datos.salasPropias[0]?.id ?? null);
  const [sel, setSel] = useState<Seleccion>(null);
  const [lectura, setLectura] = useState<DatosFranjas | null>(null);
  const [errorLectura, setErrorLectura] = useState<string | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [resultado, setResultado] = useState<ResultadoNueva | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [tocada, setTocada] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Lugar externo: sin grilla, con los campos de hora y duración.
  const [nombreExterna, setNombreExterna] = useState(datos.salaExterna?.nombre ?? "");
  const [horaExterna, setHoraExterna] = useState(inicial?.hora ?? "19:00");
  const [duracionExterna, setDuracionExterna] = useState(0);

  const avisar = useCallback((texto: string) => {
    clearTimeout(temporizador.current);
    setAviso(texto);
    temporizador.current = setTimeout(() => setAviso(null), 3500);
  }, []);
  useEffect(() => () => clearTimeout(temporizador.current), []);

  const externo = salaTipo === "externa";

  // La grilla se pide de nuevo al cambiar fecha, sala o semana, y después de un error al guardar.
  useEffect(() => {
    if (externo || salaId == null) return;
    let vigente = true;
    consultarFranjasReserva({ membresiaId: datos.membresiaId, fecha, salaId, semanaDesde }).then((r) => {
      if (!vigente) return;
      if ("error" in r) {
        setErrorLectura(r.error);
        setLectura(null);
      } else {
        setErrorLectura(null);
        setLectura(r);
      }
    });
    return () => {
      vigente = false;
    };
  }, [externo, salaId, fecha, semanaDesde, datos.membresiaId, recarga]);

  const reglas = {
    incrementoMin: lectura?.incrementoMin ?? datos.incrementoMin,
    minimoMin: lectura?.minimoMin ?? datos.minimoMin,
    disponibleMin: lectura?.disponibleMin ?? datos.disponibleMin,
  };
  const salaElegida = lectura?.salas.find((s) => s.id === salaId) ?? null;
  const pasadasAntesDeMin = fecha === hoy ? ahora.getHours() * 60 + ahora.getMinutes() : null;
  const franjas = useMemo(
    () =>
      salaElegida && lectura
        ? armarFranjas({
            ventanas: salaElegida.ventanas,
            ocupadosSala: salaElegida.ocupadosSala,
            ocupadosProfesor: lectura.ocupadosProfesor,
            incrementoMin: lectura.incrementoMin,
            pasadasAntesDeMin,
          })
        : [],
    [salaElegida, lectura, pasadasAntesDeMin]
  );
  const vista = useMemo(() => vistaFranjas(franjas, reglas, sel), [franjas, reglas.incrementoMin, reglas.minimoMin, reglas.disponibleMin, sel]); // eslint-disable-line react-hooks/exhaustive-deps

  const minimo = minimoEfectivo(reglas.incrementoMin, reglas.minimoMin);
  const duracionesExterna = useMemo(() => {
    const out: number[] = [];
    for (let m = minimo; m <= Math.min(reglas.disponibleMin, 480); m += Math.max(1, reglas.incrementoMin)) out.push(m);
    return out;
  }, [minimo, reglas.incrementoMin, reglas.disponibleMin]);
  const durExt = duracionesExterna.includes(duracionExterna) ? duracionExterna : (duracionesExterna[0] ?? minimo);

  const cerrado = !externo && lectura !== null && franjas.length === 0 && (salaElegida?.ventanas.length ?? 0) === 0;
  const sala = datos.salasPropias.find((s) => s.id === salaId);

  // Lo que se va a guardar, o lo que falta.
  const faltaExterna = faltaNuevaReserva({
    fecha,
    hora: horaExterna,
    duracionMin: durExt,
    incrementoMin: reglas.incrementoMin,
    minimoMin: reglas.minimoMin,
    salaTipo: "externa",
    salaId: null,
    nombreExterna,
  });
  const valida = externo ? !faltaExterna && durExt <= reglas.disponibleMin && duracionesExterna.length > 0 : seleccionValida(franjas, reglas, sel);
  const rango = externo
    ? { ini: aMinutos(horaExterna) ?? 0, fin: (aMinutos(horaExterna) ?? 0) + durExt }
    : sel;
  const creada = !!resultado && !resultado.error;

  function elegir<T>(poner: (v: T) => void, reiniciar = true) {
    return (v: T) => {
      setTocada(true);
      if (reiniciar) setSel(null);
      setResultado(null);
      poner(v);
    };
  }
  const irA = (f: string) => elegir<string>(setFecha)(f);

  function guardar(accion: "solicitar" | "confirmar") {
    if (!valida || !rango) return;
    setResultado(null);
    startTransition(async () => {
      const r = await crearReserva({
        membresiaId: datos.membresiaId,
        fecha,
        hora: aHora(rango.ini),
        duracionMin: rango.fin - rango.ini,
        sala: externo ? { tipo: "externa", nombreDescriptivo: nombreExterna } : { tipo: "propia", salaId: salaId! },
        accion,
      });
      setResultado(r);
      if (r.error) {
        // Se refresca la grilla: lo que falló suele ser que el lugar se ocupó.
        setSel(null);
        setRecarga((n) => n + 1);
      } else {
        setTocada(false);
        router.refresh();
      }
    });
  }

  const textoFecha = fechaTexto(fecha);
  const resumen = rango && (valida || externo || sel) ? (
    <>
      <strong>
        {textoFecha} · {aHora(rango.ini)}–{aHora(rango.fin)} · {fh(rango.fin - rango.ini)} · {externo ? nombreExterna || "Lugar externo" : sala?.nombre}
      </strong>
      <small>Quedan {fh(Math.max(0, reglas.disponibleMin - (rango.fin - rango.ini)))} para pedir</small>
    </>
  ) : (
    <>
      <strong>Elegí la hora de inicio</strong>
      <small>Disponible para pedir {fh(reglas.disponibleMin)}</small>
    </>
  );
  const resumenOk = valida && !!rango;

  const sinHoras = reglas.disponibleMin < minimo;

  return (
    <HojaLateral
      contexto={`${datos.tipo === "alquiler" ? "Alquiler" : "Clase particular"}`}
      titulo="Nueva reserva"
      onCerrar={onCerrar}
      sucia={tocada && !creada}
      verCancelar={!creada}
      resumen={
        creada ? undefined : (
          <>
            {aviso && <div className="n-aviso-flotante" role="status">{aviso}</div>}
            <div className="n-resumen-caja" data-ok={resumenOk} data-testid="resumen-reserva">
              <span>{resumen}</span>
              {sel && !externo && (
                <button type="button" onClick={() => setSel(null)}>
                  Limpiar
                </button>
              )}
            </div>
          </>
        )
      }
      secundaria={sinHoras || creada ? undefined : { txt: "Solicitar", onClick: () => guardar("solicitar"), bloqueada: pendiente || !valida }}
      primaria={
        creada
          ? { txt: "Listo", onClick: onCerrar }
          : sinHoras
            ? undefined
            : { txt: "Confirmar directo", onClick: () => guardar("confirmar"), bloqueada: pendiente || !valida }
      }
    >
      {creada ? (
        resultado && <PanelResultado r={resultado} />
      ) : sinHoras ? (
        <p className="n-res__nota">
          No quedan horas para reservar: {reglas.disponibleMin > 0 ? `quedan ${formatearHoras(reglas.disponibleMin / 60)} h, menos que el mínimo de ${formatearHoras(minimo / 60)} h por reserva` : "se usó todo el paquete"}.
        </p>
      ) : (
        <>
          <SemanaChips
            semanaDesde={semanaDesde}
            fecha={fecha}
            hoy={hoy}
            desde={desde}
            hasta={datos.fechaFin}
            dias={lectura?.dias ?? null}
            onFecha={(f) => {
              irA(f);
              setSemanaDesde(semanaDe(f, desde));
            }}
            onSemana={(d) => elegir<string>(setSemanaDesde, false)(d)}
            onAviso={avisar}
          />

          <div className="n-grupo">
            <span className="n-grupo__titulo">Dónde</span>
            <div className="n-chips-opcion" role="group" aria-label="Dónde">
              {datos.salasPropias.map((s) => {
                const delDia = lectura?.salas.find((x) => x.id === s.id);
                const sub = delDia
                  ? horasLibresTexto(
                      armarFranjas({ ventanas: delDia.ventanas, ocupadosSala: delDia.ocupadosSala, ocupadosProfesor: [], incrementoMin: reglas.incrementoMin, pasadasAntesDeMin }),
                      reglas.incrementoMin
                    )
                  : "";
                return (
                  <button
                    key={s.id}
                    type="button"
                    className="n-sala-chip"
                    aria-pressed={!externo && salaId === s.id}
                    onClick={() => {
                      elegir<"propia" | "externa">(setSalaTipo)("propia");
                      setSalaId(s.id);
                    }}
                  >
                    {s.nombre}
                    <small>{sub}</small>
                  </button>
                );
              })}
              {datos.ofrecerExterna && (
                <button type="button" className="n-sala-chip" aria-pressed={externo} onClick={() => elegir<"propia" | "externa">(setSalaTipo)("externa")}>
                  Lugar externo
                </button>
              )}
            </div>
          </div>

          {externo ? (
            <div className="n-grupo" data-testid="lugar-externo">
              <label className="n-campo">
                <span>Nombre del lugar</span>
                <input placeholder="Salón X — Hotel Y" value={nombreExterna} onChange={(e) => elegir<string>(setNombreExterna, false)(e.target.value)} />
              </label>
              <div style={{ display: "flex", gap: "0.7143rem" }}>
                <label className="n-campo" style={{ flex: 1 }}>
                  <span>Hora de inicio</span>
                  <input type="time" value={horaExterna} onChange={(e) => elegir<string>(setHoraExterna, false)(e.target.value)} />
                </label>
                <label className="n-campo" style={{ flex: 1 }}>
                  <span>Duración</span>
                  <select value={durExt} onChange={(e) => elegir<number>(setDuracionExterna, false)(Number(e.target.value))}>
                    {duracionesExterna.map((d) => (
                      <option key={d} value={d}>
                        {fh(d)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <span className="n-res__nota">Fuera de la escuela no hay grilla: se valida la agenda del profesor y el saldo.</span>
              {faltaExterna && <span className="n-res__falta">{faltaExterna}</span>}
            </div>
          ) : errorLectura ? (
            <p className="n-error" role="alert">
              {errorLectura}
            </p>
          ) : !lectura ? (
            <p className="n-res__nota">Buscando lo libre de la sala…</p>
          ) : cerrado ? (
            <div className="n-cerrada" data-testid="sala-cerrada">
              <span>
                {sala?.nombre} cerrada el {textoFecha}
              </span>
              <span>{lectura.dias.find((d) => d.fecha === fecha)?.motivo ?? "Sin horario de apertura ese día."}</span>
              {lectura.proxima ? (
                <button type="button" onClick={() => { irA(lectura.proxima!); setSemanaDesde(semanaDe(lectura.proxima!, desde)); }}>
                  Ver {fechaTexto(lectura.proxima)} →
                </button>
              ) : (
                <span className="n-res__nota">No hay otra fecha abierta dentro de la vigencia</span>
              )}
            </div>
          ) : (
            <div className="n-grupo">
              <span className="n-horario-linea">
                <span className="n-grupo__titulo">Horario</span>
                <span>
                  {lineaDeHorario({ ventanas: salaElegida?.ventanas ?? [], excepcionMotivo: lectura.excepcionMotivo, incrementoMin: reglas.incrementoMin, minimoMin: reglas.minimoMin })}
                </span>
              </span>
              <div className="n-franjas" data-testid="franjas">
                {vista.map((f) => (
                  <button
                    key={f.inicio}
                    type="button"
                    className="n-franja"
                    data-aspecto={f.aspecto}
                    data-sumar={f.texto.startsWith("+ sumar")}
                    data-hora={f.hora}
                    aria-disabled={!f.habilitada}
                    aria-pressed={f.aspecto === "elegida"}
                    title={f.titulo}
                    onClick={() => {
                      const r = clicEnFranja(franjas, reglas, sel, f.inicio);
                      if (r.aviso) return avisar(r.aviso);
                      setTocada(true);
                      setResultado(null);
                      setSel(r.sel);
                    }}
                  >
                    <span>{f.hora}</span>
                    <span>{f.texto}</span>
                    <span>{f.derecha}</span>
                  </button>
                ))}
              </div>
              <div className="n-leyenda">
                {LEYENDA.map(([fondo, texto]) => (
                  <span key={texto}>
                    <i style={{ background: fondo, borderColor: BORDE_LEYENDA[texto] ?? "transparent" }} />
                    {texto}
                  </span>
                ))}
              </div>
            </div>
          )}
          {resultado?.error && <PanelResultado r={resultado} />}
        </>
      )}
    </HojaLateral>
  );
}
