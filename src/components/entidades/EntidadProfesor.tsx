"use client";

import { useEffect, useState, useTransition } from "react";
import type { Profesor, DepsProfesor, TipoProfesor, DatosProfesor, Estilo, MatrizMinimo } from "@/lib/tipos";
import { soloDigitos } from "@/lib/texto";
import {
  nombreCompleto,
  apellidoNombre,
  compararContactosPorApellido,
  coincideBusqueda,
  documentoComparable,
} from "@/lib/contactos";
import IconoRed from "./IconoRed";
import AbrirChatWhatsapp from "./AbrirChatWhatsapp";
import { nivelesDe, faltantes, presenteDesdeExtra } from "@/lib/matrizMinimos";
import CamposContacto, { DATOS_CONTACTO_EXTRA_VACIO, type ListasContacto } from "./CamposContacto";
import VistaContacto, { Dato, type ModoFicha } from "./VistaContacto";
import EnlaceWhatsapp from "./EnlaceWhatsapp";
import { gs } from "@/lib/inscripcion";
import { detalleContacto } from "@/app/(privado)/contactos/acciones";

type Cuenta = { id: string; etiqueta: string };

/**
 * Componente de entidad compartido para Profesor — buscar / alta / edición /
 * baja en un solo lugar, montado idéntico donde el profesor participe. No tiene
 * los datos: el padrón entra por prop y avisa hacia afuera por callbacks.
 * Mismo contrato que `Cobro`.
 *
 * Desde la 0048 (C3-0a.1), `nombre`/`apellido`/`whatsapp` viven en
 * `p.contacto`, y las especialidades son `estilos` (D12, catálogo propio en
 * vez de texto libre) en vez de `p.especialidades`.
 */
