# R20 · Capa interna de documentos y notificaciones — Plan corregido (v2)

**9 de octubre de 2026.**
- **Referencia principal:** requisitos 1.1.
- **Contexto:** especificación de comunicaciones 2.1 y requisitos de la plataforma 0.3.
- **Reemplaza a:** el plan v1 (`docs/relevamientos/2026-10-09-plan-r20-notificaciones.md`, commit `9ecf5ca`), que queda como antecedente.
- **Alcance de este encargo:** solo plan y documentos. No hay código ni migraciones.

## Contexto
Aceptaste el enfoque de la v1 como base y pediste siete enmiendas antes de implementar:
1. un inventario completo, con la equivalencia demostrada;
2. el consentimiento sin cortar la operación;
3. una etapa de regularización de contactos;
4. retomar las certificaciones sobre la base común;
5. garantías operativas correctas;
6. un nuevo orden en ocho entregas;
7. la entrega documental.

Esta v2 las incorpora. Medí y verifiqué en el repo y en dev, solo con lecturas, lo que cambia respecto de la v1. Lo que no pude medir queda como pendiente con nombre.

## Autorización recibida (2026-10-09)
- **Autoriza:** actualizar la documentación y **ejecutar E2** en hitos revisables.
- **No autoriza:**
  - migraciones;
  - conectar casos a la operación;
  - cambios de consentimiento o `no_contactar`;
  - publicar contenido oficial;
  - pasar a producción;
  - la retención ilimitada (C5).

### Hitos de E2 (en dev; al cerrar cada uno: resumen breve, evidencia, pendientes y la próxima autorización concreta)
- **H1 · N09–N10.**
  1. Se capturan las referencias del código **actual**, antes de refactorizar. Son pruebas de caracterización con datos ficticios para cada variante: particular o alquiler, lugar (externa, sala, «Tropicana»), saldo con decimales, ambas acciones de origen (`crearReserva` confirmar y `cambiarEstadoReserva` → confirmada), y destinatario alumno, profesor, menor con tutor y organización. Commit propio.
  2. Se extraen B1 y B2 a funciones puras.
  3. Plantilla, variables, condiciones, variantes y adaptador.
- **H2 · Evidencia de equivalencia de N09–N10:** `strictEqual` de referencia = función trasladada = plantilla renderizada, más un informe por variante. Incluye el motor de plantillas puro (sin base de datos). **Con las plantillas de H1/H2, el encargo para Claude Design:** S01–S05 y la revisión de compatibilidad del mockup de certificaciones (§6.2).
- **H3 · Resto de los casos**, por grupos (reservas, clases, ventas), con el mismo método, hasta completar el inventario, las referencias y el script de inventario.
- **Regla en todos los hitos:** los textos, formatos y rarezas se reproducen exactamente. Las mejoras editoriales llegan después, como versiones aprobadas y publicadas.
- **Pruebas:** `tsc` y `npm test`. El e2e de humo de una reserva corre una vez al final de H1 y otra al final de H3. Si algo falla dos veces, paro y te aviso.

## Documentación (antes de H1)
1. En la rama `r20-notificaciones`, guardo esta v2 como `docs/relevamientos/2026-10-09-plan-r20-notificaciones-v2.md`.
   - La v1 no se borra. Le agrego una línea de cabecera: «Reemplazado por la v2».
2. El plan viejo de la fase 4 (`…-plan-i012-fase-4-reporte.md`) lleva una cabecera: **«ANTECEDENTE ARCHIVADO — no ejecutable»**. Esa cabecera dice qué instrucciones quedan sin efecto (§6.4). El plan nuevo de las certificaciones queda en `docs/relevamientos/2026-10-09-plan-certificaciones-v2.md`, con el contenido de la §6.
3. Publico la v2 como documento exportable (Claude Docs, con exportación a Word o PDF) y te paso el enlace.
4. **`RETOMAR`:**
   - la línea de R20 pasa a la entrega 1 (plan v2 entregado) y la siguiente es la entrega 2;
   - la fase 4 deja de figurar «en PAUSA hasta la etapa 3» y pasa a decir «certificaciones: entrega 7a, espera solo E4 y la revisión de diseño»;
   - **todas las demás líneas quedan iguales.**
   **`ESTADO`:** un bloque corto fechado.
5. Commit `[R20] Plan v2 corregido`, push y PR. **Merge solo con tu OK en ese turno.**
6. Después arranco **E2 · H1** en la misma rama.

---

