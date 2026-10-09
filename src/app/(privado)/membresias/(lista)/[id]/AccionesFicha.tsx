"use client";

import { useRouter } from "next/navigation";
import MenuAcciones, { type ItemMenu } from "@/components/nuevo/MenuAcciones";

// Las acciones llegan con sus fases (2 reservas · 3 cobrar · 4 reporte ·
// 5 modificar · 6 baja · 7 renovar). Mientras tanto se ven deshabilitadas y
// dicen por qué (calidad 5). PROVISIONAL: antes de encender `membresias_nuevas`
// en producción estos textos deben desaparecer o activarse (RETOMAR, pendiente
// de cierre de I-012).
const llega = (fase: number) => `Llega en la fase ${fase}`;
const SOLO_ALUMNOS = "Solo los alumnos tienen cuenta propia";

export default function AccionesFicha({
  alumnoId,
  deBaja,
  conReservas,
}: {
  alumnoId: number | null;
  deBaja: boolean;
  conReservas: boolean;
}) {
  const router = useRouter();
  const items: ItemMenu[] = [
    { label: "Modificar…", sub: "Días, curso, plan o fechas", motivoBloqueo: llega(5), onClick: () => {} },
    { label: "Reporte de la membresía", sub: "Estado general para el alumno", motivoBloqueo: llega(4), onClick: () => {} },
    ...(conReservas
      ? [{ label: "Nueva reserva…", sub: "Fecha, hora, duración y sala", motivoBloqueo: llega(2), onClick: () => {} }]
      : []),
    { label: "Imprimir estado de cuenta", sub: "Cuotas, pagos y saldo", motivoBloqueo: llega(4), onClick: () => {} },
    { label: "Copiar estado de cuenta", sub: "Para enviar por WhatsApp", motivoBloqueo: llega(4), onClick: () => {} },
    alumnoId != null
      ? { label: "Ver persona", sub: "Su cuenta de alumno", onClick: () => router.push(`/alumnos/${alumnoId}/cuenta`) }
      : { label: "Ver persona", sub: SOLO_ALUMNOS, motivoBloqueo: SOLO_ALUMNOS, onClick: () => {} },
    { label: "Dar de baja…", sub: "Pide motivo y confirmación", motivoBloqueo: llega(6), onClick: () => {}, peligro: true, separador: true },
  ];
  return (
    <div className="n-enc__acciones">
      <button type="button" className="n-boton" disabled title={deBaja ? "La membresía está de baja" : llega(3)}>
        Cobrar
      </button>
      <button type="button" className="n-boton n-boton--primario" disabled title={deBaja ? "La membresía está de baja" : llega(7)}>
        {deBaja ? "De baja" : "Renovar"}
      </button>
      <MenuAcciones items={items} />
    </div>
  );
}
