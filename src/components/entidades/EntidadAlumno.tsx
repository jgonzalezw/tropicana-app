"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { Alumno, DatosAlumno, MatrizMinimo } from "@/lib/tipos";
import { soloDigitos } from "@/lib/texto";
import {
  nombreCompleto,
  apellidoNombre,
  compararContactosPorApellido,
  validarFechaNacimiento,
  coincideBusqueda,
  documentoComparable,
} from "@/lib/contactos";
import IconoRed from "./IconoRed";
import AbrirChatWhatsapp from "./AbrirChatWhatsapp";
import { contextoAlumno, nivelesDe, faltantes, presenteDesdeExtra } from "@/lib/matrizMinimos";
import CamposContacto, { DATOS_CONTACTO_EXTRA_VACIO, type ListasContacto } from "./CamposContacto";
import VistaContacto, { Dato, type ModoFicha } from "./VistaContacto";
import EnlaceWhatsapp from "./EnlaceWhatsapp";
import { detalleContacto } from "@/app/(privado)/contactos/acciones";

type Canal = { valor: string; etiqueta: string };

/**
 * Componente de entidad compartido para Alumno — buscar / alta / edición / baja.
 * Incluye: duplicado por WhatsApp, bloque de tutor si es menor, clave compuesta
 * de menor (WhatsApp del tutor + nombre) y tutor que puede ser un alumno
 * existente (vincular en vez de duplicar). Datos por prop, avisa por callbacks.
 *
 * Desde la 0048 (C3-0a.1), `nombre`/`apellido`/`whatsapp` viven en
 * `a.contacto` — `alumnos` es una extensión de rol, no la persona.
 */