## 0. Diferencias respecto de la v1
| Tema | v1 | v2 |
|---|---|---|
| Estado del inventario | Fichas con referencias archivo:línea; «se completa en 1.1» | **Se declara incompleto.** El inventario se cierra en la entrega 2, que tiene un criterio de salida verificable (§1.4). |
| Equivalencia | `git diff --color-moved` como prueba del traslado | **Referencias capturadas antes de tocar el código**, más una comparación con `strictEqual` entre la referencia, el legado trasladado y el render de la plantilla. Un diff no prueba nada. |
| Conteos | «18 casos / 22 combinaciones / 15 operaciones / 7 contenedores», que no cuadraban | Recontados (§1.1): **13 eventos, 21 casos, 16 operaciones de entrada (13 con generador propio), 9 consumidores de `AvisoWhatsapp` (8 productivos y el muestrario)**. Las variantes se cuentan en la entrega 2. |
| `no_contactar` | «Ningún aviso lo consulta; mostrarlo como advertencia» | Medido: **ninguna acción lo escribe** y en dev hay 0 de 67 en `true`. Sí lo leen `TarjetaContacto` y `detalleContactoVenta`. Se propone una regla de procedencia (§3). |
| Consentimiento | Una sola finalidad, «alcanza» | Cuatro estados, finalidad servicio ≠ comercial, y el texto v1 mezcla las dos (§3). |
| Regularización de contactos | No estaba | Entrega 8a (§4) |
| Fase 4 | En pausa hasta la etapa 3; tablas `politicas` y `membresia_eventos` en el anexo | Las **certificaciones son un incremento propio (7a)**, que depende solo de E4 más el diseño. Se eliminan las tablas separadas, la selección automática de la política vigente y el «enviado» al abrir WhatsApp (§6). |
| Idempotencia | Un uuid nuevo por ejecución | La clave sale del **hecho de negocio persistido**, o de una **clave de solicitud del cliente** que se reutiliza en cada reintento (§5.1) |
| Reversión | Rollback = borrar las tablas | Volver a `modo='legado'` conservando todo; borrar tablas solo en una instalación vacía de dev (§5.2) |
| Fallos | Si falla el registro, se usa el texto legado | Un texto oficial ya generado **no se sustituye solo**; el respaldo es explícito y autorizado (§5.3) |
| Permisos del historial | Solo `comunicaciones.ver` | Además, el acceso a la operación, membresía o documento relacionado, verificado en el servidor (§5.4) |
| Versiones | Inmutables al publicar | Inmutables **para siempre** una vez publicadas, aunque se retiren. Las políticas quedan fijadas en cada composición (§5.5). |
| Destinos | «Requiere verificación» si el valor actual ≠ el verificado | **Revisión del destino** con un contador que sube en cada cambio, de modo que A → B → A también se detecta (§5.6) |
| Estados | `confirmado_manual` como estado del aviso | Abrir y copiar son acciones. La confirmación manual es una **declaración del operador**, distinta de la evidencia futura del proveedor (§5.7). |
| Etapas | 1.1 → 1.4, D, 2.x, 3.x, 3.e, 4–6 | **Entregas 1–8** con dependencias por pieza (§7) |

## 1. Inventario: conteos reconciliados y qué falta

### 1.1 Conteos (medidos con grep el 2026-10-09; la entrega 2 los vuelve a contar con un script)
- **13 eventos de negocio:**
  - ventas: inscripción, recibo, prueba, particular, alquiler;
  - reservas: solicitada, confirmada, suspendida, restablecida, reprogramada, cancelada a pedido;
  - clases: suspendida, reabierta.
- **21 casos de mensaje** (evento × destinatario), N01–N21:
  - 6 de venta: N01–N06;
  - 12 de reserva: N07–N18, alumno o titular y profesor;
  - 3 de clase: N19–N21.
  La v1 decía «18 casos» por error.
- **16 operaciones de entrada:**
  - **13 tienen generador propio:** `inscribirYCobrar`, `venderPrueba`, `venderParticular`, `venderAlquiler`, `crearReserva`, `cambiarEstadoReserva`, `suspenderReservaOperativa`, `revertirSuspension`, `reprogramarReserva`, `moverReserva`, `cancelarAPedido`, `suspenderClase`, `reabrirSesion`;
  - **3 reutilizan uno ajeno:**
    - `guardarHorarioSala` (C5, `administracion/sala/acciones.ts:366`): usa `suspenderReservaOperativa` y `avisosSuspensionAlumnos`;
    - `crearBloqueoSala` (`sala/acciones.ts:586`): usa `suspenderReservaOperativa`;
    - `cancelarReservaSala` (`sala/acciones.ts:782`): usa `revertirSuspension`.
- **9 consumidores de `AvisoWhatsapp`:**
  - `ConfirmacionVenta`, `AvisosAfectados`, `GestionReserva`, `NuevaReserva`, `FilaReserva`, `AvisosFicha`, `ClienteSalaHorario`, `ClienteDisponibilidadSala`;
  - el muestrario `TarjetaConfirmacion`.
  La v1 decía 7. El «9 pantallas» del informe de Code coincide con este número de consumidores, no con el de operaciones.
- **Documentos:** D01–D06. **Políticas:** P00 (consentimiento, existe), P01–P03 (certificaciones).
- **Variantes:** **todavía no hay un conteo verificado.** La v1 listaba ramas por ficha, pero no el producto de las combinaciones que efectivamente se alcanzan. La entrega 2 publica, por caso, la tabla de variantes con un id (por ejemplo `N09.particular.sala.saldo_decimal`) y su referencia capturada. El total sale de esa tabla, no de una estimación.

### 1.2 Ficha completa: campos obligatorios por caso (R02, R44, R45, A01)
- clave estable, evento, finalidad (servicio/comercial), destinatario y regla de destinatario (dA, dT o cA);
- **plantilla predeterminada ejecutable**;
- esquema de variables: nombre, descripción, fuente autorizada, tipo, si es obligatoria, formateador vigente y comportamiento ante ausencia;
- metacomandos usados y condiciones (booleanos que calcula el adaptador);
- adaptador documentado (cálculo que queda en el código);
- tabla de variantes con datos ficticios, **referencia capturada** por variante y evidencia de equivalencia (resultado de la prueba);
- operaciones que lo disparan, consumidor, sensibilidad, si mezcla servicio con oferta, y la fuente del `evento_id` (§5.1).

