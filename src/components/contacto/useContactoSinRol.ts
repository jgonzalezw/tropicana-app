"use client";

import { useEffect, useState } from "react";
import { contactoSinRol, type ContactoExistente } from "@/app/(privado)/contactos/accionesRol";
import { soloDigitos } from "@/lib/texto";
import type { ContactoResumen } from "@/lib/contactoVenta";

/**
 * Mientras se escribe el WhatsApp de un alumno o profesor nuevo: ¿ya existe un
 * contacto con ese número que todavía no tiene este rol? Si existe, la pantalla
 * ofrece usarlo y agregarle el rol (`PanelDuplicado`), en vez de dejar que el
 * servidor rechace con "ese WhatsApp ya es de otro contacto".
 */
export function useContactoSinRol(rol: "alumno" | "profesor", whatsapp: string, activo: boolean): ContactoExistente | null {
  const [res, setRes] = useState<{ clave: string; existente: ContactoExistente | null } | null>(null);
  const clave = activo ? soloDigitos(whatsapp) : "";

  useEffect(() => {
    if (clave.length < 6) return;
    let vivo = true;
    const t = setTimeout(() => {
      contactoSinRol(rol, whatsapp).then((r) => {
        if (vivo) setRes({ clave, existente: r.existente });
      });
    }, 400);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
    // `whatsapp` entra por `clave`: solo cuentan los dígitos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rol, clave]);

  return clave.length >= 6 && res?.clave === clave ? res.existente : null;
}

/** Lo que `PanelDuplicado` necesita para mostrar un contacto existente. */
export function comoResumen(e: ContactoExistente): ContactoResumen {
  return { id: e.contactoId, tipo: "persona", nombre: e.nombre, whatsapp: e.whatsapp, rol: e.rol, noContactar: false };
}