export default function EntidadAlumno({
  padron,
  canales,
  matriz,
  listasContacto,
  puedeVerPrivados,
  enPrueba = false,
  permitirBaja = false,
  abrirAlElegir = true,
  valor = null,
  modoInicial = "editar",
  puedeEditar = false,
  depsDe,
  onGuardar,
  onBaja,
  onActivar,
  onSelect,
  onCancelar,
}: {
  padron: Alumno[];
  canales: Canal[];
  matriz: MatrizMinimo[];
  listasContacto: ListasContacto;
  puedeVerPrivados: boolean;
  /** Si este formulario se abre desde la clase de prueba (contexto `prueba` cuando no es menor). */
  enPrueba?: boolean;
  permitirBaja?: boolean;
  abrirAlElegir?: boolean;
  valor?: Alumno | null;
  /** Cómo se abre `valor`: editando (el usuario pidió editar) o para ver. */
  modoInicial?: ModoFicha;
  /** Si el rol puede editar un alumno existente (`alumnos` · `editar`). */
  puedeEditar?: boolean;
  depsDe?: (id: number) => number | undefined;
  onGuardar?: (datos: DatosAlumno, id: number | null) => Promise<{ error?: string }>;
  onBaja?: (id: number) => Promise<{ error?: string; accion?: string }>;
  onActivar?: (id: number) => Promise<{ error?: string }>;
  onSelect?: (a: Alumno) => void;
  onCancelar?: () => void;
}) {
  const [ficha, setFicha] = useState<Alumno | "nuevo" | null>(valor);
  // Elegir a alguien lo abre para VER; editar es un paso explícito, y solo
  // si el rol puede (Javier, 2026-09-24).
  const [modo, setModo] = useState<ModoFicha>(valor ? modoInicial : "editar");
  const [volverAVista, setVolverAVista] = useState(false);
  const [q, setQ] = useState("");

  function abrir(a: Alumno | "nuevo", m: ModoFicha) {
    setFicha(a);
    setModo(m);
    setVolverAVista(false);
  }
  function cerrar() {
    setFicha(null);
    onCancelar?.();
  }

  const resultados = padron
    .filter((a) =>
      coincideBusqueda(q, {
        contacto: a.contacto,
        tutorWhatsapp: a.tutor?.whatsapp,
        documento: a.contacto.privados?.numero,
      })
    )
    .sort((a, b) => compararContactosPorApellido(a.contacto, b.contacto))
    .slice(0, 5);

  if (ficha) {
    const existente = ficha === "nuevo" ? null : ficha;
    return (
      <FichaAlumno
        // Cambiar de modo remonta la ficha: volver a la vista descarta lo tipeado.
        key={`${existente?.id ?? "nuevo"}-${modo}`}
        inicial={existente}
        viendo={!!existente && modo === "ver"}
        puedeEditar={puedeEditar}
        padron={padron}
        canales={canales}
        matriz={matriz}
        listasContacto={listasContacto}
        puedeVerPrivados={puedeVerPrivados}
        enPrueba={enPrueba}
        permitirBaja={permitirBaja}
        deps={existente && depsDe ? depsDe(existente.id) : undefined}
        onAbrir={(a) => abrir(a, "ver")}
        onEditar={() => {
          setModo("editar");
          setVolverAVista(true);
        }}
        onGuardar={onGuardar}
        onBaja={onBaja}
        onActivar={onActivar}
        onCancelar={() => {
          if (volverAVista) {
            setModo("ver");
            setVolverAVista(false);
          } else cerrar();
        }}
        onCerrar={cerrar}
      />
    );
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="block text-base font-medium mb-1.5">
          {puedeVerPrivados ? "Buscar por nombre, WhatsApp o documento" : "Buscar por nombre o WhatsApp"}
        </span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ej. Martínez · 7105" className="entrada" />
      </label>

      {q.trim().length >= 2 &&
        (resultados.length === 0 ? (
          <p className="text-[var(--texto-tenue)]">Nadie con ese dato. Cargalo como alumno nuevo.</p>
        ) : (
          resultados.map((a) => (
            <button
              key={a.id}
              onClick={() => (abrirAlElegir ? abrir(a, "ver") : onSelect?.(a))}
              className="w-full text-left bg-[var(--fondo-elevado)] border border-[var(--borde)] rounded-[var(--radio-panel)] px-4 py-3 hover:border-[var(--primario)]"
            >
              <div className="font-medium">{apellidoNombre(a.contacto)}</div>
              <div className="text-sm text-[var(--texto-tenue)] inline-flex items-center gap-1">
                <IconoRed red="whatsapp" nombre="WhatsApp" className="w-3.5 h-3.5" />
                {a.es_menor
                  ? `menor · tutor ${a.tutor?.whatsapp || "—"}`
                  : a.contacto.whatsapp || "sin WhatsApp"}
              </div>
            </button>
          ))
        ))}

      <button
        onClick={() => abrir("nuevo", "editar")}
        className="w-full px-5 py-3 text-base font-semibold rounded-[var(--radio-control)] bg-[var(--fondo-elevado)] border border-[var(--borde)] hover:border-[var(--primario)]"
      >
        + Alumno nuevo
      </button>
    </div>
  );
}