### 1.3 Estado actual por ficha
**Ninguna de las 21 fichas está completa:**
- **Ya están:** clave, evento, destinatario, disparador, generador (archivo:línea) y las ramas conocidas, en las fichas de la v1.
- **Faltan en todas:**
  - la plantilla ejecutable;
  - el esquema de variables;
  - la tabla de variantes;
  - las referencias capturadas;
  - la evidencia de equivalencia;
  - la fuente del `evento_id`;
  - la marca de finalidad.

Los documentos D01, D03 y D05 solo necesitan su ficha de emisión (no cambia el formato). D06 y P01–P03 se cierran en la entrega 7a.

### 1.4 Pendientes concretos para cerrar el inventario (salida de la entrega 2)
1. Script de conteo, `scripts/inventario-avisos.mjs`, que lista los importadores de `AvisoWhatsapp`, las llamadas a generadores y las operaciones exportadas que devuelven avisos. **Falla si aparece un consumidor que no está en el inventario.**
2. Para cada uno de los 21 casos: la tabla de variantes, las referencias en `src/lib/comunicaciones/__referencias__/<caso>/<variante>.txt` (capturadas **del código actual, antes de moverlo**), la plantilla, el esquema y el adaptador.
3. Las variantes de borde que hay que cubrir sí o sí:
   - las rarezas de texto («…):.», «?» sin duración, horas sin formatear en N04 y N06, los dos textos de «resto», los respaldos de motivo de C5);
   - ñ, tildes y «¡»;
   - horas con decimales;
   - importes con miles;
   - cambio de mes y de año;
   - menor con tutor, menor sin tutor, organización con persona de contacto y sin ella.
4. Marca de finalidad por caso y revisión de **mensajes mixtos**. Con lo leído en la v1, ningún caso incluye ofertas. N01 menciona la renovación bonificada, que es información de servicio de la propia membresía. Se confirma caso por caso.
5. Fuente del `evento_id` por operación (§5.1).

---

## 2. Discrepancias (actualizadas)
Se mantienen las discrepancias 1–4 y 6–10 de la v1 (§6 del PLAN_CIERRE, tres reglas de destinatario, `politicas_texto`, email sin validar, rarezas de texto, D25/D26). Cambian o se agregan estas:
- **5 (corregida):**
  - `AvisoWhatsapp` y los 16 generadores no consultan `no_contactar` ni el consentimiento.
  - **Sí lo consultan** `TarjetaContacto.tsx:61-109` y `detalleContactoVenta` (`contactos/accionesVenta.ts:455`). Si está en `true`, ocultan el enlace y dicen «pidió no ser contactado».
  - Hoy hay dos comportamientos distintos para el mismo dato.
- **11 (nueva):** **nadie escribe `no_contactar`.** Nace en `false` por defecto (0048:68), ninguna acción ni pantalla lo modifica y en dev hay 0 de 67 en `true`. **Producción no está medida** (pendiente M1, necesita tu OK para una lectura).
  - Su `false` no significa «aceptó»: significa «nadie registró nada».
- **12 (nueva):** **el consentimiento existe y tiene datos.**
  - Se registra en `consentimientos` (de solo agregar) desde el formulario de contacto (`registrarConsentimiento`, `contactos/acciones.ts:257`), con medio y versión del texto.
  - En dev: 5 filas, 3 vigentes otorgados y **2 rechazos explícitos**. Hoy esos rechazos **no impiden ningún aviso.**
- **13 (nueva):** **el texto v1 del consentimiento mezcla finalidades.** La finalidad `contacto` cubre «inscripción, clases y pagos» (servicio) **y** «novedades de la academia» (comercial). Un sí o un no a ese texto no se puede separar sin una decisión (§3.3).
- **14 (nueva):** `enlaces_captacion` (tipo `personal`, con token y vencimiento) y `solicitudes_contacto` ya existen desde 0048, vacías y sin pantalla. Son la base del formulario por enlace de la entrega 8a.

## 3. Consentimiento y continuidad operativa

### 3.1 Cuatro estados, por contacto × finalidad × canal
| Estado | De dónde sale | Aviso de **servicio** | Aviso **comercial** (fuera del alcance) |
|---|---|---|---|
| Pendiente de solicitar | No hay fila vigente ni solicitud | **Se envía**, con una advertencia interna: «sin consentimiento registrado» | No |
| Pendiente de respuesta | Hay una solicitud enviada (entrega 8a) sin respuesta | **Se envía**, con advertencia | No |
| Registrado | Vigente `otorgado=true` | Se envía | Solo con un registro propio de finalidad comercial |
| Rechazo explícito | Vigente `otorgado=false` | **No se prepara** el aviso de esa finalidad y canal. Se muestra «X rechazó recibir … (fecha, medio)». **La operación sigue.** | No |

Las advertencias son internas (en S05). No agregan pasos a WhatsApp ni a Copiar.

### 3.2 Regla propuesta para `no_contactar` (antes de activar el primer flujo)
- **Qué significa:** `no_contactar=true` = negativa explícita general. `false` = sin información; **nunca** se lee como consentimiento.
- **Procedencia obligatoria:** desde la entrega 4, el campo solo se puede cambiar con una acción del servidor que, en la misma operación, inserta una fila en `consentimientos` con finalidad `todas`, `otorgado=false`, medio, quién y versión. El control nuevo `control_migracion.sql` verifica que **todo `true` tenga esa fila**.
- **Antes de activar la entrega 5:**
  - se mide producción (M1);
  - si hubiera algún `true` sin procedencia, se revisa a mano con vos; no se aplica solo.
