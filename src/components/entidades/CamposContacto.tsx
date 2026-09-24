"use client";

import type {
  CampoMinimo,
  DatosContactoExtra,
  ListasContacto,
  NivelMinimo,
  RedSocial,
  TipoDocumento,
} from "@/lib/tipos";
export type { ListasContacto } from "@/lib/tipos";

/**
 * Los campos "extra" de un contacto (C3-0a.3): red social, email, documento,
 * fecha de nacimiento y consentimiento. Se montan o no, y se marcan
 * obligatorios o no, según la matriz de mínimos del contexto — `niveles` ya
 * viene resuelto por `nivelesDe()` (`@/lib/matrizMinimos`). Pieza
 * reutilizable (regla de proceso 4): la misma en `FichaAlumno` y
 * `FichaProfesor`.
 */
export default function CamposContacto({
  niveles,
  listas,
  valor,
  onChange,
  puedeVerPrivados,
}: {
  niveles: Record<CampoMinimo, NivelMinimo>;
  listas: ListasContacto;
  valor: DatosContactoExtra;
  onChange: (v: DatosContactoExtra) => void;
  /** Si el rol no tiene el permiso `contactos_privados` (documento/nacimiento son datos sensibles). */
  puedeVerPrivados: boolean;
}) {
  return (
    <>
      {niveles.red_social !== "-" && (
        <CampoExtra etiqueta="Redes sociales" obligatorio={niveles.red_social === "O"}>
          <RedesSociales
            redes={valor.redes}
            disponibles={listas.redesDisponibles}
            onChange={(redes) => onChange({ ...valor, redes })}
          />
        </CampoExtra>
      )}

      {niveles.email !== "-" && (
        <CampoExtra etiqueta="Email" obligatorio={niveles.email === "O"}>
          <input
            type="email"
            value={valor.email ?? ""}
            onChange={(e) => onChange({ ...valor, email: e.target.value || null })}
            className="entrada"
          />
        </CampoExtra>
      )}

      {niveles.sexo !== "-" && (
        <CampoExtra etiqueta="Sexo" obligatorio={niveles.sexo === "O"}>
          <select
            value={valor.sexo ?? ""}
            onChange={(e) => onChange({ ...valor, sexo: e.target.value || null })}
            className="entrada"
          >
            <option value="">— Sin definir —</option>
            {listas.sexoOpciones.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.etiqueta}
              </option>
            ))}
          </select>
        </CampoExtra>
      )}

      {niveles.documento !== "-" && (
        <CampoExtra etiqueta="Documento" obligatorio={niveles.documento === "O"}>
          {!puedeVerPrivados ? (
            <p className="text-sm text-[var(--texto-tenue)] bg-[var(--fondo-elevado)] border border-[var(--borde)] rounded-[var(--radio-panel)] px-3 py-2">
              {niveles.documento === "O" ? "Obligatorio, pero " : ""}
              tu rol no puede cargar datos privados de un contacto.
            </p>
          ) : (
            <DocumentoContacto
              valor={valor.documento}
              tipos={listas.tiposDocumento}
              onChange={(documento) => onChange({ ...valor, documento })}
            />
          )}
        </CampoExtra>
      )}

      {niveles.nacimiento !== "-" && (
        <CampoExtra etiqueta="Fecha de nacimiento" obligatorio={niveles.nacimiento === "O"}>
          {!puedeVerPrivados ? (
            <p className="text-sm text-[var(--texto-tenue)] bg-[var(--fondo-elevado)] border border-[var(--borde)] rounded-[var(--radio-panel)] px-3 py-2">
              {niveles.nacimiento === "O" ? "Obligatorio, pero " : ""}
              tu rol no puede cargar datos privados de un contacto.
            </p>
          ) : (
            <input
              type="date"
              value={valor.fecha_nacimiento ?? ""}
              onChange={(e) => onChange({ ...valor, fecha_nacimiento: e.target.value || null })}
              className="entrada"
            />
          )}
        </CampoExtra>
      )}

      {niveles.consentimiento !== "-" && (
        <CampoExtra etiqueta="Consentimiento" obligatorio={niveles.consentimiento === "O"}>
          <Consentimiento
            valor={valor.consentimiento}
            medios={listas.mediosConsentimiento}
            texto={listas.textoPolitica}
            onChange={(consentimiento) => onChange({ ...valor, consentimiento })}
          />
        </CampoExtra>
      )}
    </>
  );
}

