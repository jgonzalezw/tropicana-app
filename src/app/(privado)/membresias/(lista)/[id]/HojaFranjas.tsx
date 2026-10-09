"use client";

/**
 * «+ Nueva reserva» de la ficha de Membresías, como `Nueva reserva franjas.dc.html`
 * (handoff v4): la fecha por semana, la sala, la grilla de franjas con lo libre
 * y lo ocupado, y un resumen fijo sobre los botones. Los datos fijos (horarios,
 * cursos, reglas, saldo) se piden una vez al abrir y las reservas por semana
 * (`consultarFranjasApertura`, `consultarSemanaFranjas`); cambiar de día dentro de la
 * semana no va al servidor. La grilla se arma acá con la misma ocupación que
 * valida al guardar (`lib/ocupacionSemana.ts`, `lib/franjasReserva.ts`, puras y
 * con pruebas). Lo guardado vive mientras la hoja está abierta. Al guardar,
 * `crearReserva` valida de nuevo en el servidor, sin confiar en nada de esto.
 * La pantalla vieja (`NuevaReserva` en `marco="pagina"`) no cambia.
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
import { armarDatosFranjas, rangoDeSemana, type BaseFranjas, type SemanaFranjas } from "@/lib/ocupacionSemana";
import { consultarFranjasApertura, consultarSemanaFranjas, crearReserva } from "@/app/(privado)/particulares/acciones";
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
  const [recarga, setRecarga] = useState(0);
  const [resultado, setResultado] = useState<ResultadoNueva | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
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

  // Datos fijos: una vez por apertura. Reservas: una vez por semana. Las promesas se guardan para que
  // el doble efecto de React en desarrollo no repita la consulta; al guardar con error se descarta todo
  // (puede haberse ocupado la franja o cambiado el saldo) y se vuelve a leer.
  const baseP = useRef<Promise<{ error: string } | BaseFranjas> | null>(null);
  const semanasP = useRef(new Map<string, Promise<{ error: string } | SemanaFranjas>>());
  const [base, setBase] = useState<BaseFranjas | null>(null);
  const [semanas, setSemanas] = useState<Record<string, SemanaFranjas>>({});
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const rangoSemana = rangoDeSemana(semanaDesde, fecha);
  const claveSemana = `${rangoSemana.desde}|${rangoSemana.hasta}`;
  useEffect(() => {
    if (externo || salaId == null) return;
    let vigente = true;
    if (!baseP.current) {
      // Datos fijos y primera semana en una sola llamada (dos seguidas se encolan).
      const apertura = consultarFranjasApertura({ membresiaId: datos.membresiaId, desde: claveSemana.split("|")[0], hasta: claveSemana.split("|")[1] });
      baseP.current = apertura.then((r) => ("error" in r ? r : r.base));
      semanasP.current.set(claveSemana, apertura.then((r) => ("error" in r ? r : r.semana)));
    }
    let pSemana = semanasP.current.get(claveSemana);
    if (!pSemana) {
      pSemana = consultarSemanaFranjas({ membresiaId: datos.membresiaId, desde: claveSemana.split("|")[0], hasta: claveSemana.split("|")[1] });
      semanasP.current.set(claveSemana, pSemana);
    }
    Promise.all([baseP.current, pSemana]).then(([b, s]) => {
      if (!vigente) return;
      if ("error" in b) {
        baseP.current = null;
        semanasP.current.delete(claveSemana);
        return setErrorCarga(b.error);
      }
      if ("error" in s) {
        semanasP.current.delete(claveSemana);
        return setErrorCarga(s.error);
      }
      setErrorCarga(null);
      setBase(b);
      setSemanas((prev) => (prev[claveSemana] === s ? prev : { ...prev, [claveSemana]: s }));
    });
    return () => {
      vigente = false;
    };
  }, [externo, salaId, claveSemana, datos.membresiaId, recarga]);

  // La grilla del día sale de lo ya leído: cambiar de día dentro de la semana no consulta nada.
  const calculo = useMemo(() => {
    const semana = semanas[claveSemana];
    if (externo || salaId == null || !base || !semana) return null;
    try {
      return { datos: armarDatosFranjas(base, semana, { salaId, fecha, semanaDesde, ahora }) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [externo, salaId, base, semanas, claveSemana, fecha, semanaDesde, ahora]);
  const [previa, setPrevia] = useState<DatosFranjas | null>(null);
  const calculada = calculo && "datos" in calculo ? calculo.datos : null;
  useEffect(() => {
    if (calculada) setPrevia(calculada);
  }, [calculada]);
  // Al cambiar de semana se sigue viendo la anterior, atenuada, hasta que llega la nueva.
  const lectura = calculada ?? previa;
  const errorLectura = errorCarga ?? (calculo && "error" in calculo ? calculo.error : null);
  const cargando = !externo && !calculada && !errorLectura;

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
        // Lo que falló suele ser que el lugar se ocupó: se descarta lo leído, se vuelve a pedir y se avisa.
        setSel(null);
        baseP.current = null;
        semanasP.current.clear();
        setBase(null);
        setSemanas({});
        setRecarga((n) => n + 1);
        if (!externo) avisar("Recargué la semana: puede que esa franja se haya ocupado mientras tanto.");
      } else {
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
      verCancelar={!creada}
      onCancelar={sel && !externo ? () => setSel(null) : undefined}
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
            onSemana={(d) => {
              // La fecha elegida acompaña a la semana que se ve: el mismo día de la semana, dentro de la vigencia.
              const salto = Math.round((aUTC(d) - aUTC(semanaDesde)) / MS_DIA);
              const nueva = sumar(fecha, salto);
              irA([datos.fechaFin, [nueva, desde].sort()[1]].sort()[0]);
              setSemanaDesde(d);
            }}
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
              <div className="n-franjas" data-testid="franjas" aria-busy={cargando} style={cargando ? { opacity: 0.5, pointerEvents: "none" } : undefined}>
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