- **Unificación:**
  - `TarjetaContacto`, `detalleContactoVenta` y el módulo pasan a leer el mismo estado calculado (`estadoContactabilidad(contacto, finalidad, canal)`, en un solo lugar, regla de calidad 10);
  - hasta la entrega 5 no se cambia el comportamiento actual de la tarjeta.

### 3.3 Finalidades
- El catálogo `finalidad_consentimiento` suma `servicio` (membresías, certificaciones, pagos, saldos, reservas, clases, vencimientos) y `comercial` (promociones, descuentos, cursos nuevos, ofertas, campañas). Canal: `whatsapp` y `email`.
- La autorización de servicio **no implica** la comercial.
- **Registros históricos v1 `contacto` (texto mixto). Se conservan tal cual, sin reescribir ni reinterpretar automáticamente:**
  - **Manifestación ampliada:** ninguna manifestación se amplía a una finalidad o canal que el registro no respalde. El texto v1 habla de WhatsApp, así que no cubre el email.
  - **Otorgado v1:** respalda servicio por WhatsApp. La parte comercial («novedades») queda **ambigua**: se señala para revisión y no se usa como autorización comercial.
  - **Rechazo v1:** su alcance (servicio, comercial o ambos) es **ambiguo**.
    - Se señala para revisión en un listado.
    - No se amplía en automático a las dos finalidades.
    - Hasta revisarlo, no se cambia el comportamiento actual.
  - **Rechazos de alcance conocido:** se respetan los que vengan de un registro nuevo por finalidad y canal, y los que confirme la revisión.
  - **Decisión C2:** cómo se resuelve cada caso ambiguo. Se decide antes de E5.
  - **Esta aprobación no activa ninguna restricción nueva** ni interrumpe comunicaciones actuales por ausencia de consentimiento.
- Un mensaje que mezcle servicio con una oferta se separa en dos casos. Hoy no hay ninguno; se confirma en la entrega 2.

## 4. Regularización de contactos (entrega 8a)
- **Censo:** listados de contactos con datos faltantes o inválidos, consentimiento pendiente o duplicados probables (mismo número, mismo documento, nombre parecido). La fusión es siempre manual.
- **Formulario por enlace:** usa `enlaces_captacion` (`personal`, token de un solo uso con vencimiento) y `solicitudes_contacto`.
  - Sirve para contactos nuevos y existentes.
  - Pide preferencias por finalidad y canal, y permite cambiar o revocar.
- **Registro de cada manifestación:** quién (el propio contacto o su tutor), cuándo, procedimiento (`formulario`, `presencial`, `whatsapp`) y **versión del texto presentado**, igual que hoy con `consentimientos`.
- **Protección del enlace:**
  - antes de validar al titular, el formulario no muestra ningún dato personal ni financiero;
  - el token no identifica a la persona en la URL;
  - las respuestas entran como `solicitudes_contacto` pendientes de convalidar por recepción, y ahí se aplica la prevención de duplicados.
- **Validación de direcciones:** formato en el momento; verificación según el procedimiento. **D26 sigue fuera.**
- **No bloquea** ni la centralización (E4–E6) ni las certificaciones (7a). Pasar a nuevas restricciones o automatizaciones necesita reglas y activación aprobadas por vos.
- **Diseño propio** (formulario, censo, S06) en su momento.

## 5. Garantías operativas corregidas

### 5.1 Idempotencia
- **Clave:** `<fuente_evento>:<id_evento>:<caso>:<variante>:<contacto_id>:<canal>`, única en `avisos`.
- **`fuente_evento`/`id_evento` = el hecho de negocio que la operación ya persiste.** Ejemplos:
  - una fila de `reservas_historial` (cada cambio de estado deja una);
  - el id de la membresía creada en una venta;
  - la sesión suspendida o reabierta, con su marca.
- Un doble clic o un fallo de red que **no crea un segundo hecho** (la máquina de estados rechaza repetirlo) no crea un segundo aviso. Reintentar el registro reutiliza la misma clave.
- **Si una operación no persiste un hecho identificable**, el formulario genera una **clave de solicitud** al abrirse y la manda en cada intento. La acción la guarda con el hecho, y un reintento con la misma clave devuelve el resultado anterior.
- La entrega 2 lista la fuente para cada una de las 16 operaciones. Donde falte, se anota como un trabajo de la entrega del caso, no de la E4.
- Reabrir o copiar = **acción** sobre el mismo aviso. Un reenvío deliberado = `aviso_acciones.reintento`, con actor y motivo. Un hecho de negocio nuevo (suspender otra vez) = un aviso nuevo, y es correcto.

### 5.2 Reversión
- **Por caso:** `contenido_usos.modo` vuelve a `legado`, con motivo en `contenido_usos_historial`. Se conservan avisos, versiones y documentos.
- **Interruptor operativo por caso (R25):** ese mismo `modo`.
- **Borrar tablas** solo como reversión de una **instalación vacía en dev** (script `rollback_0071` probado en dev). En producción no hay rollback destructivo después de que haya datos.

