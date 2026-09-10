import type { InfoRelease } from "@/lib/version";

/** Chip chico con entorno (PROD/DEV) + commit, para validar de un vistazo
 *  a que instancia/base se está conectando. Sin estado: se puede usar
 *  tanto en un server component (login) como dentro de uno client (sidebar). */
export default function InfoReleaseChip({ info }: { info: InfoRelease }) {
  const esProd = info.entorno === "PROD";
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span
        className={`px-2 py-0.5 rounded-[var(--radio-control)] font-semibold tracking-wide ${
          esProd
            ? "bg-[var(--exito-fill)] text-[var(--exito-texto)]"
            : "bg-[var(--peligro-fill)] text-[var(--peligro-texto)]"
        }`}
      >
        {info.entorno}
      </span>
      {info.sha && <span className="text-[var(--texto-tenue)]">#{info.sha}</span>}
    </div>
  );
}
