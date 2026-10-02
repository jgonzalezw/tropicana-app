import { tienePermiso } from "@/lib/sesion";
import SinAcceso from "@/components/SinAcceso";
import { cargarContextoAsistencia } from "@/lib/contextoAsistencia";
import ClienteAsistencia from "./ClienteAsistencia";
import Pagina from "@/components/Pagina";

export const dynamic = "force-dynamic";

export default async function PaginaAsistencia({
  searchParams,
}: {
  searchParams: Promise<{ curso?: string; fecha?: string }>;
}) {
  const { curso: cursoParam, fecha: fechaParam } = await searchParams;
  if (!(await tienePermiso("asistencia", "ver"))) return <SinAcceso />;

  const ctx = await cargarContextoAsistencia();
  if (ctx.tipo === "sin_perfil") {
    return (
      <Pagina ancho="lg">
        <div className="border border-[var(--primario)] bg-[color-mix(in_srgb,var(--primario)_12%,transparent)] rounded-[var(--radio-tarjeta)] p-5">
          <div className="font-semibold text-base">Tu cuenta no está vinculada a un profesor</div>
          <p className="text-base mt-1">
            Tu rol solo ve los cursos propios, y esta cuenta todavía no está vinculada a ninguna
            ficha de profesor. Pedile a un administrador que la vincule desde
            Profesores → Profesores y cursos → Cuenta de acceso.
          </p>
        </div>
      </Pagina>
    );
  }

  return (
    <ClienteAsistencia
      cursos={ctx.cursos}
      alumnosPorCurso={ctx.alumnosPorCurso}
      mostrarDeuda={ctx.mostrarDeuda}
      minRetroIso={ctx.minRetroIso}
      puedeEditar={ctx.puedeEditar}
      cursoInicialId={Number(cursoParam) || null}
      fechaInicial={fechaParam ?? null}
    />
  );
}