### 5.3 Fallos
| Falla | Qué pasa |
|---|---|
| Catálogo o resolución, **antes** de generar | **No se sustituye en silencio** el contenido oficial liberado por el mensaje anterior, **ni se esquiva una restricción explícita** (por ejemplo, un rechazo). Se registra la incidencia y el comportamiento es el que define la ficha de ese caso. Ese comportamiento se aprueba **antes de conectar el caso**: detener, o respaldo explícito autorizado. Mientras el uso esté en `legado`, sigue el flujo actual. No hay falso historial. |
| Render de la versión oficial (marcador o sintaxis) | No se genera el mensaje. Se registra la incidencia y se ofrece el **respaldo explícito** («usar el texto anterior autorizado»), salvo en contenido sensible, contractual o con variables indispensables faltantes, donde la comunicación se detiene. **La operación ya confirmada no se toca.** |
| **Registro**, con el contenido oficial ya generado | **Se muestra el texto oficial generado**, no el legado. WhatsApp y Copiar siguen disponibles con ese texto, más el aviso «no se pudo registrar». El cliente reintenta el registro con la misma clave. Pasar al legado solo es posible con un clic explícito. |
| Registro de una acción (abierto o copiado) | El botón funciona igual y se avisa. No se inventa una acción. |

### 5.4 Permisos
Leer un aviso o documento exige las dos cosas:
- `tienePermiso('comunicaciones','ver')`;
- **acceso a la operación relacionada.** Se usa el mismo chequeo que la pantalla de origen: el permiso del tipo de membresía, `particulares` o `asistencia` según la operación, y el alcance de `rol_visibilidad` donde haya selector.

Se lee por acciones del servidor que verifican las dos condiciones. RLS sin `select` directo para `authenticated`, salvo para administración. Escribir, publicar o liberar se verifica en cada acción del servidor.

### 5.5 Versiones
- Trigger: cuando una versión tiene `publicado_en`, su cuerpo, esquema, asunto y políticas no cambian **nunca**, aunque se retire. Solo puede pasar a `retirado`. No se borra si algún aviso o documento la referencia.
- **Composición fijada:** un contenido que compone políticas guarda los **ids exactos** de esas versiones de política. Adoptar una política nueva = publicar una versión nueva de la composición y liberarla. **No hay selección automática de la «vigente».**

### 5.6 Destinos
- Columnas nuevas `contactos.whatsapp_revision` y `email_revision` (entero), que un trigger sube en **cada** cambio del valor. Así A → B → A da revisión 3, no «igual».
- El aviso guarda el destino y su revisión. La verificación (`contacto_verificaciones`, 7b/8a) se guarda contra la revisión.
- Antes de despachar un pendiente (etapa H9), si la revisión cambió, se resuelven otra vez el destino, el destinatario, el consentimiento y la verificación.

### 5.7 Estados
- **Estado del aviso:** `preparado | bloqueado | cancelado | fallido`.
- **Acciones** (solo agregar): `abierto_whatsapp`, `copiado`, `reintento`, `respaldo_usado`, y **`declarado_enviado`**, con `naturaleza='declaracion_operador'`, actor, hora, destino y texto.
- Los estados del proveedor (`aceptado`, `entregado`, `leido`, `rebotado`) van en otra tabla, `aviso_entregas`, con `naturaleza='proveedor'`, en la etapa de la API. Nunca se mezclan ni se infieren.

### 5.8 Modelo resultante (ajustes sobre la v1)
- **Se mantiene:** `contenidos`, `contenido_versiones`, `contenido_usos`, `contenido_usos_historial`, `avisos`, `aviso_acciones`, `documentos_emitidos`.
- **Cambios:**
  - `avisos` suma `fuente_evento`, `id_evento`, `finalidad`, `destino_revision` y `contactabilidad` (el estado de §3.1 en ese momento);
  - `contenido_versiones` suma `url_oficial` y `etiqueta` (por ejemplo «Oct 2026»);
  - `contactos` suma las revisiones;
  - `consentimientos` no cambia, solo se suman valores de catálogo.
- **Se eliminan del plan** `politicas` y `membresia_eventos` como tablas separadas.

---

## 6. Certificaciones sobre la base común (entrega 7a)

### 6.1 Qué entiendo por «certificaciones»
**Es una interpretación; si es otra cosa, corregime.** Entiendo que son los documentos emitidos para el alumno o titular con políticas, empezando por el **reporte de la membresía (D06) con su hoja 2 de políticas P01–P03**.

El mockup es `design_handoff_reporte_membresia/Ficha de membresia.dc.html`. Sus ajustes de «Políticas» ya enlazan cada campo con su origen.

### 6.2 Compatibilidad del mockup con la base común
| Campo del mockup | Origen | Encaje |
|---|---|---|
| `plazoCancel` | `parametros.reserva_cancelacion_plazo_horas` | variable del esquema P02/P03, congelada en la emisión |
| `solicitudValidez` | `parametros.reserva_solicitud_validez_horas` | ídem |
| `pruebaAcreditaDias` | `planes.prueba_plazo_dias`, y si no tiene, `parametros.prueba_plazo_dias` (0023) | ídem. El adaptador resuelve el orden. |
| `politicaVersion` | `contenido_versiones.etiqueta` de la política **fijada en la composición** | antes era «la vigente»; ahora es la versión exacta liberada |
| `politicaOficialUrl` | `contenido_versiones.url_oficial` | «Ver política oficial completa» solo si existe |
| Hoja 1 (estado) | `obtenerMembresia` (fichas) | se renderiza y se guarda el **snapshot** en `documentos_emitidos` |

