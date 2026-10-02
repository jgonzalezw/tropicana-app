/**
 * Lo que una pieza de gestión le cuenta a la barra fija de la vista de trabajo
 * de /sala (`VistaGestion`): cuál es la acción elegida, si ya se puede
 * confirmar y qué falta. La pieza hija dibuja sus campos y el efecto de la
 * acción; la barra de abajo es la única que confirma o cancela.
 */
export type AccionPendiente = {
  /** Nombre de la acción, tal cual va en el botón primario: "Suspender esta clase". */
  etiqueta: string;
  /** Acción que quita o cancela algo: el botón primario se pinta de peligro. */
  peligro?: boolean;
  /** `false` mientras falte un dato obligatorio (regla de calidad 9). */
  puede: boolean;
  /** Lo primero que falta, en una frase; `null` si la acción está completa. */
  falta: string | null;
  ejecutando: boolean;
  confirmar: () => void;
  /** Descartar la acción elegida sin ejecutarla. */
  cancelar: () => void;
};
