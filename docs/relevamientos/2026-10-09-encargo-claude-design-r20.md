# Encargo para Claude Design — R20 · Documentos y notificaciones (primer alcance)

**Estado:** borrador para tu revisión antes de enviarlo. **No se implementa ninguna pantalla hasta que apruebes los mockups.**
Base: plan R20 v2 (`2026-10-09-plan-r20-notificaciones-v2.md`), requisitos 1.1 (S01–S05) y plantillas reales de N09–N10 (`2026-10-09-r20-equivalencia-N09-N10.md`).

## 1. Qué se diseña
| ID | Pantalla | Para qué |
|---|---|---|
| S01 | Catálogo / inventario | Ver todos los contenidos: filtros por evento, tipo, canal, estado editorial y conexión (legado o módulo). |
| S02 | Editor y vista previa | Abre la plantilla extraída con sus variables ya definidas. |
| S03 | Revisión y liberación | Comparar con lo vigente, ver usos afectados, aprobar, publicar, liberar, retirar y volver a una versión previa. |
| S04 | Historial de avisos y documentos | Qué se preparó, a quién, con qué versión, y qué acciones hubo. |
| S05 | Ajuste mínimo al aviso actual | `AvisoWhatsapp` con origen del contenido y estados nuevos. **WhatsApp y Copiar siguen en un clic.** |
| — | Revisión del mockup de certificaciones | Compatibilidad con el catálogo común (sección 5). |

Quedan fuera: S06 (datos de contacto), formulario de regularización, bandeja programada, CRM, campañas, IA y popup.

## 2. Componentes y patrones que se mantienen
`Pagina` / `EncabezadoPagina`, `Aviso` (`components/nuevo`), `AvisoWhatsapp`, `AvisosAfectados`, `FilaReserva`, `TarjetaConfirmacion`, el patrón de Administración (`ClienteCatalogos`, `FilaParametro`, `MatrizPermisos`), el modo enfoque y el menú plegable. Pantalla nueva: `/administracion/comunicaciones` en el grupo Administración. Permiso por rol: módulo `comunicaciones` con las acciones ver, editar, revisar y publicar.

## 3. Datos ficticios
- Alumna **Ana Pérez**, menor, con su tutor **Luis Pérez**.
- Organización **Colegio Sol**, con su persona de contacto.
- Profesor **Mario Rojas**.
- Reserva «vie 02/10 de 15:00 a 16:00» en «Tropicana (Sala 1)», saldo 7.5 h de 10 h. Plan «Paquete 10 h».

## 4. Plantillas reales para el editor (N09 y N10)
Texto exacto que hoy envía el sistema. El primer contenido del módulo es idéntico a este.

**N09 · `reserva.confirmada.alumno`** (al alumno, tutor o titular; finalidad: servicio)
```
Hola! Confirmamos {{reserva.tu_clase}}: {{reserva.cuando}}, en {{reserva.lugar}}. Te quedan {{saldo.disponible_horas}} h de tu {{saldo.paquete}} de {{saldo.contratadas_horas}} h. ¡Te esperamos!
```
Resultado con los datos ficticios:
> Hola! Confirmamos tu clase particular (Paquete 10 h) con Mario Rojas: vie 02/10 de 15:00 a 16:00, en Tropicana (Sala 1). Te quedan 7.5 h de tu paquete de 10 h. ¡Te esperamos!

**N10 · `reserva.confirmada.profesor`** (solo en clases particulares)
```
Hola! Se te confirmó una clase particular ({{reserva.plan}}) con {{alumno.nombre}}: {{reserva.cuando}}, en {{reserva.lugar}}.
```
Resultado:
> Hola! Se te confirmó una clase particular (Paquete 10 h) con Ana Pérez: vie 02/10 de 15:00 a 16:00, en Tropicana (Sala 1).

