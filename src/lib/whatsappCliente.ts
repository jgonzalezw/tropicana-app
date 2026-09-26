/**
 * Abrir WhatsApp desde el navegador, intentando primero la aplicación del
 * dispositivo y recién si no responde, la página web (`wa.me`) — pedido de
 * Javier, 2026-09-26: *"que primero intente abrir la aplicación de
 * whatsapp y en caso de no encontrarla recién abra en la web"*. Antes, todo
 * botón de "Enviar por WhatsApp" iba directo a `wa.me`, que es la propia
 * página de WhatsApp la que le pregunta al usuario si continúa ahí o pasa a
 * la aplicación — un paso intermedio que Javier no quiere.
 *
 * No hay forma de que el navegador le diga a esta función si la aplicación
 * abrió o no (ninguna API lo expone, por seguridad): se navega al esquema
 * `whatsapp://`, que un navegador sin nada registrado para ese esquema
 * ignora en silencio, sin dejar la página — y se mide indirectamente si
 * "algo pasó" por si la pestaña pierde el foco (la app tomó el control, o
 * el navegador mostró su propio diálogo para abrirla) dentro de una
 * ventana corta. Si no pasó nada, se asume que no hay aplicación y se abre
 * `wa.me` en una pestaña nueva, que sí funciona siempre.
 *
 * Es "mejor esfuerzo", no infalible: un navegador que muestra su diálogo
 * nativo ("¿Abrir WhatsApp?") también cuenta como pérdida de foco, así que
 * si la persona lo cancela, no hay wa.me de respaldo para ese clic — tiene
 * "Copiar mensaje" al lado, que nunca depende de esto.
 */
const ESPERA_APP_MS = 1200;

export function abrirWhatsapp(urlApp: string | null, urlWeb: string | null): void {
  if (typeof window === "undefined" || !urlWeb) return;

  if (!urlApp) {
    window.open(urlWeb, "_blank", "noopener,noreferrer");
    return;
  }

  let seFue = false;
  const marcarQueSeFue = () => {
    seFue = true;
  };
  window.addEventListener("blur", marcarQueSeFue, { once: true });
  document.addEventListener("visibilitychange", marcarQueSeFue, { once: true });

  // Navegar al esquema whatsapp: no abandona la pestaña si nada lo maneja
  // (así es como los navegadores tratan un esquema sin registrar) — la
  // página actual queda intacta en cualquiera de los dos casos.
  window.location.href = urlApp;

  setTimeout(() => {
    window.removeEventListener("blur", marcarQueSeFue);
    document.removeEventListener("visibilitychange", marcarQueSeFue);
    if (!seFue) window.open(urlWeb, "_blank", "noopener,noreferrer");
  }, ESPERA_APP_MS);
}
