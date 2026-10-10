# Encargo para Claude Design — R20 · Documentos y notificaciones (primer alcance)

**Estado:** versión definitiva, aprobada por Javier (2026-10-10) para llevarla a Claude Design. **No se implementa ninguna pantalla hasta que apruebe los mockups.**
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

**Variables, por plantilla.** El esquema común tiene 8 variables; cada plantilla usa solo las suyas, y **obligatoria significa obligatoria en esa plantilla**, no en el conjunto:
| Plantilla | Obligatorias (no se pueden borrar) | Disponibles pero no usadas |
|---|---|---|
| N09 alumno | `reserva.tu_clase`, `reserva.cuando`, `reserva.lugar`, `saldo.disponible_horas`, `saldo.paquete`, `saldo.contratadas_horas` (6) | `reserva.plan`, `alumno.nombre` |
| N10 profesor | `reserva.plan`, `alumno.nombre`, `reserva.cuando`, `reserva.lugar` (4) | `reserva.tu_clase`, `saldo.*` |

El editor muestra, por plantilla, qué variables son obligatorias, cuáles están disponibles y cuáles no aplican.

**Las 8 variables del esquema (de texto, ya formateadas):**
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

**Reglas del editor:**
- Las variables son **elementos protegidos** con nombre, explicación y ejemplo: no se renombran, no se borran las obligatorias y no se cambian sus fuentes ni reglas. Se pueden mover y se puede editar el texto alrededor.
- **Condiciones y repeticiones con controles guiados**, sin escribir la sintaxis a mano: «Mostrar este fragmento solo si…» (elige una condición de una lista que ofrece la aplicación y, si quiere, un texto alternativo) y «Repetir para cada…» (elige una lista, el separador y el conector final, por ejemplo «, » y « y »). Por debajo se guardan como `{{#si}}…{{#sino}}…{{/si}}` y `{{#cada}}`; el filtro `mayuscula_inicial` se ofrece como «empezar con mayúscula».
- Muestra errores de sintaxis y de variables faltantes antes de guardar.
- **Distinción por canal.** Cada contenido es de un canal: WhatsApp, email, documento o popup. El primer envío asistido es WhatsApp/Copiar, pero el editor y el catálogo ya lo prevén: el email tiene **asunto y cuerpo** (con sus propias variables y vista previa), y no se asume que el texto de WhatsApp sirva para email. En este alcance el email solo se diseña y se guarda; **no se envía**.

**Vista previa.** Muestra el mensaje con dos datos separados, que a veces son personas distintas:
- **A quién se refiere** el mensaje (la persona de la reserva: Ana Pérez).
- **Destinatario efectivo** y por qué regla: el propio alumno, su tutor (Luis Pérez, si es menor), la persona de contacto de una organización (Colegio Sol) o el profesor (Mario Rojas).
Se puede cambiar entre estos escenarios con los datos ficticios para ver cómo queda cada variante (particular o alquiler; lugar externo, sala o «Tropicana»; con y sin duración). El destinatario lo decide la aplicación, no el texto.

**Estados de contenido que hay que distinguir con claridad:** predeterminado heredado · borrador · en revisión · aprobado · publicado · retirado.

**Versión publicada y liberación son dos conceptos visibles y separados:**
- *Publicar* fija una versión: queda inmutable y disponible, pero **no cambia ningún aviso**.
- *Liberar* asigna una versión publicada a un **uso concreto** (caso × canal, por ejemplo «reserva.confirmada · alumno · WhatsApp»). Solo ahí empieza a aplicarse, y solo a los avisos nuevos.
- Cada uso muestra qué versión tiene liberada y desde cuándo; cada versión muestra en qué usos está liberada. Aprobar ≠ publicar ≠ liberar.

**Volver a una versión anterior** (en S03): se explica en pantalla que afecta **únicamente a los usos futuros**; las emisiones, los avisos ya preparados y el historial **se conservan** y siguen mostrando la versión con la que se generaron. Pide motivo y deja constancia.

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
