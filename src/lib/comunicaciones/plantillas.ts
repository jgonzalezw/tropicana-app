/**
 * R20 · E2 — motor de plantillas de comunicaciones. Puro: sin base de datos ni
 * efectos. Sintaxis cerrada, sin código (R45):
 *
 *   {{variable}}                      valor ya formateado por el adaptador
 *   {{variable|mayuscula_inicial}}    filtros de una lista cerrada
 *   {{#si condicion}}…{{#sino}}…{{/si}}
 *   {{#cada lista sep=", " ultimo=" y "}}…{{.}}…{{/cada}}
 *
 * El texto fuera de las llaves se copia tal cual: no se recortan espacios ni se
 * normalizan saltos de línea (la equivalencia es carácter por carácter).
 * Un marcador desconocido, una sintaxis rota o una variable obligatoria vacía
 * NO producen un mensaje a medias: lanzan `ErrorPlantilla`.
 */

export class ErrorPlantilla extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorPlantilla";
  }
}

export type Valor = string | boolean | string[];
export type Datos = Record<string, Valor>;
/** `permiteVacia`: el dato puede ser un texto vacío y se imprime tal cual (comportamiento heredado). */
export type VariableEsquema = { nombre: string; obligatoria?: boolean; permiteVacia?: boolean };
export type Vocabulario = { variables: VariableEsquema[]; condiciones?: string[]; listas?: string[] };

const FILTROS: Record<string, (s: string) => string> = {
  mayuscula_inicial: (s) => s.charAt(0).toUpperCase() + s.slice(1),
};

type Nodo =
  | { t: "texto"; v: string }
  | { t: "var"; nombre: string; filtros: string[] }
  | { t: "item" }
  | { t: "si"; cond: string; si: Nodo[]; sino: Nodo[] }
  | { t: "cada"; lista: string; sep: string; ultimo: string | null; cuerpo: Nodo[] };

const NOMBRE = /^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)*$/;

function atributos(resto: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /\s+([a-z]+)="([^"]*)"/y;
  let fin = 0;
  for (;;) {
    re.lastIndex = fin;
    const m = re.exec(resto);
    if (!m) break;
    out[m[1]] = m[2];
    fin = re.lastIndex;
  }
  if (fin !== resto.length) throw new ErrorPlantilla(`Atributos inválidos: «${resto.trim()}»`);
  return out;
}

export function parsear(plantilla: string): Nodo[] {
  const partes = plantilla.split(/(\{\{[^{}]*\}\})/);
  let i = 0;

  function bloque(cierres: string[]): { nodos: Nodo[]; cierre: string | null } {
    const nodos: Nodo[] = [];
    while (i < partes.length) {
      const p = partes[i++];
      if (!p.startsWith("{{")) {
        if (p.includes("{{") || p.includes("}}")) throw new ErrorPlantilla(`Llaves sin cerrar en «${p}»`);
        if (p !== "") nodos.push({ t: "texto", v: p });
        continue;
      }
      const tag = p.slice(2, -2).trim();
      if (cierres.includes(tag)) return { nodos, cierre: tag };
      if (tag === ".") {
        nodos.push({ t: "item" });
      } else if (tag.startsWith("#si ")) {
        const cond = tag.slice(4).trim();
        if (!NOMBRE.test(cond)) throw new ErrorPlantilla(`Condición inválida: «${cond}»`);
        const a = bloque(["#sino", "/si"]);
        let sino: Nodo[] = [];
        if (a.cierre === "#sino") {
          const b = bloque(["/si"]);
          if (b.cierre !== "/si") throw new ErrorPlantilla(`Falta {{/si}} para «${cond}»`);
          sino = b.nodos;
        } else if (a.cierre !== "/si") throw new ErrorPlantilla(`Falta {{/si}} para «${cond}»`);
        nodos.push({ t: "si", cond, si: a.nodos, sino });
      } else if (tag.startsWith("#cada ")) {
        const m = /^#cada\s+(\S+)(.*)$/.exec(tag);
        if (!m || !NOMBRE.test(m[1])) throw new ErrorPlantilla(`Lista inválida: «${tag}»`);
        const at = atributos(m[2]);
        for (const k of Object.keys(at)) if (k !== "sep" && k !== "ultimo") throw new ErrorPlantilla(`Atributo desconocido «${k}»`);
        const c = bloque(["/cada"]);
        if (c.cierre !== "/cada") throw new ErrorPlantilla(`Falta {{/cada}} para «${m[1]}»`);
        nodos.push({ t: "cada", lista: m[1], sep: at.sep ?? "", ultimo: at.ultimo ?? null, cuerpo: c.nodos });
      } else if (tag.startsWith("#") || tag.startsWith("/")) {
        throw new ErrorPlantilla(`Marcador no permitido aquí: «${tag}»`);
      } else {
        const [nombre, ...filtros] = tag.split("|").map((x) => x.trim());
        if (!NOMBRE.test(nombre)) throw new ErrorPlantilla(`Variable inválida: «${nombre}»`);
        for (const f of filtros) if (!(f in FILTROS)) throw new ErrorPlantilla(`Filtro desconocido: «${f}»`);
        nodos.push({ t: "var", nombre, filtros });
      }
    }
    return { nodos, cierre: null };
  }

  const r = bloque([]);
  if (r.cierre) throw new ErrorPlantilla(`Cierre inesperado «${r.cierre}»`);
  return r.nodos;
}

