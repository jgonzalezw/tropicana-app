/**
 * La categoría con la que un cliente entra a la tabla de precios de alquiler
 * de sala (regla de negocio 24, definiciones v2 §2).
 *
 * **El sistema propone, y dice por qué.** Se deduce de lo que ya se sabe del
 * contacto, en este orden —el primero que se cumple gana—:
 *
 *   1. **Alumno**: tiene una membresía activa de curso regular o de clases
 *      particulares, o cerró alguna hace `diasGracia` días o menos.
 *   2. **Profesor de Tropicana**: tiene cursos regulares asignados vigentes,
 *      o planes de particulares activos dictados por él, o los cerró hace
 *      `diasGracia` días o menos.
 *   3. **Profesor externo**: es profesor, pero no cumple lo anterior.
 *   4. **Tercero**: persona o empresa que no cumple ninguna.
 *
 * Es una función **pura**: recibe los hechos ya leídos y devuelve la categoría
 * con su motivo. Leer los hechos es del servidor; decidir es de acá, para que
 * se pueda probar sin base.
 *
 * Decisión de lectura (a confirmar con Natalia): **la clase de prueba no hace
 * alumno**. Es una membresía preliminar, no un compromiso con la academia; si
 * contara, cualquiera que probó una clase pagaría tarifa de alumno de por vida
 * (bueno, los días de gracia) sin haberse inscrito.
 */
import type { CategoriaSala } from "./sala.ts";

/** Una membresía, en lo único que importa acá: su estado y cuándo termina. */
export type MembresiaParaCategoria = {
  estado: string;
  fecha_fin: string | null;
};

/** Una asignación de un profesor a un curso: `hasta` null = sigue vigente. */
export type AsignacionParaCategoria = { hasta: string | null };

export type EntradaCategoria = {
  /** Hoy, en ISO (YYYY-MM-DD). */
  hoy: string;
  /** Parámetro `categoria_gracia_dias`. */
  diasGracia: number;
  /** Membresías del contacto como alumno: cursos regulares y particulares,
   *  **sin** pruebas ni alquileres. */
  comoAlumno: MembresiaParaCategoria[];
  /** El contacto tiene fila de profesor. */
  esProfesor: boolean;
  /** Sus asignaciones a cursos regulares. */
  asignaciones: AsignacionParaCategoria[];
  /** Las membresías de particulares que dicta como profesor. */
  particularesComoProfesor: MembresiaParaCategoria[];
};

export type PropuestaCategoria = {
  categoria: CategoriaSala;
  /** Por qué: una frase que la persona que vende puede leer y verificar. */
  motivo: string;
};

function restarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const f = new Date(Date.UTC(y, m - 1, d));
  f.setUTCDate(f.getUTCDate() - dias);
  return f.toISOString().slice(0, 10);
}

/** Activa, o terminó dentro de la ventana de gracia. */
function vigenteORecienteMembresia(m: MembresiaParaCategoria, desde: string): "activa" | "reciente" | null {
  if (m.estado === "activa") return "activa";
  if (m.estado === "baja") return null;
  return m.fecha_fin != null && m.fecha_fin >= desde ? "reciente" : null;
}

export function proponerCategoria(e: EntradaCategoria): PropuestaCategoria {
  const gracia = Math.max(0, Math.trunc(e.diasGracia));
  const desde = restarDias(e.hoy, gracia);
  const diasTxt = `${gracia} ${gracia === 1 ? "día" : "días"} de gracia`;

  // 1. Alumno
  const hechosAlumno = e.comoAlumno.map((m) => vigenteORecienteMembresia(m, desde));
  if (hechosAlumno.includes("activa"))
    return { categoria: "alumno", motivo: "Tiene una membresía activa de curso regular o de clases particulares." };
  if (hechosAlumno.includes("reciente"))
    return {
      categoria: "alumno",
      motivo: `Cerró una membresía de curso o de clases particulares hace poco (dentro de los ${diasTxt}).`,
    };

  // 2. Profesor de Tropicana
  if (e.esProfesor) {
    if (e.asignaciones.some((a) => a.hasta == null))
      return { categoria: "profesor_tropicana", motivo: "Tiene cursos regulares asignados vigentes en Tropicana." };
    if (e.particularesComoProfesor.some((m) => vigenteORecienteMembresia(m, desde) === "activa"))
      return { categoria: "profesor_tropicana", motivo: "Tiene un plan de clases particulares activo vendido por Tropicana." };
    if (
      e.asignaciones.some((a) => a.hasta != null && a.hasta >= desde) ||
      e.particularesComoProfesor.some((m) => vigenteORecienteMembresia(m, desde) === "reciente")
    )
      return {
        categoria: "profesor_tropicana",
        motivo: `Terminó hace poco un curso o un plan de particulares con Tropicana (dentro de los ${diasTxt}).`,
      };

    // 3. Profesor externo
    return {
      categoria: "profesor_externo",
      motivo: "Es profesor, pero no tiene cursos ni planes de particulares vigentes en Tropicana.",
    };
  }

  // 4. Tercero
  return { categoria: "tercero", motivo: "No es alumno ni profesor de Tropicana." };
}