**Cambios visibles que necesitan revisión de Design:**
- la versión y la emisión visibles («Emitido el … · versión …»);
- reimprimir una emisión anterior frente a emitir una nueva;
- la entrada en el historial;
- los estados del envío (preparado, abierto, copiado, declarado), **sin «enviado» al abrir WhatsApp**;
- el estado «sin política liberada para este tipo».

### 6.3 Reglas
- Cada emisión guarda el contenido renderizado, las versiones de la composición y de cada política, y los parámetros resueltos.
- **Reimprimir dibuja el snapshot.** Emitir de nuevo crea otra emisión.
- Las políticas base P01–P03 se cargan como **predeterminado o borrador** con los textos literales de las guías de octubre de 2026 (handoff `referencias/`), en la importación idempotente. Una versión oficial solo existe si la publicás (§6.5).
- **Política aplicable ≠ política vigente al emitir.**
  - La política aplicable es la que rige esa membresía. La vigente al emitir es la última publicada.
  - El documento muestra la **aplicable**.
  - No se aplican condiciones posteriores a membresías anteriores sin una regla expresamente aprobada.
- **Decisión C4 (pendiente, condiciona E7a):** cómo se determina la política aplicable de una membresía. Una opción es la versión liberada a la fecha de la venta, guardada con la membresía. Hoy los parámetros (por ejemplo `reserva_cancelacion_plazo_horas`) son globales y no tienen snapshot por membresía, así que hay que decidir qué valor rige para las anteriores.
- Cada emisión guarda la **copia** de los parámetros y versiones usados. La reimpresión reproduce la emisión original.

### 6.4 Plan viejo de la fase 4: qué queda sin efecto
El plan viejo se marca «antecedente archivado, no ejecutable». Quedan anuladas estas instrucciones:
- las tablas `politicas` y `membresia_eventos`;
- la selección de política por `vigente_desde ≤ hoy`;
- registrar «Reporte enviado por WhatsApp» al tocar el botón.

Siguen valiendo como insumo:
- las respuestas sobre hoja 1, impresión y PDF, y las clases futuras;
- `ImprimirCuenta`/`construirHTMLImpresion` como patrón;
- el e2e por tipo.

### 6.5 Dependencias mínimas
Las certificaciones necesitan:
- de **E4**: el motor, `contenidos`/`contenido_versiones` y `documentos_emitidos`;
- de **E3**: la revisión del mockup;
- para el envío asistido: `avisos` y `aviso_acciones` (también en E4).

**No necesitan** E5 (conectar N09–N10) ni E6 (el editor).

**Publicación oficial sin editor.** Una migración **solo** puede importar contenido como predeterminado o borrador; **nunca lo publica**. Mientras no exista el editor, el procedimiento mínimo y auditable es este:
1. Se presenta la versión exacta (id, hash, texto renderizado con datos ficticios) y los usos a liberar, en el PR o en el turno.
2. Vos aprobás explícitamente **esa versión y esos usos**.
3. Una acción del servidor, `publicarVersion(version_id, usos, evidencia)`, ejecutada con tu sesión:
   - verifica `comunicaciones.publicar` y que el hash coincida con el aprobado;
   - registra en `contenido_usos_historial` el actor, la fecha, el hash y la referencia de la aprobación (PR o fecha del turno).
4. Sin esa fila no hay versión oficial. El control SQL lo verifica.

---

## 7. Entregas, dependencias y aprobaciones
Cada entrega tiene su **aprobación de alcance**. Cada cambio visible necesita **diseño aprobado** y cada pase a producción, **autorización separada**. Aprobar el diseño o la implementación **no publica contenidos oficiales ni habilita envíos externos**.

