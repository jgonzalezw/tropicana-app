import Pagina from "@/components/Pagina";

/** Estado "cargando": dice qué se está leyendo y muestra siluetas, no una pantalla vacía. */
export default function CargandoPreliquidacion() {
  return (
    <Pagina ancho="5xl">
      <div className="flex flex-col gap-7">
        <div>
          <div className="text-sm text-[var(--texto-tenue)]">Liquidaciones</div>
          <h1 className="text-[28px] sm:text-[38px] mt-1">Pre-liquidación</h1>
        </div>
        <p role="status" className="text-base text-[var(--texto-tenue)]">
          Calculando el período: leyendo membresías, cobros, asistencia y asignaciones…
        </p>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-[var(--radio-panel)] bg-[var(--fondo-elevado)] animate-pulse" />
          ))}
        </div>
        <div className="flex flex-col gap-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[72px] rounded-[var(--radio-tarjeta)] bg-[var(--fondo-panel)] border border-[var(--borde)] animate-pulse" />
          ))}
        </div>
        <button type="button" disabled className="self-start min-h-[44px] px-5 rounded-[var(--radio-control)] bg-[var(--primario)] text-[var(--primario-texto)] opacity-50 cursor-not-allowed">
          Imprimir
        </button>
        <p className="text-sm text-[var(--texto-tenue)] -mt-5">Imprimir se habilita cuando termina de calcular.</p>
      </div>
    </Pagina>
  );
}
