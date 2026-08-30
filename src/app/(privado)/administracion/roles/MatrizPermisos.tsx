"use client";

import { useState, useTransition } from "react";
import {
  MODULOS,
  ACCIONES,
  ETIQUETA_MODULO,
  ETIQUETA_ACCION,
  type Rol,
  type RolPermiso,
} from "@/lib/tipos";
import {
  PLANTILLAS,
  permitidoEnPlantilla,
  type ClavePlantilla,
} from "@/lib/plantillas";
import { alternarPermiso, aplicarPlantilla } from "./acciones";

export default function MatrizPermisos({
  roles,
  permisos,
}: {
  roles: Rol[];
  permisos: RolPermiso[];
}) {
  const [rolActivo, setRolActivo] = useState<number>(roles[0]?.id ?? 0);

  return (
    <div>
      <div className="flex gap-2 mb-6 flex-wrap">
        {roles.map((r) => (
          <button
            key={r.id}
            onClick={() => setRolActivo(r.id)}
            className={`px-4 py-2 text-base rounded-[var(--radio-control)] border transition-colors ${
              rolActivo === r.id
                ? "bg-[var(--primario)] text-[var(--primario-texto)] border-[var(--primario)] font-semibold"
                : "border-[var(--borde)] hover:border-[var(--primario)]"
            }`}
          >
            {r.nombre}
          </button>
        ))}
      </div>

      <TablaRol
        key={rolActivo}
        rolId={rolActivo}
        permisos={permisos.filter((p) => p.rol_id === rolActivo)}
      />
    </div>
  );
}

function TablaRol({
  rolId,
  permisos,
}: {
  rolId: number;
  permisos: RolPermiso[];
}) {
  const inicial = new Map<string, boolean>();
  for (const p of permisos) inicial.set(`${p.modulo}:${p.accion}`, p.permitido);

  const [estado, setEstado] = useState(inicial);
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(modulo: string, accion: string) {
    const clave = `${modulo}:${accion}`;
    const nuevo = !estado.get(clave);
    setEstado((prev) => new Map(prev).set(clave, nuevo));
    setError(null);
    startTransition(async () => {
      const res = await alternarPermiso(rolId, modulo, accion, nuevo);
      if (res?.error) {
        setError(res.error);
        setEstado((prev) => new Map(prev).set(clave, !nuevo));
      }
    });
  }

  function usarPlantilla(plantilla: ClavePlantilla) {
    const previo = estado;
    // Calcula el nuevo estado localmente para feedback instantáneo.
    const nuevo = new Map<string, boolean>();
    for (const m of MODULOS)
      for (const a of ACCIONES)
        nuevo.set(`${m}:${a}`, permitidoEnPlantilla(plantilla, m, a));
    setEstado(nuevo);
    setError(null);
    startTransition(async () => {
      const res = await aplicarPlantilla(rolId, plantilla);
      if (res?.error) {
        setError(res.error);
        setEstado(previo);
      }
    });
  }

  return (
    <div>
      <div className="bg-[var(--fondo-elevado)] border border-[var(--borde)] rounded-[var(--radio-panel)] p-4 mb-4">
        <div className="text-base font-medium mb-2">Aplicar plantilla</div>
        <div className="flex flex-wrap gap-2">
          {PLANTILLAS.map((p) => (
            <button
              key={p.clave}
              onClick={() => usarPlantilla(p.clave)}
              disabled={pendiente}
              title={p.descripcion}
              className="px-4 py-1.5 text-base rounded-[var(--radio-control)] border border-[var(--borde)] hover:border-[var(--primario)] disabled:opacity-40"
            >
              {p.nombre}
            </button>
          ))}
        </div>
        <p className="text-sm text-[var(--texto-tenue)] mt-2">
          Una plantilla reemplaza todos los permisos del rol. Después podés
          ajustar casillas puntuales.
        </p>
      </div>

      <div className="bg-[var(--fondo-panel)] border border-[var(--borde)] rounded-[var(--radio-tarjeta)] overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="text-sm uppercase tracking-wider text-[var(--texto-tenue)]">
            <th className="py-3 px-4 font-medium">Módulo</th>
            {ACCIONES.map((a) => (
              <th key={a} className="py-3 px-4 font-medium text-center">
                {ETIQUETA_ACCION[a]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MODULOS.map((m) => (
            <tr key={m} className="border-t border-[var(--borde)]">
              <td className="py-3 px-4 font-medium">{ETIQUETA_MODULO[m]}</td>
              {ACCIONES.map((a) => {
                const activo = estado.get(`${m}:${a}`) ?? false;
                return (
                  <td key={a} className="py-3 px-4 text-center">
                    <button
                      onClick={() => toggle(m, a)}
                      disabled={pendiente}
                      aria-pressed={activo}
                      aria-label={`${ETIQUETA_ACCION[a]} ${ETIQUETA_MODULO[m]}`}
                      className={`w-7 h-7 rounded-[10px] border-2 transition-colors ${
                        activo
                          ? "bg-[var(--primario)] border-[var(--primario)]"
                          : "border-[var(--borde)] hover:border-[var(--texto-tenue)]"
                      }`}
                    >
                      {activo && (
                        <span className="text-[var(--primario-texto)] text-sm font-bold leading-none">
                          ✓
                        </span>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
        {error && (
          <p className="text-[var(--peligro)] text-base p-4" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
