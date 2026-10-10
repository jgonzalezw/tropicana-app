/**
 * R20 · E2 — contenido predeterminado heredado de N09 y N10 (reserva
 * confirmada). Es el texto que arma hoy `crearReserva` (confirmar) y
 * `cambiarEstadoReserva` (→ confirmada), expresado como plantilla.
 *
 * Reglas de la ficha:
 *  - Las variables llegan YA FORMATEADAS por el adaptador (`variablesReservaConfirmada`),
 *    que usa los mismos formateadores que el generador original. La plantilla
 *    no formatea fechas ni horas.
 *  - Las ramas del generador (particular/alquiler, fallbacks de plan y de
 *    nombre) las resuelve el adaptador; la plantilla no tiene condiciones.
 *  - Quién recibe el aviso (dA/dT, profesor solo en particular) NO es parte
 *    del texto: lo decide el código (R37).
 *  - Se reproducen las rarezas del original («Hola!» sin coma, «a ?» sin duración).
 */
import {
  h,
  horario,
  textosDeReserva,
  type TextosDeReserva,
} from "../legado/reserva.ts";

export type EntradaReservaConfirmada = {
  esAlquiler: boolean;
  planNombre: string | null | undefined;
  profesorNombre: string;
  alumnoNombre: string;
  contratadasMin: number;
  disponibleMin: number;
  fecha: string;
  hora: string;
  duracionMin: number;
  lugar: string;
};

export type VariableDePlantilla = {
  nombre: string;
  descripcion: string;
  fuente: string;
  tipo: "texto";
  obligatoria: boolean;
  formato: string;
  ejemplo: string;
  ausencia: string;
};

export const CASOS_RESERVA_CONFIRMADA = {
  alumno: {
    clave: "reserva.confirmada.alumno",
    destinatario: "alumno, tutor o titular (dA / dT)",
    finalidad: "servicio",
    plantilla:
      "Hola! Confirmamos {{reserva.tu_clase}}: {{reserva.cuando}}, en {{reserva.lugar}}. Te quedan {{saldo.disponible_horas}} h de tu {{saldo.paquete}} de {{saldo.contratadas_horas}} h. ¡Te esperamos!",
    variables: [
      "reserva.tu_clase",
      "reserva.cuando",
      "reserva.lugar",
      "saldo.disponible_horas",
      "saldo.paquete",
      "saldo.contratadas_horas",
    ],
  },
  profesor: {
    clave: "reserva.confirmada.profesor",
    destinatario: "profesor de la membresía (solo particular; el alquiler no tiene profesor)",
    finalidad: "servicio",
    plantilla:
      "Hola! Se te confirmó una clase particular ({{reserva.plan}}) con {{alumno.nombre}}: {{reserva.cuando}}, en {{reserva.lugar}}.",
    variables: ["reserva.plan", "alumno.nombre", "reserva.cuando", "reserva.lugar"],
  },
} as const;

export const ESQUEMA_RESERVA_CONFIRMADA: VariableDePlantilla[] = [
  {
    nombre: "reserva.tu_clase",
    descripcion: "Qué se confirma, con el profesor si es una clase particular.",
    fuente: "membresía: tipo (alquiler o particular), plan y profesor",
    tipo: "texto",
    obligatoria: true,
    formato: "«tu clase particular (Plan) con Profesor» o «tu alquiler de sala (Plan)»",
    ejemplo: "tu clase particular (Paquete 10 h) con Mario Rojas",
    ausencia: "El plan faltante se reemplaza por «clases particulares» o «alquiler de sala».",
  },
  {
    nombre: "reserva.plan",
    descripcion: "Nombre del plan de la membresía.",
    fuente: "planes.nombre",
    tipo: "texto",
    obligatoria: true,
    formato: "texto tal cual",
    ejemplo: "Paquete 10 h",
    ausencia: "«clases particulares» (particular) o «alquiler de sala» (alquiler).",
  },
  {
    nombre: "reserva.cuando",
    descripcion: "Día y horario de la reserva.",
    fuente: "reservas_sala: fecha, hora, duración",
    tipo: "texto",
    obligatoria: true,
    formato: "«vie 02/10 de 15:00 a 16:00»; sin duración, «a ?»",
    ejemplo: "vie 02/10 de 15:00 a 16:00",
    ausencia: "Sin duración, termina en «?» (comportamiento heredado).",
  },
  {
    nombre: "reserva.lugar",
    descripcion: "Dónde es la reserva.",
    fuente: "membresia_salas.nombre_descriptivo (lugar externo) o salas.nombre",
    tipo: "texto",
    obligatoria: true,
    formato: "nombre del lugar externo, «Tropicana (Sala)» o «Tropicana»",
    ejemplo: "Tropicana (Sala 1)",
    ausencia: "«Tropicana».",
  },
  {
    nombre: "alumno.nombre",
    descripcion: "Nombre del alumno (o del titular, en un alquiler).",
    fuente: "contactos del alumno o del titular",
    tipo: "texto",
    obligatoria: true,
    formato: "nombre y apellido",
    ejemplo: "Ana Pérez",
    ausencia: "«el alumno» (particular) o «el titular» (alquiler).",
  },
  {
    nombre: "saldo.disponible_horas",
    descripcion: "Horas que le quedan en el paquete o alquiler.",
    fuente: "saldoMembresia().disponibleMin",
    tipo: "texto",
    obligatoria: true,
    formato: "horas sin ceros sobrantes: «7.5», «10», «0.25»",
    ejemplo: "7.5",
    ausencia: "No aplica: siempre hay un número.",
  },
  {
    nombre: "saldo.contratadas_horas",
    descripcion: "Horas contratadas en total.",
    fuente: "saldoMembresia().contratadasMin",
    tipo: "texto",
    obligatoria: true,
    formato: "horas sin ceros sobrantes",
    ejemplo: "10",
    ausencia: "No aplica: siempre hay un número.",
  },
  {
    nombre: "saldo.paquete",
    descripcion: "Cómo se llama lo que se va gastando.",
    fuente: "membresía: tipo",
    tipo: "texto",
    obligatoria: true,
    formato: "«paquete» o «alquiler»",
    ejemplo: "paquete",
    ausencia: "No aplica.",
  },
];

/** Todo lo que las dos plantillas necesitan, ya formateado como el generador original. */
export function variablesReservaConfirmada(e: EntradaReservaConfirmada): Record<string, string> {
  const t: TextosDeReserva = textosDeReserva(e);
  return {
    "reserva.tu_clase": t.tuClase,
    "reserva.plan": t.planNombre,
    "reserva.cuando": horario(e.fecha, e.hora, e.duracionMin),
    "reserva.lugar": e.lugar,
    "alumno.nombre": t.alumnoNombre,
    "saldo.disponible_horas": h(e.disponibleMin),
    "saldo.contratadas_horas": h(e.contratadasMin),
    "saldo.paquete": t.paquete,
  };
}