function recorrer(nodos: Nodo[], f: (n: Nodo) => void) {
  for (const n of nodos) {
    f(n);
    if (n.t === "si") {
      recorrer(n.si, f);
      recorrer(n.sino, f);
    } else if (n.t === "cada") recorrer(n.cuerpo, f);
  }
}

/** Los nombres que la plantilla usa (variables, condiciones y listas). */
export function marcadoresDe(plantilla: string): { variables: string[]; condiciones: string[]; listas: string[] } {
  const v = new Set<string>();
  const c = new Set<string>();
  const l = new Set<string>();
  recorrer(parsear(plantilla), (n) => {
    if (n.t === "var") v.add(n.nombre);
    else if (n.t === "si") c.add(n.cond);
    else if (n.t === "cada") l.add(n.lista);
  });
  return { variables: [...v], condiciones: [...c], listas: [...l] };
}

/** Errores de la plantilla frente al vocabulario permitido (vacío = válida). */
export function validar(plantilla: string, vocabulario: Vocabulario): string[] {
  const errores: string[] = [];
  let m: ReturnType<typeof marcadoresDe>;
  try {
    m = marcadoresDe(plantilla);
  } catch (e) {
    return [(e as Error).message];
  }
  const conocidas = new Set(vocabulario.variables.map((x) => x.nombre));
  for (const v of m.variables) if (!conocidas.has(v)) errores.push(`Variable desconocida: «${v}»`);
  for (const c of m.condiciones) if (!(vocabulario.condiciones ?? []).includes(c)) errores.push(`Condición desconocida: «${c}»`);
  for (const l of m.listas) if (!(vocabulario.listas ?? []).includes(l)) errores.push(`Lista desconocida: «${l}»`);
  for (const x of vocabulario.variables)
    if (x.obligatoria && !m.variables.includes(x.nombre)) errores.push(`Falta la variable obligatoria «${x.nombre}»`);
  return errores;
}

export function renderizar(plantilla: string, datos: Datos, vocabulario?: Vocabulario): string {
  if (vocabulario) {
    const e = validar(plantilla, vocabulario);
    if (e.length) throw new ErrorPlantilla(e.join("; "));
  }
  const nodos = parsear(plantilla);
  const noVacias = new Set((vocabulario?.variables ?? []).filter((x) => x.obligatoria && !x.permiteVacia).map((x) => x.nombre));

  function texto(ns: Nodo[], item: string | null): string {
    let out = "";
    for (const n of ns) {
      if (n.t === "texto") out += n.v;
      else if (n.t === "item") {
        if (item === null) throw new ErrorPlantilla("{{.}} fuera de {{#cada}}");
        out += item;
      } else if (n.t === "var") {
        const v = datos[n.nombre];
        if (typeof v !== "string") {
          if (v === undefined) throw new ErrorPlantilla(`Falta el dato «${n.nombre}»`);
          throw new ErrorPlantilla(`«${n.nombre}» no es un texto`);
        }
        if (v === "" && noVacias.has(n.nombre)) throw new ErrorPlantilla(`«${n.nombre}» es obligatoria y está vacía`);
        out += n.filtros.reduce((s, f) => FILTROS[f](s), v);
      } else if (n.t === "si") {
        const c = datos[n.cond];
        if (typeof c !== "boolean") throw new ErrorPlantilla(`La condición «${n.cond}» no es verdadero/falso`);
        out += texto(c ? n.si : n.sino, item);
      } else {
        const l = datos[n.lista];
        if (!Array.isArray(l)) throw new ErrorPlantilla(`«${n.lista}» no es una lista`);
        l.forEach((x, k) => {
          if (k > 0) out += k === l.length - 1 && n.ultimo !== null ? n.ultimo : n.sep;
          out += texto(n.cuerpo, x);
        });
      }
    }
    return out;
  }
  return texto(nodos, null);
}