function FichaAlumno({
  inicial,
  viendo,
  puedeEditar,
  padron,
  canales,
  matriz,
  listasContacto,
  puedeVerPrivados,
  enPrueba,
  permitirBaja,
  deps,
  onAbrir,
  onEditar,
  onGuardar,
  onBaja,
  onActivar,
  onCancelar,
  onCerrar,
}: {
  inicial: Alumno | null;
  viendo: boolean;
  puedeEditar: boolean;
  padron: Alumno[];
  canales: Canal[];
  matriz: MatrizMinimo[];
  listasContacto: ListasContacto;
  puedeVerPrivados: boolean;
  enPrueba: boolean;
  permitirBaja: boolean;
  deps?: number;
  onAbrir: (a: Alumno) => void;
  onEditar: () => void;
  onGuardar?: (datos: DatosAlumno, id: number | null) => Promise<{ error?: string }>;
  onBaja?: (id: number) => Promise<{ error?: string; accion?: string }>;
  onActivar?: (id: number) => Promise<{ error?: string }>;
  onCancelar: () => void;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.contacto.nombre ?? "");
  const [apellido, setApellido] = useState(inicial?.contacto.apellido ?? "");
  const [wa, setWa] = useState(inicial?.contacto.whatsapp ?? "");
  const [esMenor, setEsMenor] = useState(inicial?.es_menor ?? false);
  const [extra, setExtra] = useState({
    ...DATOS_CONTACTO_EXTRA_VACIO,
    email: inicial?.contacto.email ?? null,
    sexo: inicial?.contacto.sexo ?? null,
  });

  const [detalleListo, setDetalleListo] = useState(!inicial);

  // Redes/documento/consentimiento no viajan en el padrón (tablas aparte):
  // se piden al abrir la ficha de un alumno existente, no para toda la lista.
  useEffect(() => {
    if (!inicial) return;
    let vivo = true;
    detalleContacto(inicial.contacto_id).then((d) => {
      if (!vivo) return;
      setDetalleListo(true);
      setExtra((e) => ({
        ...e,
        redes: d.redes.map((r) => ({ red: r.red, usuario: r.usuario })),
        documento: d.documento,
        fecha_nacimiento: d.fecha_nacimiento,
        consentimiento: d.consentimiento ? { otorgado: d.consentimiento.otorgado, medio: d.consentimiento.medio } : null,
      }));
    });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicial?.id]);

  const contexto = contextoAlumno({ esMenor, enPrueba });
  const niveles = nivelesDe(matriz, contexto);
  const [tutorNom, setTutorNom] = useState(inicial?.tutor ? nombreCompleto(inicial.tutor) : "");
  const [tutorWa, setTutorWa] = useState(inicial?.tutor?.whatsapp ?? "");
  // tutorLink solo representa "el tutor ES un alumno ya cargado" (como el
  // viejo tutor_alumno_id): si el tutor guardado es un contacto suelto (p.
  // ej. Jessica Galvis, sin ficha de alumno), queda como texto libre y
  // `resolverTutor` lo reusa por WhatsApp al guardar, sin duplicarlo.
  const [tutorLink, setTutorLink] = useState<number | null>(
    inicial?.tutor && padron.some((a) => a.contacto.id === inicial.tutor!.id) ? inicial.tutor.id : null
  );
  const [canal, setCanal] = useState(inicial?.contacto.canal_captacion ?? "");
  const [descAdulto, setDescAdulto] = useState(false);
  const [descMenor, setDescMenor] = useState(false);
  const [descTutor, setDescTutor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const curId = inicial?.id ?? -1;
  const waDig = soloDigitos(wa);
  const tutWaDig = soloDigitos(tutorWa);

  // Duplicado por WhatsApp (adulto).
  const dupAdulto =
    !esMenor && !descAdulto && waDig.length >= 6
      ? padron.find((a) => !a.es_menor && a.id !== curId && soloDigitos(a.contacto.whatsapp) === waDig)
      : undefined;

  // Duplicado de menor por clave compuesta (tutor + nombre).
  const dupMenor =
    esMenor && !descMenor && tutWaDig.length >= 6 && nombre.trim()
      ? padron.find(
          (a) =>
            a.es_menor &&
            a.id !== curId &&
            soloDigitos(a.tutor?.whatsapp) === tutWaDig &&
            (a.contacto.nombre ?? "").toLowerCase() === nombre.trim().toLowerCase()
        )
      : undefined;

  // El WhatsApp del tutor ya es de un alumno adulto → ofrecer vincular.
  const tutorEsAlumno =
    esMenor && !tutorLink && !descTutor && tutWaDig.length >= 6
      ? padron.find((a) => !a.es_menor && soloDigitos(a.contacto.whatsapp) === tutWaDig)
      : undefined;

  // Documento de otro alumno: misma persona, sin "es otra" posible (la base
  // lo impide igual con su índice único; esto lo avisa antes de guardar).
  const docTipeado = documentoComparable(extra.documento?.numero);
  const dupDocumento =
    docTipeado.length >= 3
      ? padron.find((a) => a.id !== curId && documentoComparable(a.contacto.privados?.numero) === docTipeado)
      : undefined;

  const identidadOk = esMenor ? tutWaDig.length >= 6 && !!nombre.trim() : waDig.length >= 6;
  const panelAbierto = !!dupAdulto || !!dupMenor || !!tutorEsAlumno || !!dupDocumento;
  const faltanExtra = faltantes(niveles, {
    apellido: !!apellido.trim(),
    canal_captacion: !!canal,
    ...presenteDesdeExtra(extra),
  }).filter((c) => c !== "nombre" && c !== "whatsapp" && c !== "tutor" && c !== "es_menor");
  // Misma regla que el servidor (`validarFechaNacimiento`): una fecha de
  // nacimiento que da menor de edad exige el camino de menor, con tutor.
  const errEdad = validarFechaNacimiento(extra.fecha_nacimiento, esMenor);
  const puedeGuardar =
    !pendiente && !!nombre.trim() && identidadOk && !panelAbierto && faltanExtra.length === 0 && !errEdad;

  function guardar() {
    setError(null);
    startTransition(async () => {
      const res = await onGuardar?.(
        {
          nombre,
          apellido,
          whatsapp: wa,
          es_menor: esMenor,
          tutorContactoId: tutorLink,
          tutorNombre: tutorNom,
          tutorWhatsapp: tutorWa,
          canal_captacion: canal || null,
          enPrueba,
          ...extra,
        },
        inicial?.id ?? null
      );
      if (res?.error) setError(res.error);
      else onCerrar();
    });
  }
  function baja() {
    if (!inicial) return;
    startTransition(async () => {
      const res = await onBaja?.(inicial.id);
      if (res?.error) setError(res.error);
      else onCerrar();
    });
  }

  function activar() {
    if (!inicial) return;
    setError(null);
    startTransition(async () => {
      const res = await onActivar?.(inicial.id);
      if (res?.error) setError(res.error);
      else onCerrar();
    });
  }

  const tieneHistorial = (deps ?? 0) > 0;

  if (viendo && inicial) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl">Alumno</h3>
          <button onClick={onCerrar} className="text-[var(--texto-tenue)] hover:text-[var(--texto)]">
            Cerrar
          </button>
        </div>

        <div className="text-lg font-semibold">
          {nombreCompleto(inicial.contacto)}
          {!inicial.activo && <span className="ml-2 text-sm font-normal text-[var(--texto-tenue)]">(inactivo)</span>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Dato etiqueta="WhatsApp">
            <EnlaceWhatsapp numero={inicial.contacto.whatsapp} vacio="—" />
          </Dato>
          {inicial.es_menor && (
            <Dato etiqueta="Tutor (es menor)">
              {inicial.tutor ? nombreCompleto(inicial.tutor) : "—"}
              {inicial.tutor?.whatsapp && (
                <>
                  {" · "}
                  <EnlaceWhatsapp numero={inicial.tutor.whatsapp} vacio="—" />
                </>
              )}
            </Dato>
          )}
          {(niveles.canal_captacion !== "-" || !!canal) && (
            <Dato etiqueta="Canal de captación">
              {canal ? canales.find((c) => c.valor === canal)?.etiqueta ?? canal : "—"}
            </Dato>
          )}
          <VistaContacto
            niveles={niveles}
            listas={listasContacto}
            valor={extra}
            puedeVerPrivados={puedeVerPrivados}
            cargando={!detalleListo}
          />
        </div>

        {error && (
          <p className="text-[var(--peligro)] text-base" role="alert">
            {error}
          </p>
        )}

        {/* Las mismas acciones que la fila del padrón. */}
        <div className="flex flex-wrap gap-2">
          <Link href={`/alumnos/${inicial.id}/cuenta`} className={BOTON_FILA}>
            Cuenta
          </Link>
          {puedeEditar && (
            <button onClick={onEditar} className={BOTON_FILA}>
              Editar
            </button>
          )}
          {permitirBaja &&
            (inicial.activo ? (
              <button
                onClick={baja}
                disabled={pendiente}
                className={`${BOTON_FILA_BASE} border-[var(--peligro)] text-[var(--peligro)] disabled:opacity-40`}
              >
                {tieneHistorial ? "Desactivar" : "Eliminar"}
              </button>
            ) : (
              <button
                onClick={activar}
                disabled={pendiente}
                className={`${BOTON_FILA_BASE} border-[var(--exito)] text-[var(--exito)] disabled:opacity-40`}
              >
                Activar
              </button>
            ))}
        </div>
        {permitirBaja && tieneHistorial && inicial.activo && (
          <p className="text-xs text-[var(--texto-tenue)]">Tiene historial: se desactiva, no se elimina.</p>
        )}
        {!puedeEditar && (
          <p className="text-sm text-[var(--texto-tenue)]">Tu rol puede ver este alumno, no editarlo.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl">{inicial ? "Editar alumno" : "Alumno nuevo"}</h3>
        <button onClick={onCancelar} className="text-[var(--texto-tenue)] hover:text-[var(--texto)]">
          Cancelar
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo etiqueta="Nombre">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="entrada" autoFocus />
        </Campo>
        {niveles.apellido !== "-" && (
          <Campo etiqueta={niveles.apellido === "O" ? "Apellido" : "Apellido (opcional)"}>
            <input value={apellido} onChange={(e) => setApellido(e.target.value)} className="entrada" />
          </Campo>
        )}
      </div>

      <Campo etiqueta={esMenor ? "WhatsApp (opcional si hay tutor)" : "WhatsApp · identifica al alumno"}>
        <input
          value={wa}
          onChange={(e) => {
            setWa(e.target.value);
            setDescAdulto(false);
          }}
          inputMode="tel"
          className="entrada"
        />
        <AbrirChatWhatsapp numero={wa} />
      </Campo>

      {dupAdulto && (
        <PanelDupe
          titulo="Ese WhatsApp ya está cargado"
          alumno={dupAdulto}
          onUsar={() => onAbrir(dupAdulto)}
          onOtra={() => setDescAdulto(true)}
        />
      )}

      {/* Tutor (menor) */}
      <button
        type="button"
        onClick={() => {
          const nuevo = !esMenor;
          setEsMenor(nuevo);
          if (!nuevo) {
            setTutorNom("");
            setTutorWa("");
            setTutorLink(null);
            setDescMenor(false);
            setDescTutor(false);
          }
        }}
        className="text-[var(--primario)] text-base"
      >
        {esMenor ? "Quitar tutor" : "Es menor: agregar tutor"}
      </button>

      {esMenor && (
        <div className="p-4 rounded-[var(--radio-panel)] border border-[var(--borde)] bg-[var(--fondo-elevado)] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo etiqueta="Tutor (nombre)">
              <input
                value={tutorNom}
                onChange={(e) => {
                  setTutorNom(e.target.value);
                  setTutorLink(null);
                  setDescTutor(false);
                }}
                className="entrada"
              />
            </Campo>
            <Campo etiqueta="WhatsApp tutor · identifica al menor">
              <input
                value={tutorWa}
                onChange={(e) => {
                  setTutorWa(e.target.value);
                  setTutorLink(null);
                  setDescTutor(false);
                  setDescMenor(false);
                }}
                inputMode="tel"
                className="entrada"
              />
              <AbrirChatWhatsapp numero={tutorWa} />
            </Campo>
          </div>
          <p className="text-sm text-[var(--texto-tenue)]">
            Al menor lo identificamos por el WhatsApp del tutor y su nombre, así dos hermanos con el
            mismo tutor no se pisan.
          </p>

          {tutorLink && (
            <div className="p-3 rounded-[var(--radio-panel)] border border-[var(--exito)] bg-[var(--exito-fill)] text-[var(--exito-texto)] text-sm flex items-center justify-between gap-3">
              <span>
                Vinculado a {nombreCompleto(padron.find((a) => a.contacto.id === tutorLink)?.contacto ?? null)},
                que ya está cargado como alumno.
              </span>
              <button
                type="button"
                onClick={() => setTutorLink(null)}
                className="underline shrink-0"
              >
                Desvincular
              </button>
            </div>
          )}

          {tutorEsAlumno && (
            <PanelDupe
              titulo="Ese WhatsApp ya es de un alumno"
              alumno={tutorEsAlumno}
              textoUsar="Vincular a esta persona"
              onUsar={() => {
                setTutorLink(tutorEsAlumno.contacto.id);
                setTutorNom(nombreCompleto(tutorEsAlumno.contacto));
                setTutorWa(tutorEsAlumno.contacto.whatsapp ?? tutorWa);
              }}
              onOtra={() => setDescTutor(true)}
            />
          )}

          {dupMenor && (
            <PanelDupe
              titulo="Ese menor ya está cargado"
              alumno={dupMenor}
              onUsar={() => onAbrir(dupMenor)}
              onOtra={() => setDescMenor(true)}
            />
          )}
        </div>
      )}

      {niveles.canal_captacion !== "-" && (
        <Campo etiqueta={niveles.canal_captacion === "O" ? "Canal de captación" : "Canal de captación (opcional)"}>
          <select value={canal ?? ""} onChange={(e) => setCanal(e.target.value)} className="entrada">
            <option value="">— Sin definir —</option>
            {canales.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
      )}

      <CamposContacto
        niveles={niveles}
        listas={listasContacto}
        valor={extra}
        onChange={setExtra}
        puedeVerPrivados={puedeVerPrivados}
      />

      {dupDocumento && (
        <PanelDupe
          titulo="Ese documento ya es de otro alumno"
          alumno={dupDocumento}
          textoUsar="Abrir ese alumno"
          onUsar={() => onAbrir(dupDocumento)}
        />
      )}

      {errEdad && (
        <p className="text-[var(--peligro)] text-base" role="alert">
          {errEdad}
        </p>
      )}

      {error && (
        <p className="text-[var(--peligro)] text-base" role="alert">
          {error}
        </p>
      )}

      <button
        onClick={guardar}
        disabled={!puedeGuardar}
        className="px-5 py-2.5 text-base font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] hover:bg-[var(--primario-hover)] disabled:opacity-40"
      >
        {pendiente ? "Guardando…" : "Guardar alumno"}
      </button>

      {permitirBaja && inicial && (
        <div
          className={`mt-2 p-4 rounded-[var(--radio-panel)] border ${
            tieneHistorial ? "border-[var(--primario)] bg-[var(--accent-100)]" : "border-[var(--borde)] bg-[var(--fondo-elevado)]"
          }`}
        >
          <div className="font-medium">{tieneHistorial ? "No se puede eliminar" : "Eliminar alumno"}</div>
          <p className="text-sm text-[var(--texto-tenue)] mt-1">
            {tieneHistorial
              ? "Tiene historial (inscripciones/pagos). Se desactiva y conserva lo registrado."
              : "Sin historial dependiente: se elimina de verdad."}
          </p>
          <button
            onClick={baja}
            disabled={pendiente}
            className={`mt-3 px-4 py-2 text-base rounded-[var(--radio-control)] border ${
              tieneHistorial ? "border-[var(--primario)] text-[var(--primario)]" : "border-[var(--peligro)] text-[var(--peligro)]"
            } disabled:opacity-40`}
          >
            {tieneHistorial ? "Desactivar" : "Eliminar"}
          </button>
        </div>
      )}
    </div>
  );
}

const BOTON_FILA_BASE = "px-4 py-1.5 text-sm rounded-[var(--radio-control)] border";
const BOTON_FILA = `${BOTON_FILA_BASE} border-[var(--borde)] hover:border-[var(--primario)]`;

function PanelDupe({
  titulo,
  alumno,
  textoUsar = "Usar este alumno",
  onUsar,
  onOtra,
}: {
  titulo: string;
  alumno: Alumno;
  textoUsar?: string;
  onUsar: () => void;
  onOtra?: () => void;
}) {
  return (
    <div className="p-4 rounded-[var(--radio-panel)] border border-[var(--primario)] bg-[var(--accent-100)]">
      <div className="font-semibold text-[var(--peligro-texto)]">{titulo}</div>
      <div className="mt-1">{nombreCompleto(alumno.contacto)}</div>
      <div className="flex gap-2 mt-3">
        <button
          type="button"
          onClick={onUsar}
          className="px-4 py-2 text-sm font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)]"
        >
          {textoUsar}
        </button>
        {onOtra && (
          <button
            type="button"
            onClick={onOtra}
            className="px-4 py-2 text-sm rounded-[var(--radio-control)] border border-[var(--borde)]"
          >
            Es otra persona
          </button>
        )}
      </div>
    </div>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-base font-medium mb-1.5">{etiqueta}</span>
      {children}
    </label>
  );
}