| # | Entregable | Depende de (piezas) | Evidencia y criterio de aprobación |
|---|---|---|---|
| **E1** | Este plan v2: discrepancias, decisiones, matriz, inventario con pendientes, dependencias | — | Tu aprobación del alcance |
| **E2** Caracterización y extracción | **(a)** Se capturan las referencias del código **actual** con datos ficticios, por variante, y se commitean **antes** de mover nada.<br>**(b)** B1–B9 pasan a funciones puras en `src/lib/comunicaciones/legado/`.<br>**(c)** Motor de plantillas puro (parser, render, filtros cerrados, sin base de datos). Va aquí y no en E4 porque sin él no se puede demostrar la plantilla.<br>**(d)** Plantilla, esquema y adaptador por caso.<br>**(e)** Script de inventario. | E1 | • Las pruebas `strictEqual` dan: referencia = legado trasladado = render de la plantilla, en **todas** las variantes de los 21 casos.<br>• Informe de equivalencia por variante (id, resultado).<br>• Se cumplen los criterios de §1.4.<br>• El script de inventario no encuentra consumidores fuera del inventario.<br>• `tsc` y `npm test` en verde.<br>• Cero cambios de texto en pantalla.<br>• **Ningún flujo cambia.** |
| **E3** Diseño | Mockups de S01 (catálogo), S02 (editor con la plantilla capturada y las variables protegidas), S03 (publicación y liberación), S04 (historial), S05 (ajuste al aviso actual) y la revisión del mockup de certificaciones | E1. Para el editor, las plantillas de N09–N10 de E2 (las primeras que se extraen). Lo demás puede ir en paralelo a E2. | Mockups aprobados por vos, con los estados de §9 |
| **E4** Bases del módulo | • Migración (la próxima libre, hoy 0071): las 7 tablas, las revisiones de destino, el catálogo de finalidades, el módulo `comunicaciones` y sus permisos, los triggers de inmutabilidad, los controles nuevos (`no_contactar` con procedencia, versiones publicadas intactas).<br>• `resolverContenido`.<br>• **Importación idempotente** de los predeterminados y de P01–P03.<br>• Todos los usos en `legado`. | E2 (c) y (d) | • Importar dos veces = sin duplicados.<br>• Una versión oficial preexistente queda intacta.<br>• Pruebas unitarias del resolvedor.<br>• Controles en 0.<br>• Rollback de una instalación vacía probado en dev.<br>• **Ningún flujo cambia** (e2e de humo de una reserva).<br>• Medición M1 hecha antes del pase. |
| **E5** Primer flujo conectado | N09–N10 `reserva.confirmada` en `modo='modulo'` con el predeterminado, más S05 (registro de preparado, acciones y declaración, advertencia de contactabilidad) | E4 + S05 aprobado + regla de `no_contactar` aprobada (C1) | En dev:<br>• igualdad carácter por carácter de todas las variantes, en vivo;<br>• destinatario registrado = destinatario del botón (menor, organización);<br>• doble clic o reintento = 1 aviso;<br>• falla de registro simulada con la operación intacta y el texto conservado;<br>• rechazo explícito = no se prepara el aviso y la reserva se confirma igual;<br>• vuelta a `legado` demostrada con el historial conservado. |
| **E6** Administración e historial | S01–S04: edición, revisión, publicación y liberación por uso, retiro y reversión; historial con permisos por operación | E4 + mockups S01–S04. **No necesita E5** para editar, pero sí para ver avisos reales en el historial. | • Borrador o aprobado no cambian nada.<br>• Publicar cambia solo los usos elegidos y los avisos nuevos.<br>• Retirar y revertir conservan el histórico.<br>• Sin `ver` o sin acceso a la operación = sin acceso. |
| **E7a** Certificaciones | D06 con P01–P03 sobre la base común; emisión, reimpresión y envío asistido | E4 + revisión del mockup (E3). **No necesita** E5 ni E6. | • Emitir, cambiar un parámetro y publicar otra política no cambian la reimpresión.<br>• La versión visible es la fijada.<br>• Al abrir WhatsApp no se registra «enviado».<br>• e2e por tipo. |
| **E7b** Expansión | Un incremento por caso, en este orden: N11–N12, N19–N21, N17–N18, N15–N16, N13–N14, N07–N08, N01–N06. Además: emisiones de D01, D03 y D05; revisión R21; email en los datos (sin envío) | E5 (el patrón) + E2 de ese caso. Lo que tenga cambio visible, con su diseño. | Los mismos criterios de E5, por caso |
| **E8** Regularización y después | **8a:** censo, formulario por enlace y S06 (§4).<br>**8b:** H9 y recordatorios R32 (10 h hábiles ≠ 8 h de cancelación).<br>**8c:** email real (proveedor y remitente).<br>**8d:** API de WhatsApp y CRM (D25, D26).<br>**8e:** popup, cuando exista la app. | **8a:** E4 (el catálogo de finalidades) + su diseño.<br>**8b:** E5/E7b de los casos que recuerda.<br>**8c:** tu decisión del proveedor.<br>**8d:** 8a + la cuenta oficial.<br>**8e:** la app. | Por subetapa, con su propio plan |

**Ruta crítica más corta:** E2 → E4 → (E5 y E7a en paralelo, con sus diseños) → E6 → E7b. E3 corre en paralelo desde ya.

## 8. Matriz de requisitos (1.1)
Estados: **C** = cubierto en el plan · **P** = pendiente, con su entrega · **D** = necesita decisión.

| Req. | Estado | Entrega | Nota |
|---|---|---|---|
| R01 | C | E4–E6 | |
| R02 | P | E2 | plantillas ejecutables |
| R03 | C | E4/E6 | |
| R04 | P | E2 | script de inventario + R21 en E7b |
| R05 | C | E2 | claves `<dominio>.<evento>.<destinatario>` |
| R06 | P | E2 | semillas ficticias; control sin datos de producción |
| R07 | P | E2 | |
| R08 | P | E2/E5 | referencias capturadas antes de mover el código |
| R09 | C | E4 | |
| R10 | C | E4 | |
| R11 | C | E4 | inmutable tras publicar |
| R12 | C | E4 | |
| R13 | C | E4/E7a | |
| R14 | C | E4/E5 | `texto_usado`: decisión C3 |
| R15 | C | E4/E7a | composición fijada |
| R16 | D | E7a | **C4:** congelar al emitir |
| R17 | C | E4 | canal por contenido |
| R18 | D | E4 | **C5:** retención y sensibilidad |
| R19 | C | E4/E6 | |
| R20 | D | E4/E6 | **C6:** roles editoriales |
| R21 | C | E6 | |
| R22 | C | E4 | |
| R23 | C | E5 | §5.3 |
| R24 | C | E4/E6 | |
| R25 | C | E4 | `modo` por caso |
| R26 | C | E7b | |
| R27 | C | E5 | |
| R28 | C | E5 | |
| R29 | C | E5 | §5.7 |
| R30 | C | E5 | |
| R31 | P | 8d | |
| R32 | C | E4/E5 | §5.1 |
| R33 | P | E2/8d | multidestinatario; teléfono compartido = D25 |
| R34 | C | E6 | pendientes programados en 8b |
| R35 | C | E7a/E7b | |
| R36 | P | E4/8a | formato y revisión en E4; verificación en 8a |
| R37 | C | E2 | dA, dT y cA intactos; unificarlos es D-nueva |
| R38 | D | E4/E5 | **C1:** regla de `no_contactar` y advertencias |
| R39 | C | E4/8b | revisión de destino |
| R40 | C | 8d | D25 y D26 pendientes |
| R41 | C | E4 | contrato v1 + `finalidad`, `destino_revision` |
| R42 | C | 8d | |
| R44–R45 | P | E2 | |
| S01–S05 | P | E3 | |
| S06 | P | 8a | |
| A01 | P | E2 | |
| A02 | P | E5 | |
| A03 | P | E6 | |
| A04 | P | E5 | |
| A05 | P | E7a | |
| A06 | P | E5/8a | |
| A07 | P | E2/E6 | |
| A08 | C | §10 | |

