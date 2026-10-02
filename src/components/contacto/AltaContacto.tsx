"use client";

import { useMemo, useState, useTransition } from "react";
import CamposContacto from "@/components/entidades/CamposContacto";
import PanelDuplicado from "./PanelDuplicado";
import { nivelesDe } from "@/lib/matrizMinimos";
import { contextoTercero, faltantesAlta, textoFaltaAlta, type ContactoResumen } from "@/lib/contactoVenta";
import type { DatosContactoExtra, ListasContacto, MatrizMinimo, ModuloClave, TipoContacto } from "@/lib/tipos";
import {
  actualizarContactoVenta,
  crearContacto,
  type DetalleContactoVenta,
  type ResultadoCrearContacto,
} from "@/app/(privado)/contactos/accionesVenta";

const EXTRA_VACIO: DatosContactoExtra = {
  email: null,
  sexo: null,
  redes: [],
  documento: null,
  fecha_nacimiento: null,
  consentimiento: null,
};

const INPUT = "w-full px-3 py-2 text-base rounded-[var(--radio-control)] border border-[var(--borde)] bg-transparent";

/**
 * Alta y edición de un contacto con el mismo formulario, en cualquier venta.
 * El selector Persona/Organización aparece solo si el flujo permite
 * organización (alquiler, servicios especiales). Guardar queda deshabilitado
 * mientras falte algo que la matriz exige (regla de calidad 9); el servidor
 * valida con la misma función.
 */
export default function AltaContacto({
  modulo,
  matriz,
  listas,
  puedeVerPrivados,
  permiteOrganizacion = false,
  rolQueAdquiere = null,
  edicion,
  onListo,
  onCancelar,
}: {
  modulo: ModuloClave;
  matriz: MatrizMinimo[];
  listas: ListasContacto;
  puedeVerPrivados: boolean;
  permiteOrganizacion?: boolean;
  /** Rol que el contacto adquiere al crearse (cursos y particulares: alumno). */
  rolQueAdquiere?: "alumno" | null;
  /** Si viene, el formulario edita ese contacto en vez de crear uno. */
  edicion?: DetalleContactoVenta;
  onListo: (c: ContactoResumen) => void;
  onCancelar: () => void;
}) {
  const [tipo, setTipo] = useState<TipoContacto>(edicion?.resumen.tipo ?? "persona");
  const [nombre, setNombre] = useState(edicion?.nombre ?? "");
  const [apellido, setApellido] = useState(edicion?.apellido ?? "");
  const [razonSocial, setRazonSocial] = useState(edicion?.razonSocial ?? "");
  const [whatsapp, setWhatsapp] = useState(edicion?.resumen.whatsapp ?? "");
  const [extra, setExtra] = useState<DatosContactoExtra>(edicion?.extra ?? EXTRA_VACIO);
  const [persNombre, setPersNombre] = useState("");
  const [persWhatsapp, setPersWhatsapp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dup, setDup] = useState<NonNullable<ResultadoCrearContacto["duplicado"]> | null>(null);
  const [pendiente, empezar] = useTransition();

  const niveles = useMemo(() => nivelesDe(matriz, contextoTercero(tipo)), [matriz, tipo]);
  const form = { tipo, nombre, apellido, razonSocial, whatsapp, extra };
  const falta = textoFaltaAlta(faltantesAlta(form, niveles), form);
  const esOrg = tipo === "organizacion";

  function guardar() {
    setError(null);
    setDup(null);
    empezar(async () => {
      const r = edicion
        ? await actualizarContactoVenta({ modulo, contactoId: edicion.resumen.id, nombre, apellido, razonSocial, whatsapp, extra })
        : await crearContacto({
            modulo,
            tipo,
            nombre,
            apellido,
            razonSocial,
            whatsapp,
            extra,
            rol: tipo === "persona" ? rolQueAdquiere : null,
            personaContacto: esOrg && persNombre.trim() ? { nombre: persNombre, whatsapp: persWhatsapp } : null,
          });
      if (r.error) return setError(r.error);
      if (r.duplicado) return setDup(r.duplicado);
      if (r.contacto) onListo(r.contacto);
    });
  }

  return (
    <div className="space-y-4 p-4 rounded-[var(--radio-panel)] border border-[var(--borde)]">
      <div className="font-semibold">{edicion ? "Editar datos del contacto" : esOrg ? "Nueva organización" : "Nuevo contacto"}</div>

      {!edicion && permiteOrganizacion && (
        <div className="flex gap-2" role="radiogroup" aria-label="Tipo de contacto">
          {(["persona", "organizacion"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tipo === t}
              onClick={() => {
                setTipo(t);
                // Una organización se identifica con NIT; una persona, con otro documento.
                if (!extra.documento?.numero)
                  setExtra({ ...extra, documento: t === "organizacion" ? { tipo_documento: "nit", numero: "", complemento: null, expedido: null } : null });
              }}
              className={`px-4 py-2 text-sm rounded-[var(--radio-control)] border ${
                tipo === t ? "border-[var(--primario)] bg-[var(--accent-100)] font-semibold" : "border-[var(--borde)]"
              }`}
            >
              {t === "persona" ? "Persona" : "Organización"}
            </button>
          ))}
        </div>
      )}

      {esOrg ? (
        <label className="block">
          <span className="block text-base font-medium mb-1.5">Razón social</span>
          <input className={INPUT} value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} />
        </label>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="block text-base font-medium mb-1.5">Nombre</span>
            <input className={INPUT} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </label>
          {niveles.apellido !== "-" && (
            <label className="block">
              <span className="block text-base font-medium mb-1.5">Apellido</span>
              <input className={INPUT} value={apellido} onChange={(e) => setApellido(e.target.value)} />
            </label>
          )}
        </div>
      )}

      <label className="block">
        <span className="block text-base font-medium mb-1.5">WhatsApp</span>
        <input
          className={INPUT}
          inputMode="tel"
          placeholder="+591 7…"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
        />
      </label>

      <CamposContacto niveles={niveles} listas={listas} valor={extra} onChange={setExtra} puedeVerPrivados={puedeVerPrivados} />

      {esOrg && !edicion && (
        <fieldset className="space-y-3">
          <legend className="text-base font-medium mb-1.5">Persona de contacto (opcional)</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className={INPUT} placeholder="Nombre" value={persNombre} onChange={(e) => setPersNombre(e.target.value)} />
            <input
              className={INPUT}
              placeholder="WhatsApp"
              inputMode="tel"
              value={persWhatsapp}
              onChange={(e) => setPersWhatsapp(e.target.value)}
            />
          </div>
        </fieldset>
      )}

      {dup && (
        <PanelDuplicado por={dup.por} contacto={dup.contacto} onUsar={() => onListo(dup.contacto)} onOtro={() => setDup(null)} />
      )}
      {error && (
        <p className="text-[var(--peligro-texto)]" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={pendiente || !!falta || !!dup}
          className="px-4 py-2 text-base font-semibold rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] disabled:opacity-40"
        >
          {pendiente ? "Guardando…" : edicion ? "Guardar cambios" : "Crear contacto"}
        </button>
        <button type="button" onClick={onCancelar} className="px-4 py-2 text-base rounded-[var(--radio-control)] border border-[var(--borde)]">
          Cancelar
        </button>
        {falta && <span className="text-sm text-[var(--texto-tenue)]">{falta}</span>}
      </div>
    </div>
  );
}
