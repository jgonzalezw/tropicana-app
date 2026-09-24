"use client";

import type { CampoMinimo, DatosContactoExtra, ListasContacto, NivelMinimo } from "@/lib/tipos";
import { edadDesde, urlPerfilRed } from "@/lib/contactos";
import IconoRed from "./IconoRed";

export type ModoFicha = "ver" | "editar";

/**
 * La ficha de un contacto para VER, sin campos editables: es como se abre al
 * elegir a alguien de la búsqueda (Javier, 2026-09-24: "no debe ir directo a
 * modo de edición, sino de visualización"). Los mismos campos extra que
 * `CamposContacto`, con la misma matriz de mínimos: lo que la matriz oculta
 * no se muestra, salvo que tenga un dato cargado.
 */
export default function VistaContacto({
  niveles,
  listas,
  valor,
  puedeVerPrivados,
  cargando,
}: {
  niveles: Record<CampoMinimo, NivelMinimo>;
  listas: ListasContacto;
  valor: DatosContactoExtra;
  puedeVerPrivados: boolean;
  /** Redes, documento, nacimiento y consentimiento llegan aparte (`detalleContacto`). */
  cargando: boolean;
}) {
  const ver = (campo: CampoMinimo, tieneDato: boolean) => niveles[campo] !== "-" || tieneDato;
  const pendiente = <span className="text-[var(--texto-tenue)]">cargando…</span>;
  const sinPermiso = <span className="text-[var(--texto-tenue)]">tu rol no puede ver datos privados</span>;
  const tipoDoc = listas.tiposDocumento.find((t) => t.clave === valor.documento?.tipo_documento);

  return (
    <>
      {ver("red_social", valor.redes.length > 0) && (
        <Dato etiqueta="Redes sociales">
          {cargando ? (
            pendiente
          ) : valor.redes.length === 0 ? (
            "—"
          ) : (
            <ul className="space-y-1">
              {valor.redes.map((r, i) => {
                const d = listas.redesDisponibles.find((x) => x.clave === r.red);
                const url = d ? urlPerfilRed(d.patron_url, d.clave, r.usuario) : null;
                return (
                  <li key={i} className="flex items-center gap-2">
                    <IconoRed red={r.red} nombre={d?.nombre ?? r.red} className="w-4 h-4 shrink-0" />
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--primario)] hover:underline"
                      >
                        {r.usuario} ↗
                      </a>
                    ) : (
                      <span>{r.usuario}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Dato>
      )}

      {ver("email", !!valor.email) && <Dato etiqueta="Email">{valor.email || "—"}</Dato>}

      {ver("sexo", !!valor.sexo) && (
        <Dato etiqueta="Sexo">
          {valor.sexo ? listas.sexoOpciones.find((s) => s.valor === valor.sexo)?.etiqueta ?? valor.sexo : "—"}
        </Dato>
      )}

      {ver("documento", !!valor.documento) && (
        <Dato etiqueta="Documento">
          {!puedeVerPrivados
            ? sinPermiso
            : cargando
              ? pendiente
              : valor.documento
                ? [tipoDoc?.nombre ?? valor.documento.tipo_documento, valor.documento.numero, valor.documento.complemento]
                    .filter(Boolean)
                    .join(" · ")
                : "—"}
        </Dato>
      )}

      {ver("nacimiento", !!valor.fecha_nacimiento) && (
        <Dato etiqueta="Fecha de nacimiento">
          {!puedeVerPrivados
            ? sinPermiso
            : cargando
              ? pendiente
              : valor.fecha_nacimiento
                ? `${fechaDMY(valor.fecha_nacimiento)} (${edadDesde(valor.fecha_nacimiento)} años)`
                : "—"}
        </Dato>
      )}

      {ver("consentimiento", !!valor.consentimiento) && (
        <Dato etiqueta="Consentimiento">
          {cargando
            ? pendiente
            : !valor.consentimiento
              ? "Sin registrar"
              : `${valor.consentimiento.otorgado ? "Otorgado" : "No otorgado"} · ${
                  listas.mediosConsentimiento.find((m) => m.valor === valor.consentimiento!.medio)?.etiqueta ??
                  valor.consentimiento.medio
                }`}
        </Dato>
      )}
    </>
  );
}

function fechaDMY(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** Un dato de la ficha en modo ver: etiqueta chica arriba, valor abajo. */
export function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm text-[var(--texto-tenue)] mb-0.5">{etiqueta}</div>
      <div className="text-base">{children}</div>
    </div>
  );
}
