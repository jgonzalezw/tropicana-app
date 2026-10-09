// Qué secciones del shell ve una persona. Agrupa los permisos que hoy
// resuelve `layout.tsx` uno por uno. En la fase 1a solo decide «Membresías»;
// el shell completo (Hoy · Agenda · Membresías · Administración · Ajustes)
// lo va a usar cuando existan Hoy y Agenda. Función pura: la lectura de
// permisos y del interruptor vive en `obtenerSeccionesVisibles` (sesion.ts).

export type PermisosShell = {
  alumnos: boolean;
  particulares: boolean;
  alquileres: boolean;
};

export type InterruptoresShell = {
  /** Parámetro `membresias_nuevas` (0067). */
  membresiasNuevas: boolean;
};

export type SeccionesVisibles = {
  membresias: boolean;
};

export function seccionesVisibles(
  permisos: PermisosShell,
  interruptores: InterruptoresShell
): SeccionesVisibles {
  return {
    membresias:
      interruptores.membresiasNuevas &&
      (permisos.alumnos || permisos.particulares || permisos.alquileres),
  };
}
