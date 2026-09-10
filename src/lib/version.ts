/**
 * Info de release para mostrar en pantalla (login y barra lateral): a que
 * entorno apunta esta instancia y que commit esta corriendo. El entorno se
 * decide por la base a la que se conecta (NEXT_PUBLIC_SUPABASE_URL), no por
 * VERCEL_ENV solo: eso es lo que realmente importa validar (a que Supabase
 * esta hablando), y cubre tambien el "next dev" local de Javier.
 */

export type InfoRelease = {
  entorno: "PROD" | "DEV";
  sha: string | null;
  rama: string | null;
};

const REF_PROD = "pnvhpbxjbdmbktpwebtx";

export function obtenerInfoRelease(): InfoRelease {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  // Cualquier base que no sea la de produccion (incluida tropicana-dev, o
  // ninguna configurada) se trata como DEV: mas seguro por defecto.
  const entorno: InfoRelease["entorno"] = supaUrl.includes(REF_PROD) ? "PROD" : "DEV";

  return {
    entorno,
    sha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    rama: process.env.VERCEL_GIT_COMMIT_REF ?? null,
  };
}
