"use client";

import { useEffect, useRef, useState } from "react";
import AltaContacto from "./AltaContacto";
import TarjetaContacto from "./TarjetaContacto";
import { ETIQUETA_ROL_CONTACTO, type ContactoResumen } from "@/lib/contactoVenta";
import type { ListasContacto, MatrizMinimo, ModuloClave } from "@/lib/tipos";
import {
  buscarContactos,
  detalleContactoVenta,
  type DetalleContactoVenta,
} from "@/app/(privado)/contactos/accionesVenta";

/**
 * El titular de una venta: buscar entre todos los contactos, crear uno nuevo
 * (persona; organización solo si el flujo la permite) o tomar uno que ya
 * existe con otro rol. Elegido, se muestra en solo lectura con Editar datos
 * y Cambiar. Es la misma pieza para cursos, pruebas, particulares y alquiler.
 */
export default function TitularVenta({
  modulo,
  matriz,
  listas,
  puedeVerPrivados,
  permiteOrganizacion = false,
  rolQueAdquiere = null,
  puedeCrear = true,
  permiteMenor = false,
  enPrueba = false,
  titularId,
  onElegido,
}: {
  modulo: ModuloClave;
  matriz: MatrizMinimo[];
  listas: ListasContacto;
  puedeVerPrivados: boolean;
  permiteOrganizacion?: boolean;
  rolQueAdquiere?: "alumno" | null;
  puedeCrear?: boolean;
  /** Ventas de cursos: el alumno nuevo puede ser un menor con su tutor. */
  permiteMenor?: boolean;
  /** Alta desde una clase de prueba. */
  enPrueba?: boolean;
  /** El contacto elegido hoy (null = ninguno). */
  titularId: number | null;
  /** Avisa el cambio: `detalle` es null cuando se vuelve a elegir. */
  onElegido: (c: ContactoResumen | null, detalle: DetalleContactoVenta | null) => void;
}) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<ContactoResumen[]>([]);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const [buscado, setBuscado] = useState(false);
  const [detalle, setDetalle] = useState<DetalleContactoVenta | null>(null);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);
  const [modoAlta, setModoAlta] = useState(false);
  const [editando, setEditando] = useState(false);
  const turno = useRef(0);
  const espera = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Búsqueda con espera corta; descarta respuestas de una consulta vieja.
  function escribir(texto: string) {
    setQ(texto);
    const mio = ++turno.current;
    clearTimeout(espera.current);
    if (texto.trim().length < 2) {
      setResultados([]);
      setBuscado(false);
      setErrorBusqueda(null);
      return;
    }
    espera.current = setTimeout(async () => {
      const r = await buscarContactos(texto.trim(), { modulo, soloPersonas: !permiteOrganizacion });
      if (mio !== turno.current) return;
      setResultados(r.contactos);
      setErrorBusqueda(r.error ?? null);
      setBuscado(true);
    }, 250);
  }

  // La tarjeta se lee de la base cada vez que cambia el titular.
  useEffect(() => {
    if (titularId == null) return;
    let vigente = true;
    detalleContactoVenta(titularId, modulo).then((r) => {
      if (!vigente) return;
      if (r.error) setErrorDetalle(r.error);
      else if (r.detalle) {
        setDetalle(r.detalle);
        onElegido(r.detalle.resumen, r.detalle);
      }
    });
    return () => {
      vigente = false;
    };
    // onElegido cambia de identidad en cada render del padre: no es una dependencia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titularId, modulo]);

  function elegir(c: ContactoResumen) {
    setModoAlta(false);
    setEditando(false);
    setQ("");
    setResultados([]);
    setBuscado(false);
    onElegido(c, null);
  }

  function cambiar() {
    setDetalle(null);
    setErrorDetalle(null);
    setEditando(false);
    onElegido(null, null);
  }

  if (titularId != null) {
    if (errorDetalle)
      return (
        <div className="space-y-2">
          <p className="text-[var(--peligro-texto)]" role="alert">{errorDetalle}</p>
          <button type="button" onClick={cambiar} className="px-3 py-1.5 text-sm rounded-[var(--radio-control)] border border-[var(--borde)]">
            Elegir otro contacto
          </button>
        </div>
      );
    if (!detalle || detalle.resumen.id !== titularId) return <p className="text-sm text-[var(--texto-tenue)]">Cargando contacto…</p>;
    if (editando)
      return (
        <AltaContacto
          modulo={modulo}
          matriz={matriz}
          listas={listas}
          puedeVerPrivados={puedeVerPrivados}
          edicion={detalle}
          onCancelar={() => setEditando(false)}
          onListo={async (c) => {
            setEditando(false);
            const r = await detalleContactoVenta(c.id, modulo);
            if (r.detalle) {
              setDetalle(r.detalle);
              onElegido(r.detalle.resumen, r.detalle);
            }
          }}
        />
      );
    return <TarjetaContacto detalle={detalle} redesDisponibles={listas.redesDisponibles} rolQueAdquiere={rolQueAdquiere} onCambiar={cambiar} onEditar={() => setEditando(true)} />;
  }

  if (modoAlta)
    return (
      <AltaContacto
        modulo={modulo}
        matriz={matriz}
        listas={listas}
        puedeVerPrivados={puedeVerPrivados}
        permiteOrganizacion={permiteOrganizacion}
        rolQueAdquiere={rolQueAdquiere}
        permiteMenor={permiteMenor}
        enPrueba={enPrueba}
        onCancelar={() => setModoAlta(false)}
        onListo={elegir}
      />
    );

  return (
    <div className="space-y-3">
      <input
        value={q}
        onChange={(e) => escribir(e.target.value)}
        placeholder={permiteOrganizacion ? "Buscar por nombre, razón social, WhatsApp o documento" : "Buscar por nombre, WhatsApp o documento"}
        className="w-full px-3 py-2 text-base rounded-[var(--radio-control)] border border-[var(--borde)] bg-transparent"
        aria-label="Buscar contacto"
      />
      {errorBusqueda && <p className="text-[var(--peligro-texto)]" role="alert">{errorBusqueda}</p>}
      {resultados.length > 0 && (
        <ul className="rounded-[var(--radio-panel)] border border-[var(--borde)] divide-y divide-[var(--borde)]">
          {resultados.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => elegir(c)} className="w-full text-left px-4 py-2.5 hover:bg-[var(--accent-100)]">
                <span className="font-medium">{c.nombre}</span>{" "}
                <span className="text-sm text-[var(--texto-tenue)]">
                  · {ETIQUETA_ROL_CONTACTO[c.rol]}
                  {c.whatsapp ? ` · ${c.whatsapp}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {buscado && !errorBusqueda && resultados.length === 0 && (
        <p className="text-sm text-[var(--texto-tenue)]">No hay ningún contacto con eso.</p>
      )}
      {puedeCrear ? (
        <button type="button" onClick={() => setModoAlta(true)} className="px-4 py-2 text-sm rounded-[var(--radio-control)] border border-[var(--primario)] text-[var(--primario)]">
          + Nuevo contacto
        </button>
      ) : (
        <p className="text-sm text-[var(--texto-tenue)]">Tu rol no puede crear contactos: pedile a quien administra que lo cargue.</p>
      )}
    </div>
  );
}