## 9. Paquete para Claude Design (listo para entregar)
- **Componentes que se mantienen:** `Pagina`/`EncabezadoPagina`, `Aviso` (`components/nuevo`), `AvisoWhatsapp`, `AvisosAfectados`, `FilaReserva`, `TarjetaConfirmacion`, el patrón de Administración (`ClienteCatalogos`, `FilaParametro`, `MatrizPermisos`), el modo enfoque y el menú plegable.
- **Datos ficticios:**
  - Ana Pérez, menor, con su tutor Luis Pérez;
  - Colegio Sol, con persona de contacto;
  - el profesor Mario Rojas;
  - una reserva «vie 02/10 de 15:00 a 16:00» en «Tropicana (Sala 1)», con un saldo de 7.5 h de 10 h;
  - **las plantillas reales capturadas de N09–N10** en E2, con sus variables.
- **Pantallas del primer alcance:**
  - **S01** catálogo: filtros por evento, tipo, canal, estado editorial y conexión (legado o módulo).
  - **S02** editor:
    - abre la plantilla capturada;
    - las variables son fichas protegidas con su explicación y un ejemplo;
    - no deja renombrar ni borrar las obligatorias;
    - vista previa ficticia, errores de sintaxis y de variables faltantes.
  - **S03** revisión y liberación:
    - comparación con el texto vigente;
    - usos afectados;
    - aprobar ≠ publicar ≠ liberar;
    - retirar y revertir con motivo.
  - **S04** historial y detalle.
  - **S05** ajuste al aviso actual:
    - un clic para WhatsApp y Copiar, igual que hoy;
    - origen del contenido;
    - «Marcar como enviado» opcional (es una declaración);
    - advertencia de contactabilidad;
    - rechazo explícito;
    - error de registro con el texto oficial conservado;
    - respaldo autorizado.
  - **Certificaciones:** revisión del mockup existente con los cambios de §6.2.
- **Estados que hay que dibujar en todas:** vacío, cargando, error, sin permiso, destino inválido, variable faltante, error de registro, respaldo autorizado, consentimiento pendiente o rechazado.
- **Fuera de este diseño:** S06, formulario de regularización, bandeja programada, CRM, campañas, IA, popup.

## 10. Primer incremento recomendado: **E2, caracterización y extracción**
**Incluye:**
- referencias capturadas de los 21 casos y todas sus variantes;
- el traslado de B1–B9 a funciones puras;
- el motor de plantillas puro;
- plantilla, esquema y adaptador por caso;
- el informe de equivalencia;
- el script de inventario.

Arranca por N09–N10, para alimentar el diseño del editor.

**Excluye:**
- migraciones y tablas;
- cambios visibles;
- conectar cualquier flujo;
- tocar `no_contactar` o el consentimiento;
- editar textos, incluso las rarezas, que se reproducen tal cual.

**Riesgo:** nulo para la operación. La única modificación de código es mover funciones, protegido por las referencias capturadas antes.

**Evidencia para aprobar E2:**
- el informe por variante con 0 diferencias;
- el script de inventario en verde;
- `tsc` y `npm test`;
- un e2e de humo de una reserva, sin cambios.

**Activación gradual y reversión con conservación de datos** (resumen de §5.2 y §7):
- E4 instala todo en `legado`;
- cada caso pasa a `modulo` por separado, en dev y luego en producción, con tu OK;
- la vuelta es `legado`, con el historial intacto;
- nunca se borran avisos, versiones ni documentos.

### Decisiones
**Condicionan E4 y E5:**
- **C1:** la regla de `no_contactar` y de contactabilidad de §3.1–3.2. Recomiendo la propuesta tal cual.
- **C2:** el mapeo de los consentimientos v1 de §3.3.
- **C3:** no permitir editar el texto al enviar. `texto_usado` queda previsto.
- **C5 (pendiente, no aprobada):** retención del historial. La propuesta es sin límite, con acceso por permiso y por operación.
- **C6:** al principio, vos editás, revisás y publicás; recepción usa y declara.

**Condicionan E7a:**
- **C4:** congelar la política al emitir.
- Confirmar que «certificaciones» = D06/P01–P03.

**Confirmar:** N09–N10 como primer flujo conectado. La alternativa más segura es N21.

**Mediciones pendientes:**
- **M1:** `no_contactar` y consentimientos en producción. Es una lectura, pero necesita tu OK.

**No condicionan:**
- email (8c);
- API de WhatsApp (8d);
- D25 y D26;
- unificar las reglas de destinatario para menores (D-nueva).
