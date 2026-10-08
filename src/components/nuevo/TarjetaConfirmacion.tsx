"use client";

import AvisoWhatsapp from "@/components/AvisoWhatsapp";

export type DatoGuardado = { clave: string; valor: string };

/** Resumen de lo que se acaba de guardar + el aviso listo para mandar por
 *  WhatsApp. El aviso es `AvisoWhatsapp` (regla de proceso 12), no una copia:
 *  esta tarjeta solo le suma el estado «Sin enviar / Enviado». Quién lo
 *  recibe lo decide la pantalla (`destinatarioAviso`); el registro del envío
 *  en el historial también. */
export default function TarjetaConfirmacion({
  titulo,
  sub,
  datos,
  aviso,
  enviado,
  onEnviado,
}: {
  titulo: string;
  sub?: string;
  datos: DatoGuardado[];
  aviso?: { nombre: string; whatsapp: string | null | undefined; mensaje: string };
  enviado: boolean;
  onEnviado: () => void;
}) {
  return (
    <div className="flex flex-col gap-4" data-testid="tarjeta-confirmacion">
      <div className="n-confirmacion__cab">
        <div className="n-confirmacion__check" aria-hidden="true">
          ✓
        </div>
        <div>
          <div className="n-confirmacion__titulo">{titulo}</div>
          {sub && <div className="n-confirmacion__sub">{sub}</div>}
        </div>
      </div>
      <dl className="n-confirmacion__datos">
        {datos.map((d) => (
          <div key={d.clave}>
            <dt>{d.clave}</dt>
            <dd>{d.valor}</dd>
          </div>
        ))}
      </dl>
      {aviso && (
        <div className="n-wa">
          <AvisoWhatsapp
            nombre={`Aviso para ${aviso.nombre}`}
            whatsapp={aviso.whatsapp}
            mensaje={aviso.mensaje}
            onEnviado={onEnviado}
          />
          <div className="n-confirmacion__estado" data-enviado={enviado ? "true" : "false"}>
            {enviado ? "✔ Enviado · registrado en el historial" : "Sin enviar"}
          </div>
        </div>
      )}
    </div>
  );
}