**Variables (todas obligatorias, de texto, ya formateadas):**
| Variable | Qué es | Ejemplo |
|---|---|---|
| `reserva.tu_clase` | Qué se confirma (con profesor si es particular) | tu clase particular (Paquete 10 h) con Mario Rojas |
| `reserva.plan` | Plan de la membresía | Paquete 10 h |
| `reserva.cuando` | Día y horario | vie 02/10 de 15:00 a 16:00 |
| `reserva.lugar` | Dónde | Tropicana (Sala 1) |
| `alumno.nombre` | Alumno (o titular, en alquiler) | Ana Pérez |
| `saldo.disponible_horas` | Horas que quedan | 7.5 |
| `saldo.contratadas_horas` | Horas contratadas | 10 |
| `saldo.paquete` | «paquete» o «alquiler» | paquete |

**Reglas del editor:** las variables son elementos protegidos con nombre, explicación y ejemplo; no se renombran, no se borran las obligatorias y no se cambian sus fuentes ni reglas. Se pueden mover y se puede editar el texto alrededor. Sintaxis disponible: variable, filtro `mayuscula_inicial`, `{{#si}}…{{#sino}}…{{/si}}` y `{{#cada}}`. Muestra errores de sintaxis y de variables faltantes antes de guardar.

**Estados de contenido que hay que distinguir con claridad:** predeterminado heredado · borrador · en revisión · aprobado · publicado/liberado · retirado. **Aprobar no es publicar, y publicar no es liberar para un uso.** Un cambio publicado solo afecta a los avisos nuevos de los usos liberados.

## 5. Certificaciones: compatibilidad del mockup existente
Mockup: `design_handoff_reporte_membresia/Ficha de membresia.dc.html` (reporte de dos hojas; hoja 2 = política por tipo). Se **reutiliza** tal cual el diseño; se pide revisar solo estos cambios visibles:
- La versión y la emisión visibles: «Emitido el … · versión …». La versión es la de la política aplicable a esa membresía, no «la vigente».
- Reimprimir una emisión anterior (reproduce el original) frente a emitir una nueva.
- Entrada en el historial de la ficha.
- Estados del envío: preparado, abierto, copiado, declarado enviado por el operador. **Nunca «enviado» al abrir WhatsApp.**
- Estado «sin política liberada para este tipo».

Origen de los campos ya enlazados en el mockup: `plazoCancel` ← parámetro de cancelación; `solicitudValidez` ← parámetro de validez de la solicitud; `pruebaAcreditaDias` ← plan o parámetro de la prueba; `politicaVersion` y `politicaOficialUrl` ← versión del contenido. No se inventan documentos fiscales, firma electrónica ni campos nuevos.

## 6. S05: el aviso actual
Hoy: botón de WhatsApp (app primero, `wa.me` de respaldo) y «Copiar mensaje». Se mantiene. Se agrega, sin pasos obligatorios:
- Origen del contenido (heredado u oficial, con versión) y acceso al historial.
- **Acciones** registradas: abierto en WhatsApp, copiado. **Declaración opcional** del operador: «Marcar como enviado» (es una declaración suya, distinguible de la evidencia futura de un proveedor).
- Advertencia interna de contactabilidad («sin consentimiento registrado») que no bloquea.
- Rechazo explícito: «X rechazó recibir avisos de servicio por WhatsApp (fecha, medio)». El aviso no se prepara; la operación sigue.

## 7. Estados que hay que dibujar en todas las pantallas
Vacío · cargando · error · sin permiso · destino inválido (sin WhatsApp o en mal formato) · variable faltante · error de registro (se conserva el texto generado y se puede reintentar) · respaldo autorizado (usar el texto anterior con un clic explícito) · consentimiento pendiente o rechazado. Explicados en lenguaje operativo.

## 8. Criterios para aprobar
- Un clic para abrir WhatsApp y para copiar, igual que hoy.
- Las variables del editor se ven protegidas y explicadas.
- Se distinguen sin ambigüedad: heredado / borrador / aprobado / publicado, y preparado / abierto / copiado / declarado.
- Todas las pantallas cubren los estados de la sección 7.
- Ningún diseño habilita envíos externos ni publica contenido oficial por sí mismo.