function RedesSociales({
  redes,
  disponibles,
  onChange,
}: {
  redes: { red: string; usuario: string }[];
  disponibles: RedSocial[];
  onChange: (redes: { red: string; usuario: string }[]) => void;
}) {
  function set(i: number, campo: "red" | "usuario", val: string) {
    const nuevas = redes.slice();
    nuevas[i] = { ...nuevas[i], [campo]: val };
    onChange(nuevas);
  }
  function quitar(i: number) {
    onChange(redes.filter((_, j) => j !== i));
  }
  return (
    <div className="space-y-2">
      {redes.map((r, i) => (
        <div key={i} className="flex gap-2">
          <select
            value={r.red}
            onChange={(e) => set(i, "red", e.target.value)}
            className="entrada max-w-[160px] shrink-0"
          >
            {disponibles.map((d) => (
              <option key={d.clave} value={d.clave}>
                {d.nombre}
              </option>
            ))}
          </select>
          <input
            value={r.usuario}
            onChange={(e) => set(i, "usuario", e.target.value)}
            placeholder="@usuario"
            className="entrada flex-1 min-w-0"
          />
          <button
            type="button"
            onClick={() => quitar(i)}
            className="px-3 shrink-0 text-[var(--texto-tenue)] hover:text-[var(--peligro)]"
          >
            Quitar
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...redes, { red: disponibles[0]?.clave ?? "", usuario: "" }])}
        disabled={disponibles.length === 0}
        className="text-[var(--primario)] text-sm disabled:opacity-40"
      >
        + Agregar red
      </button>
    </div>
  );
}

function DocumentoContacto({
  valor,
  tipos,
  onChange,
}: {
  valor: DatosContactoExtra["documento"];
  tipos: TipoDocumento[];
  onChange: (v: DatosContactoExtra["documento"]) => void;
}) {
  const v = valor ?? { tipo_documento: tipos[0]?.clave ?? "", numero: "", complemento: null, expedido: null };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <select
        value={v.tipo_documento}
        onChange={(e) => onChange({ ...v, tipo_documento: e.target.value })}
        className="entrada"
      >
        {tipos.map((t) => (
          <option key={t.clave} value={t.clave}>
            {t.nombre}
          </option>
        ))}
      </select>
      <input
        value={v.numero}
        onChange={(e) => onChange({ ...v, numero: e.target.value })}
        placeholder="Número"
        className="entrada"
      />
      <input
        value={v.complemento ?? ""}
        onChange={(e) => onChange({ ...v, complemento: e.target.value || null })}
        placeholder="Complemento (opcional)"
        className="entrada"
      />
    </div>
  );
}

function Consentimiento({
  valor,
  medios,
  texto,
  onChange,
}: {
  valor: DatosContactoExtra["consentimiento"];
  medios: { valor: string; etiqueta: string }[];
  texto: string;
  onChange: (v: DatosContactoExtra["consentimiento"]) => void;
}) {
  const otorgado = valor?.otorgado ?? false;
  const medio = valor?.medio ?? medios[0]?.valor ?? "";
  return (
    <div className="space-y-2">
      {texto && <p className="text-sm text-[var(--texto-tenue)]">{texto}</p>}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={otorgado}
          onChange={(e) => onChange({ otorgado: e.target.checked, medio })}
        />
        <span>Otorgó el consentimiento</span>
      </label>
      <select
        value={medio}
        onChange={(e) => onChange({ otorgado, medio: e.target.value })}
        className="entrada"
      >
        {medios.map((m) => (
          <option key={m.valor} value={m.valor}>
            {m.etiqueta}
          </option>
        ))}
      </select>
    </div>
  );
}

function CampoExtra({
  etiqueta,
  obligatorio,
  children,
}: {
  etiqueta: string;
  obligatorio: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-base font-medium mb-1.5">
        {etiqueta}
        {obligatorio ? " *" : " (opcional)"}
      </span>
      {children}
    </label>
  );
}

/** Valor inicial vacío — lo usan las fichas de alumno/profesor al crear. */
export const DATOS_CONTACTO_EXTRA_VACIO: DatosContactoExtra = {
  email: null,
  sexo: null,
  redes: [],
  documento: null,
  fecha_nacimiento: null,
  consentimiento: null,
};
