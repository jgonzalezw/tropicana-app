/**
 * R20 · E4b — arma el texto de un aviso a partir de la versión seleccionada
 * (puro). Un fallo NO produce un mensaje a medias: devuelve el motivo.
 *  - `variable_faltante`: falta un dato indispensable o está vacío. La
 *    comunicación se detiene y no admite respaldo (plan v2 §5.3): se completa
 *    el dato y se prepara de nuevo con el mismo contenido.
 *  - `contenido`: sintaxis o marcador inválido en la versión oficial. Único
 *    caso en que un Administrador puede autorizar el respaldo.
 */
import { ErrorPlantilla, renderizar, type Datos } from "../plantillas.ts";
import type { EsquemaCanonico } from "../contenidos/hash.ts";

export type ResultadoRender =
  | { ok: true; texto: string }
  | { ok: false; motivo: "variable_faltante" | "contenido"; detalle: string };

export function renderizarVersion(v: { cuerpo: string; esquema: EsquemaCanonico }, datos: Datos): ResultadoRender {
  try {
    const texto = renderizar(v.cuerpo, datos, {
      variables: v.esquema.variables,
      condiciones: v.esquema.condiciones,
      listas: v.esquema.listas,
    });
    return { ok: true, texto };
  } catch (e) {
    const detalle = e instanceof Error ? e.message : String(e);
    const faltante = e instanceof ErrorPlantilla && (/^Falta el dato /.test(detalle) || /es obligatoria y está vacía$/.test(detalle));
    return { ok: false, motivo: faltante ? "variable_faltante" : "contenido", detalle };
  }
}