export default function EntidadProfesor({
  padron,
  cuentas,
  estilos,
  matriz,
  listasContacto,
  puedeVerPrivados,
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
  padron: Profesor[];
  cuentas: Cuenta[];
  estilos: Estilo[];
  matriz: MatrizMinimo[];
  listasContacto: ListasContacto;
  puedeVerPrivados: boolean;
  permitirBaja?: boolean;
  abrirAlElegir?: boolean;
  valor?: Profesor | null;
  /** Cómo se abre `valor`: editando (el usuario pidió editar) o para ver. */
  modoInicial?: ModoFicha;
  /** Si el rol puede editar un profesor existente (`profesores` · `editar`). */
  puedeEditar?: boolean;
  depsDe?: (id: number) => DepsProfesor | undefined;
  onGuardar?: (datos: DatosProfesor, id: number | null) => Promise<{ error?: string }>;
  onBaja?: (id: number) => Promise<{ error?: string; accion?: string }>;
  onActivar?: (id: number) => Promise<{ error?: string }>;
  onSelect?: (prof: Profesor) => void;
  onCancelar?: () => void;
}) {
  const [ficha, setFicha] = useState<Profesor | "nuevo" | null>(valor);
  // Elegir a alguien lo abre para VER; editar es un paso explícito, y solo
  // si el rol puede (Javier, 2026-09-24).
  const [modo, setModo] = useState<ModoFicha>(valor ? modoInicial : "editar");
  const [volverAVista, setVolverAVista] = useState(false);
  const [q, setQ] = useState("");

  function abrir(p: Profesor | "nuevo", m: ModoFicha) {
    setFicha(p);
    setModo(m);
    setVolverAVista(false);
  }
  function cerrar() {
    setFicha(null);
    onCancelar?.();
  }

  const resultados = padron
    .filter((p) => coincideBusqueda(q, { contacto: p.contacto, documento: p.contacto.privados?.numero }))
    .sort((a, b) => compararContactosPorApellido(a.contacto, b.contacto))
    .slice(0, 5);

  if (ficha) {
    const existente = ficha === "nuevo" ? null : ficha;
    return (
      <FichaProfesor
        // Cambiar de modo remonta la ficha: volver a la vista descarta lo tipeado.
        key={`${existente?.id ?? "nuevo"}-${modo}`}
        inicial={existente}
        viendo={!!existente && modo === "ver"}
        puedeEditar={puedeEditar}
        cuentas={cuentas}
        estilos={estilos}
        matriz={matriz}
        listasContacto={listasContacto}
        puedeVerPrivados={puedeVerPrivados}
        padron={padron}
        permitirBaja={permitirBaja}
        deps={existente && depsDe ? depsDe(existente.id) : undefined}
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
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ej. Nuñez · 7011"
          className="entrada"
        />
      </label>

      {q.trim().length >= 2 && (
        <div className="space-y-2">
          {resultados.length === 0 && (
            <p className="text-[var(--texto-tenue)]">Ningún profesor con ese dato.</p>
          )}
          {resultados.map((p) => (
            <button
              key={p.id}
              onClick={() => (abrirAlElegir ? abrir(p, "ver") : onSelect?.(p))}
              className="w-full text-left bg-[var(--fondo-elevado)] border border-[var(--borde)] rounded-[var(--radio-panel)] px-4 py-3 hover:border-[var(--primario)] transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{apellidoNombre(p.contacto)}</div>
                  <div className="text-sm text-[var(--texto-tenue)] inline-flex items-center gap-1">
                    <IconoRed red="whatsapp" nombre="WhatsApp" className="w-3.5 h-3.5" />
                    {p.contacto.whatsapp || "sin WhatsApp"} ·{" "}
                    {etiquetasDe(p.estilos, estilos).join(", ") || "sin especialidad"}
                  </div>
                </div>
                <TagTipo tipo={p.tipo} />
              </div>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => abrir("nuevo", "editar")}
        className="w-full px-5 py-3 text-base font-semibold rounded-[var(--radio-control)] bg-[var(--fondo-elevado)] border border-[var(--borde)] hover:border-[var(--primario)]"
      >
        + Profesor nuevo
      </button>
    </div>
  );
}

function etiquetasDe(claves: string[] | undefined, estilos: Estilo[]): string[] {
  return (claves ?? []).map((c) => estilos.find((e) => e.clave === c)?.nombre ?? c);
}

function FichaProfesor({
  inicial,
  viendo,
  puedeEditar,
  cuentas,
  estilos,
  matriz,
  listasContacto,
  puedeVerPrivados,
  padron,
  permitirBaja,
  deps,
  onEditar,
  onGuardar,
  onBaja,
  onActivar,
  onCancelar,
  onCerrar,
}: {
  inicial: Profesor | null;
  viendo: boolean;
  puedeEditar: boolean;
  cuentas: Cuenta[];
  estilos: Estilo[];
  matriz: MatrizMinimo[];
  listasContacto: ListasContacto;
  puedeVerPrivados: boolean;
  padron: Profesor[];
  permitirBaja: boolean;
  deps?: DepsProfesor;
  onEditar: () => void;
  onGuardar?: (datos: DatosProfesor, id: number | null) => Promise<{ error?: string }>;
  onBaja?: (id: number) => Promise<{ error?: string; accion?: string }>;
  onActivar?: (id: number) => Promise<{ error?: string }>;
  onCancelar: () => void;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.contacto.nombre ?? "");
  const [apellido, setApellido] = useState(inicial?.contacto.apellido ?? "");
  const [whatsapp, setWhatsapp] = useState(inicial?.contacto.whatsapp ?? "");
  const [tipo, setTipo] = useState<TipoProfesor>(inicial?.tipo ?? "activo");
  const [esp, setEsp] = useState<Set<string>>(new Set(inicial?.estilos ?? []));
  const [usuarioId, setUsuarioId] = useState<string | null>(inicial?.usuario_id ?? null);
  const [tarifaRee, setTarifaRee] = useState(
    inicial?.tarifa_reemplazo == null ? "" : String(inicial.tarifa_reemplazo)
  );
  const [feeHora, setFeeHora] = useState(inicial?.fee_hora == null ? "" : String(inicial.fee_hora));
  const [extra, setExtra] = useState({
    ...DATOS_CONTACTO_EXTRA_VACIO,
    email: inicial?.contacto.email ?? null,
    sexo: inicial?.contacto.sexo ?? null,
  });
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const [detalleListo, setDetalleListo] = useState(!inicial);

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

  const niveles = nivelesDe(matriz, "profesor");

  // Aviso suave de WhatsApp duplicado (además del control duro en el servidor).
  const dupe = padron.find(
    (p) =>
      p.id !== inicial?.id &&
      soloDigitos(p.contacto.whatsapp) &&
      soloDigitos(p.contacto.whatsapp) === soloDigitos(whatsapp)
  );

  // Documento de otro profesor: misma persona (la base igual lo impide).
  const docTipeado = documentoComparable(extra.documento?.numero);
  const dupeDoc =
    docTipeado.length >= 3
      ? padron.find((p) => p.id !== inicial?.id && documentoComparable(p.contacto.privados?.numero) === docTipeado)
      : undefined;

  function toggleEsp(clave: string) {
    setEsp((prev) => {
      const n = new Set(prev);
      if (n.has(clave)) n.delete(clave);
      else n.add(clave);
      return n;
    });
  }

  const faltanExtra = faltantes(niveles, {
    apellido: !!apellido.trim(),
    ...presenteDesdeExtra(extra),
  }).filter((c) => c !== "nombre" && c !== "whatsapp" && c !== "tipo_profesor");

  function guardar() {
    setError(null);
    startTransition(async () => {
      const res = await onGuardar?.(
        {
          nombre,
          apellido,
          whatsapp,
          tipo,
          estilos: [...esp],
          usuario_id: usuarioId,
          tarifa_reemplazo:
            tarifaRee.trim() === "" ? null : Number(tarifaRee.replace(/[^\d.]/g, "")) || 0,
          fee_hora: feeHora.trim() === "" ? null : Number(feeHora.replace(/[^\d.]/g, "")) || 0,
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
    setError(null);
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

  const tieneHistorial =
    deps && deps.asignaciones + deps.comisiones + deps.liquidaciones + deps.sala > 0;
  const dependencias: string[] = [];
  if (deps) {
    if (deps.asignaciones) dependencias.push("asignaciones a curso");
    if (deps.comisiones) dependencias.push("comisiones devengadas");
    if (deps.liquidaciones) dependencias.push("liquidaciones");
    if (deps.sala) dependencias.push("paquetes de sala");
  }

  if (viendo && inicial) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl">Profesor</h3>
          <button onClick={onCerrar} className="text-[var(--texto-tenue)] hover:text-[var(--texto)] text-base">
            Cerrar
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold">
            {nombreCompleto(inicial.contacto)}
            {!inicial.activo && <span className="ml-2 text-sm font-normal text-[var(--texto-tenue)]">(inactivo)</span>}
          </div>
          <TagTipo tipo={inicial.tipo} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Dato etiqueta="WhatsApp">
            <EnlaceWhatsapp numero={inicial.contacto.whatsapp} vacio="—" />
          </Dato>
          <Dato etiqueta="Estilos">{etiquetasDe(inicial.estilos, estilos).join(", ") || "—"}</Dato>
          <div className="sm:col-span-2">
            <span className="block text-sm font-medium text-[var(--texto-tenue)] mb-1.5">
              Tarifas del profesor
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Dato etiqueta="Por clase (como reemplazante)">
                {inicial.tarifa_reemplazo == null ? "Sin cargar" : gs(inicial.tarifa_reemplazo)}
              </Dato>
              <Dato etiqueta="Por hora (clases particulares)">
                {inicial.fee_hora == null ? "Sin cargar" : gs(inicial.fee_hora)}
              </Dato>
            </div>
          </div>
          <Dato etiqueta="Cuenta de acceso">
            {inicial.usuario_id
              ? cuentas.find((c) => c.id === inicial.usuario_id)?.etiqueta ?? "Con cuenta"
              : "Sin cuenta"}
          </Dato>
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
          <p className="text-sm text-[var(--texto-tenue)]">Tu rol puede ver este profesor, no editarlo.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl">{inicial ? "Editar profesor" : "Profesor nuevo"}</h3>
        <button
          onClick={onCancelar}
          className="text-[var(--texto-tenue)] hover:text-[var(--texto)] text-base"
        >
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

      <div>
        <span className="block text-base font-medium mb-1.5">Tarifas del profesor</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Lo que cobra por dictar una clase como reemplazante (regla 20): el
              suplente no entra en el prorrateo, cobra por tarifa. Es la
              referencia que se ofrece al registrar la asistencia; el monto de
              esa clase se confirma ahí. */}
          <Campo etiqueta="Por clase (como reemplazante)">
            <input
              value={tarifaRee}
              onChange={(e) => setTarifaRee(e.target.value)}
              inputMode="decimal"
              placeholder="Sin cargar"
              className="entrada"
            />
            <p className="text-sm text-[var(--texto-tenue)] mt-1">
              Referencia: al registrar una clase dictada por él como reemplazante se propone este
              monto, y ahí se confirma.
            </p>
          </Campo>

          {/* Fee por hora de particulares (0052, C3 H1): lo usa un plan cuya
              forma de pago al profesor sea "fee por hora" (definiciones-v2,
              sección 3a: "el valor del fee vive en el profesor"). */}
          <Campo etiqueta="Por hora (clases particulares)">
            <input
              value={feeHora}
              onChange={(e) => setFeeHora(e.target.value)}
              inputMode="decimal"
              placeholder="Sin cargar"
              className="entrada"
            />
          </Campo>
        </div>
      </div>

      <Campo etiqueta="WhatsApp">
        <input
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          inputMode="tel"
          className="entrada"
        />
        <AbrirChatWhatsapp numero={whatsapp} />
      </Campo>
      {dupe && (
        <div className="p-3 rounded-[var(--radio-panel)] border border-[var(--primario)] bg-[var(--accent-100)] text-[var(--peligro-texto)] text-sm">
          Ese WhatsApp ya es de un profesor: {nombreCompleto(dupe.contacto)} ({dupe.tipo}).
        </div>
      )}

      <div>
        <span className="block text-base font-medium mb-1.5">Estilos</span>
        <div className="flex flex-wrap gap-2">
          {estilos.map((e) => {
            const on = esp.has(e.clave);
            return (
              <button
                key={e.clave}
                type="button"
                onClick={() => toggleEsp(e.clave)}
                className={`px-4 py-2 text-sm rounded-[var(--radio-control)] border transition-colors ${
                  on
                    ? "bg-[var(--exito-fill)] text-[var(--exito-texto)] border-[var(--exito)]"
                    : "bg-[var(--fondo-elevado)] text-[var(--texto-tenue)] border-[var(--borde)] hover:border-[var(--primario)]"
                }`}
              >
                {on ? "✓ " : ""}
                {e.nombre}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-[var(--texto-tenue)] mt-1.5">
          {esp.size
            ? `Dicta ${etiquetasDe([...esp], estilos).join(", ")}.`
            : "Al menos uno: filtra los cursos que se le pueden asignar."}
        </p>
      </div>

      <div>
        <span className="block text-base font-medium mb-1.5">Tipo</span>
        <div className="flex gap-2">
          {(["activo", "externo"] as TipoProfesor[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className={`flex-1 px-4 py-2.5 text-base rounded-[var(--radio-control)] border capitalize ${
                tipo === t
                  ? "bg-[var(--primario)] text-[var(--primario-texto)] border-[var(--primario)] font-semibold"
                  : "border-[var(--borde)] hover:border-[var(--primario)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <p className="text-sm text-[var(--texto-tenue)] mt-1.5">
          {tipo === "activo"
            ? "Activo: paga la tarifa de sala más baja (Profesor Activo)."
            : "Externo: paga la tarifa de sala de Profesor Externo (más alta). Solo alquila la sala; no puede ser titular de curso."}
        </p>
      </div>

      <Campo etiqueta="Cuenta de acceso (opcional)">
        <select
          value={usuarioId ?? ""}
          onChange={(e) => setUsuarioId(e.target.value || null)}
          className="entrada"
        >
          <option value="">Sin cuenta</option>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.etiqueta}
            </option>
          ))}
        </select>
      </Campo>

      <CamposContacto
        niveles={niveles}
        listas={listasContacto}
        valor={extra}
        onChange={setExtra}
        puedeVerPrivados={puedeVerPrivados}
      />

      {dupeDoc && (
        <div className="p-3 rounded-[var(--radio-panel)] border border-[var(--primario)] bg-[var(--accent-100)] text-[var(--peligro-texto)] text-sm">
          Ese documento ya es de un profesor: {nombreCompleto(dupeDoc.contacto)} ({dupeDoc.tipo}).
        </div>
      )}

      {error && (
        <p className="text-[var(--peligro)] text-base" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          onClick={guardar}
          disabled={pendiente || !!dupe || !!dupeDoc || faltanExtra.length > 0}
          className="px-5 py-2.5 text-base font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] hover:bg-[var(--primario-hover)] disabled:opacity-40"
        >
          {pendiente ? "Guardando…" : "Guardar profesor"}
        </button>
      </div>

      {/* Baja: eliminar de verdad si no hay historial; si hay, desactivar. */}
      {permitirBaja && inicial && (
        <div
          className={`mt-2 p-4 rounded-[var(--radio-panel)] border ${
            tieneHistorial
              ? "border-[var(--primario)] bg-[var(--accent-100)]"
              : "border-[var(--borde)] bg-[var(--fondo-elevado)]"
          }`}
        >
          <div className="font-medium">
            {tieneHistorial ? "No se puede eliminar" : "Eliminar profesor"}
          </div>
          <p className="text-sm text-[var(--texto-tenue)] mt-1">
            {tieneHistorial
              ? `Tiene historial dependiente (${dependencias.join(" · ")}). Desactivarlo lo saca de las asignaciones nuevas y conserva todo lo ya registrado.`
              : "Sin historial dependiente: se elimina de verdad, no queda registro."}
          </p>
          <button
            onClick={baja}
            disabled={pendiente}
            className={`mt-3 px-4 py-2 text-base rounded-[var(--radio-control)] border ${
              tieneHistorial
                ? "border-[var(--primario)] text-[var(--primario)]"
                : "border-[var(--peligro)] text-[var(--peligro)]"
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

export function TagTipo({ tipo }: { tipo: TipoProfesor }) {
  return (
    <span
      className={`shrink-0 px-3 py-1 rounded-full text-sm font-medium capitalize ${
        tipo === "activo"
          ? "bg-[var(--exito-fill)] text-[var(--exito-texto)]"
          : "bg-[var(--fondo-elevado)] text-[var(--texto-tenue)]"
      }`}
    >
      {tipo}
    </span>
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
