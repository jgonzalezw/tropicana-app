# R20 · Capa interna de documentos y notificaciones — Etapa 0: inventario y plan

**9 de octubre de 2026.** Este es el plan preliminar a los requisitos 1.1, *Tropicana_Requisitos_Capa_Interna_Documentos_Notificaciones*. Los contrasté con la especificación de comunicaciones 2.1, los requisitos de la plataforma 0.3, el informe de Code y el repo en `main` `4b1d4c6`.
**Alcance de este encargo:** inventario y plan. No se implementa nada ni se corren migraciones.

## Qué pasa al aprobar este plan (solo documentos, sin código)
1. Abro la rama `r20-notificaciones` desde `main`.
2. Guardo este documento en `docs/relevamientos/2026-10-09-plan-r20-notificaciones.md`.
3. Guardo el plan de la fase 4 (Anexo A, sin cambios) en `docs/relevamientos/2026-10-09-plan-i012-fase-4-reporte.md`. No se pisa ningún plan anterior.
4. Lo publico como **documento exportable** (Claude Docs, con exportación a Word o PDF) y te paso el enlace.
5. Reescribo `docs/RETOMAR.md`:
   - el carril R20 queda en la etapa 0, con el plan entregado;
   - I-012 fase 4 queda en PAUSA (estado A), esperando la etapa 3 de R20.
6. Agrego un bloque corto en `ESTADO`. Commit `[R20] Etapa 0: inventario y plan de comunicaciones`, PR, y el merge solo con tu OK.
7. **No implemento el incremento 1.1 hasta que lo pidas.** Eso sigue al prompt de implementación del documento de prompts.

---

## 1. Inventario por ficha, con evidencia

### 1.1 Piezas comunes (verificadas)
| Pieza | Archivo | Qué hace hoy |
|---|---|---|
| `AvisoWhatsapp` | `src/components/AvisoWhatsapp.tsx:27-93` | Props: `nombre`, `whatsapp`, `mensaje`, `onEnviado?`.<br>• Botón que llama a `abrirWhatsapp`, y «Copiar mensaje» con `navigator.clipboard`.<br>• Si el número no está en formato, el botón queda deshabilitado con la explicación.<br>• No registra nada. |
| `abrirWhatsapp` | `src/lib/whatsappCliente.ts:26-50` | Intenta primero `whatsapp://`.<br>• Si a los 1200 ms la pestaña no perdió el foco, abre `wa.me`.<br>• Si el diálogo del navegador se cancela, no hay respaldo. |
| `urlChatWhatsapp` / `urlAppWhatsapp` | `src/lib/contactos.ts:199/218` | Aplican `trim()` y `encodeURIComponent` al texto. Validan el número: «+» y 8 dígitos o más. |
| `normalizarWhatsapp` / `whatsappEnFormato` | `src/lib/contactos.ts:26/37`, SQL `normalizar_whatsapp` (0048) | Agregan `+591` y validan con `^\+591\d{8}$`. |
| `destinatarioAviso` (dA) | `src/lib/venta/destinatarioAviso.ts:13-30` | Si es menor y tiene tutor (`tutor_de`, `limit 1`, sin orden), el aviso va al tutor:<br>• nombre: «Tutor (tutor de Alumno)»;<br>• WhatsApp: el del tutor, aunque sea null.<br>Si no, va al propio alumno. |
| `destinatarioDeTitular` (dT) | `src/lib/destinatarioTitular.ts:14-41` | Si el titular es una organización, va a la primera persona `trabaja_en` activa con WhatsApp (por id). Si no hay ninguna, va a la organización. |
| `contactosDeAlumnos` (cA) | `src/lib/avisosClase.ts:81-118` | El aviso va al alumno con su propio nombre. Usa el WhatsApp del tutor **solo si el menor no tiene WhatsApp propio**. |
| `leerTitular` | `src/lib/membresiasLectura.ts:497-520` | Arma la regla de la ficha:<br>• menor → dA;<br>• organización en alquiler → dT;<br>• cualquier otro caso → el titular. |
| Contenedores (solo muestran el `mensaje`) | `ConfirmacionVenta`, `AvisosAfectados`, `GestionReserva`, `NuevaReserva`, `FilaReserva`, `AvisosFicha`, `TarjetaConfirmacion` | No generan texto. `TarjetaConfirmacion` solo se usa en `/membresias/muestrario`, que es una demo. |

### 1.2 Fichas de mensajes (18 casos, 22 combinaciones de variante y destinatario)
Clave estable: `<dominio>.<evento>.<destinatario>`. Canal actual: WhatsApp asistido + Copiar en **todas**. Canal futuro: email en todas; popup cuando exista la app.

Generadores (detalle en el Anexo B):
- A1 = `mensajeInscripcion.ts`;
- A2 = `avisosClase.ts`;
- B0–B9 = textos armados dentro de las acciones.

| # | Clave | Disparador (acción, archivo:línea) | Generador | Destinatario | Variantes que hay que cubrir | Pruebas hoy |
|---|---|---|---|---|---|---|
| N01 | `venta.inscripcion.alumno` | `inscribirYCobrar`, `inscribir/acciones.ts:451-511` | A1 `mensajeConfirmacionInscripcion` | dA | • menor / adulto<br>• 1 curso / varios<br>• curso con o sin días u horario<br>• ilimitado / N clases<br>• bono: sin bono / bono de 1 curso / de varios<br>• fin de ciclo sí / no<br>• tolerancia 0 / 1 / más de 1<br>• crédito de prueba<br>• cobrado con medio, sin medio, sin pago<br>• saldo con compromiso, sin compromiso, saldada | regex en `mensajeInscripcion.test.ts` |
| N02 | `venta.recibo.alumno` | ídem, L503, **solo si `porPlata > 0`** | A1 `mensajeReciboPago` | dA | • medio sí / no<br>• saldo con o sin compromiso / saldada | regex |
| N03 | `venta.prueba.alumno` | `venderPrueba`, `acciones.ts:982-986` | B7, dentro de la acción | dA | • menor / adulto<br>• 1 o N personas<br>• 0, 1 o N clases. Con 0 clases el texto queda «…):. ¡Te esperamos!» y se conserva así. | ninguna |
| N04 | `venta.particular.alumno` | `venderParticular`, `acciones.ts:1623-1652` | B8 | dA | • agenda fija con 1 o N sesiones / flexible<br>• resto por coordinar sí / no<br>• sala externa / Tropicana | ninguna |
| N05 | `venta.particular.profesor` | ídem | B8 | profesor | ídem. El nombre del alumno puede ser «X (tutor de Y)» (ver discrepancia 4). | ninguna |
| N06 | `venta.alquiler.titular` | `venderAlquiler`, `accionesAlquiler.ts:512-528` | B9 | dT | • el titular / la persona de contacto de una organización («¡Los esperamos!»)<br>• resto sí / no<br>• externa / Tropicana | ninguna |
| N07–N08 | `reserva.solicitada.{alumno,profesor}` | `crearReserva` con «solicitar», `particulares/acciones.ts:1105-1116` | B1 | dA o dT / profesor | • particular / alquiler (el alquiler no tiene profesor)<br>• lugar: externa / sala / «Tropicana» | ninguna |
| N09–N10 | `reserva.confirmada.{alumno,profesor}` | `crearReserva` con «confirmar» (1117-1126) **y** `cambiarEstadoReserva` → confirmada (1449-1458). El texto es el mismo; reagendar solo cambia el mensaje en pantalla. | B1 / B2 | ídem | • particular / alquiler<br>• lugar<br>• saldo (horas con decimales) | ninguna |
| N11–N12 | `reserva.suspendida.{alumno,profesor}` | `cambiarEstadoReserva` → suspendida (1459-1467, motivo del catálogo); `suspenderReservaOperativa` (1522-1532, motivo de C5 o de bloqueo) | B2 / B3 | ídem | El motivo viene de 3 fuentes:<br>• catálogo;<br>• C5 «etiqueta (glosa)» o, si no hay, «un cierre de sala»;<br>• bloqueo «etiqueta — glosa».<br>El alumno lleva la primera letra en mayúscula. | ninguna |
| N13–N14 | `reserva.restablecida.{alumno,profesor}` | `revertirSuspension` (1635-1646), al cancelar un bloqueo | B4 | ídem | particular / alquiler | ninguna |
| N15–N16 | `reserva.reprogramada.{alumno,profesor}` | `reprogramarReserva` / `moverReserva` (1780-1792) | B5 | ídem | • antes / ahora<br>• lugar | ninguna |
| N17–N18 | `reserva.cancelada_pedido.{alumno,profesor}` | `cancelarAPedido` (1899-1920) | B6 | ídem | • **en plazo / fuera de plazo** (`reserva_cancelacion_plazo_horas`)<br>• particular / alquiler | ninguna |
| N19 | `clase.suspendida.alumno` | `suspenderClase`, `asistencia/acciones.ts:1241-1269`; C5 `guardarHorarioSala`, `administracion/sala/acciones.ts:540-597` | A2 `mensajeSuspension` | cA | • 1 o N clases<br>• fin de ciclo corrido sí / no<br>• motivo: texto libre o «una decisión de la escuela» (asistencia); «etiqueta (glosa)» o «un cierre» (C5) | regex en `avisosClase.test.ts` |
| N20 | `clase.suspendida.profesor` | `suspenderClase` (`avisoProfesorTitular`). **C5 no lo emite.** | A2 `mensajeSuspensionProfesor` | profesor | sin ramas | regex |
| N21 | `clase.reabierta.alumno` | `reabrirSesion`, `asistencia/acciones.ts:1468-1484` | A2 `mensajeReapertura` | cA | • fin de ciclo sí / no<br>• curso «tu curso» de respaldo | regex |

Formateadores que se preservan tal cual (Anexo B-D):

| Formateador | Ejemplo de salida | Archivo |
|---|---|---|
| `gs` | «Bs. 1.234,50» | `inscripcion.ts:226` |
| `fechaLarga` / `fmtLarga` | «mié 3 sep» | |
| `horario` / `fechaHoraCorta` | «vie 02/10 de 15:00 a 16:00» | `particulares/acciones.ts:171-184` |
| `formatearAgenda` | «lun 05/10 18:00, …» | `agendaSala.ts:66` |
| `formatearHoras` | «7.5» | |
| `rotuloDiasMembresia` | «lunes y miércoles» | |
| `rangoHorario` | «19:00 → 20:30» | |
| `nombreCompleto` | | |

En cada ficha falta completar estos campos, que se cargan en el incremento 1.1:
- plantilla ejecutable;
- esquema de variables;
- casos de prueba por variante;
- la evidencia de equivalencia.

Lo único que hay hoy es el texto literal (Anexo B). Por R43, la ficha **no está completa** hasta que existan esos campos.

**Sensibilidad:**
- N01, N02 y N06 llevan importes. Sensibilidad media.
- El resto lleva datos de agenda. Sensibilidad baja.

**Responsable:** recepción. **Acciones disponibles:** abrir WhatsApp y copiar.

### 1.3 Fichas de documentos
| # | Clave | Archivo | Qué es | Políticas | Cambia en R20 |
|---|---|---|---|---|---|
| D01 | `doc.recibo` | `caja/recibo/[id]/Recibo.tsx:70-81, 224-317` | Recibo de cobro o de pago, numerado. Se imprime con `window.open` y `print`. | ninguna | Etapa 3: se registra la emisión. El formato no cambia. |
| D02 | `doc.estado_cuenta_alumno` | `alumnos/[id]/cuenta/ImprimirCuenta.tsx` | Estado de cuenta | ninguna | Etapa 3: lo reemplaza el reporte de la membresía en la ficha. En el alumno, se decide. |
| D03 | `doc.comprobante_liquidacion` | `liquidaciones/[id]/Comprobante.tsx` | Comprobante de liquidación del profesor | ninguna | Etapa 3: se registra la emisión |
| D04 | `doc.preliquidacion` (interno) | `lib/liquidacion/imprimirPre.ts:49` | Reporte interno | no aplica | Queda fuera: no es una comunicación |
| D05 | `doc.retiro_profesor` | `lib/liquidacion/imprimirRetiro.ts:21` | Liquidación final del profesor | ninguna | Etapa 3: se registra la emisión |
| D06 | `doc.reporte_membresia` (**nuevo**) | Plan de la fase 4 (Anexo A) | Reporte de dos hojas, con políticas por tipo | regular, particular, alquiler | Etapa 3: se construye sobre la capa común |
| P01–P03 | `politica.{regular,particular,alquiler}` | handoff de la fase 4 | Hoja 2 del reporte, con marcadores tomados de `parametros` | — | Etapa 3 |
| P00 | `politica.consentimiento_contacto` | tabla **`politicas_texto`** (0048) | Texto legal del consentimiento, v1 «contacto» | — | No se migra. Se documenta que existe. |

### 1.4 Fuera del inventario de avisos (verificados)
- **Copiar resumen** de `ConfirmacionVenta.tsx:29`: es un resumen interno.
- **`avisoDeImpacto`** (`periodos.ts:189`, «Copiar aviso» en asistencia): es un aviso al operador.
- Los **mensajes en pantalla** de las acciones.
- **`EnlaceWhatsapp` / `AbrirChatWhatsapp`**: abren el chat sin texto.

### 1.5 Candidatos R21 (inventariarlos no implica agregarles WhatsApp)
| Pantalla | Mensaje o acción | Ubicación |
|---|---|---|
| Asistencia | «Asistencia guardada» | `ClienteAsistencia.tsx:274` |
| Caja | Cobro o pago | `MovimientoCaja.tsx:275`, solo enlaza el recibo |
| Liquidaciones | «Liquidación generada», «Pago registrado» | `ClienteLiquidaciones.tsx:125,162` |
| Retiro de profesor | Retiro confirmado | `ClienteRetiro.tsx:173` |
| Reservas | Ausente / realizada / cortesía, sin aviso | `particulares/acciones.ts:940, 1444` |
| Sala | Lugar externo guardado | `LugarExterno.tsx:107` |
| Sala | Bloqueo sin afectados | `ClienteDisponibilidadSala.tsx:144,174,313` |
| Alumnos y profesores | Baja y reactivación | `ClienteAlumnos`, `ClienteProfesores` |
| Usuarios | Usuario creado, contraseña cambiada | `FormularioNuevoUsuario.tsx:30`, `FilaUsuario.tsx:222,252` |

**Huecos que se agregan a R21:**
- `revertirLigadas` (`administracion/sala/acciones.ts:347-364`) descarta los avisos cuando se borra una excepción.
- `cancelarReservaSala` con `sin_revertir` no avisa.
- C5 no avisa al profesor de las clases de curso.

## 2. Discrepancias y decisiones

**Contra el informe de Code:**
1. **El §6 de `PLAN_CIERRE_ETAPA1_v2_MOTOR` no trata de notificaciones**: trata del refresh de producción a local. El esquema de tres piezas (eventos, reglas, plantillas) está en el **§0, renglón 6** (líneas 28-30), y la tabla del §1 lo marca como «Nuevo» (línea 59).
2. **No son 9 pantallas.** Son **15 operaciones** que generan avisos y salen por 7 contenedores, más el muestrario de demostración.
3. **Ya existe una tabla `politicas_texto`** (0048, el texto del consentimiento). El nombre `politicas` del plan de la fase 4 se confundiría con ella. Por eso las políticas del reporte pasan a ser contenidos de tipo «politica» del catálogo común (sección 3).

**Contra los requisitos y el código:**

4. **Hay tres reglas de destinatario que no coinciden para un menor:**
   - **dA (ventas y reservas):** siempre al tutor, aunque el menor tenga WhatsApp propio y aunque el tutor no tenga; nombre «X (tutor de Y)».
   - **cA (clases de curso):** al menor con su número; el del tutor solo si el menor no tiene.
   - **dA en N05:** el aviso al profesor dice «con {tutor (tutor de alumno)}».

   **Se preservan tal cual** (R37 y equivalencia). Unificarlas es una **decisión de negocio**, y queda propuesta como D-nueva con el disparador «etapa 3 o un caso real».
5. **Ningún aviso consulta `no_contactar` ni el consentimiento.** Solo `contactos/accionesVenta.ts:449-463` calcula `avisoWhatsapp`, y ninguna pantalla lo lee. Los requisitos (R38, R27) piden que el consentimiento gobierne el envío.
   - Si se empieza a bloquear, cambia la operación.
   - Por eso es la **decisión 3** de la sección 10: propongo mostrar «no contactar» como advertencia en la etapa 2 y bloquear recién cuando lo decidas.
6. **El consentimiento tiene una sola finalidad** (`contacto`), sin separar servicio y marketing. Alcanza para los avisos de servicio. Las campañas quedan fuera del alcance.
7. **La tarjeta de demostración dice «registrado en el historial» sin ningún respaldo.** Esa tarjeta se diseña de nuevo en S05.
8. **El email no se valida:** existe `contactos.email`, pero nunca se valida. Etapa 3: la validación de formato se muestra sin bloquear.
9. **Hay rarezas en los textos actuales** que la equivalencia obliga a reproducir:
   - «…):.» en una prueba sin clases;
   - «?» cuando no hay duración;
   - horas sin formatear en N04 y N06;
   - dos textos de «resto» distintos;
   - el respaldo del motivo es distinto en C5 cursos y en C5 reservas.

   Se corrigen **después**, con una versión editada.
10. **D25 y D26 siguen postergadas.** Normalizar el número no resuelve D26.

## 3. Modelo y contrato propuestos

**Principio:** una sola capa nueva, de 7 tablas. No hay un segundo CRM:
- los destinos se leen de `contactos`;
- las reglas de destinatario siguen en el código: dA, dT, cA.

**Catálogo y versiones** (`politica` y `documento` usan el mismo mecanismo que `mensaje`):
```
contenidos             id, clave unique, tipo ('mensaje'|'politica'|'documento'), caso_uso, variante,
                       canal ('whatsapp'|'email'|'documento'|'popup'), destinatario_rol, idioma 'es',
                       producto 'tropicana', descripcion, esquema jsonb (vocabulario de marcadores), activo
contenido_versiones    id, contenido_id, numero, origen ('predeterminado'|'oficial'),
                       estado ('borrador'|'en_revision'|'aprobado'|'publicado'|'retirado'),
                       asunto (email), cuerpo, politicas jsonb [ids de versiones de política que compone],
                       hash_cuerpo, autor/creado_en, revisado_por/en, publicado_por/en, observaciones
                       — trigger: inmutable si publicado; único (contenido_id, origen='predeterminado', hash_cuerpo)
contenido_usos         id, caso_uso, variante, canal, modo ('legado'|'modulo') ← interruptor por caso (R25),
                       version_id null (null = predeterminado vigente), liberado_por/en
contenido_usos_historial  solo agregar: uso_id, accion ('liberar'|'retirar'|'revertir'|'modo'), de/a, motivo, actor, en
```

**Registro de comunicaciones:**
```
avisos                 id, evento_id uuid, evento_tipo, evento_version, operacion_tipo, operacion_id,
                       membresia_id null, contacto_id (destinatario), via_relacion null ('tutor_de'|'trabaja_en'),
                       canal, destino (snapshot normalizado), contenido_version_id null, fuente ('oficial'|'predeterminado'|'legado'),
                       texto_preparado, texto_usado null, documento_id null,
                       estado ('preparado'|'confirmado_manual'|'bloqueado'|'cancelado'|'fallido'), motivo,
                       idempotencia unique, correlacion, creado_por/en
aviso_acciones         solo agregar: aviso_id, accion ('preparado'|'abierto_whatsapp'|'copiado'|'confirmado_manual'|
                       'bloqueado'|'cancelado'|'reintento'), actor, en, detalle jsonb
documentos_emitidos    id, tipo (clave doc.*), operacion_tipo/id, contacto_id, contenido_version_id,
                       politicas jsonb (versiones), parametros jsonb (valores congelados), snapshot (html/json),
                       emitido_por/en — reimprimir = renderizar el snapshot
```

**Estados:**
- «abierto» y «copiado» son **acciones**, no estados (R29).
- Los estados del proveedor (aceptado, entregado, leído, rebotado) se suman en la etapa 5, sin migrar lo existente.

**Destinos (etapa 3, S06):**
- Hay una sola tabla nueva, `contacto_verificaciones`, de solo agregar: `contacto_id`, `canal`, `valor_normalizado`, `estado` (pendiente, verificado, inválido), `metodo`, `por`, `en`.
- El formato se **calcula** con `whatsappEnFormato` y con una regex de email.
- «Requiere nueva verificación» se **deriva**: el valor actual ≠ el último verificado.
- El consentimiento sale de `consentimientos_vigentes` y `no_contactar` de `contactos`. Se muestran separados y no se duplican.

**Con la fase 4:**
- Las políticas P01–P03 son `contenidos` de tipo «politica», con versiones.
- El reporte es `doc.reporte_membresia`, que las compone.
- Cada emisión es un `documentos_emitidos` con los parámetros congelados.
- El envío del reporte es un `avisos` con `documento_id`.
- **`membresia_eventos` no nace en la fase 4:**
  - la ficha (`historialDe`) lee los `avisos` y los `documentos_emitidos` de esa membresía;
  - la tabla de eventos de negocio la crean las fases 5–7, cuando haga falta. Si se crea, enlaza con `aviso_id` y no se convierte en envíos (R17, «Dependencias con fase 4»).

**Contrato interno v1** (`src/lib/comunicaciones/contrato.ts`, R41):
- `event_id`, `idempotency_key`, `event_type`, `schema_version`, `occurred_at`
- `product_id`, `tenant_id`
- `operation {tipo, id}`
- `contact_id`, `via` (tutor u organización), `destination {canal, valor, version}`
- `purpose` ('servicio'), `template {clave, version}`, `document_id?`, `actor`, `correlation_id`

No depende de ningún CRM ni proveedor.

**Permisos:**
- Módulo nuevo `comunicaciones`, con las acciones `ver` (historial), `editar` (borradores), `revisar` y `publicar` (liberar y retirar). `rol_permisos.accion` es texto libre (0001:48), así que admite las acciones nuevas.
- Al principio Javier tiene los tres roles editoriales. Recepción solo **usa** el contenido liberado y confirma acciones.
- Se siguen los cuatro pasos de la regla de proceso 11: `MODULOS`, `ETIQUETA_MODULO`, la semilla en la migración y la matriz de permisos.
- RLS: se lee con `tiene_permiso('comunicaciones','ver')` y se escribe con la clave de servicio desde las acciones.

## 4. Resolución y convivencia con el flujo anterior

**Sintaxis de plantilla:** cerrada y sin código.
- `{{variable}}`
- `{{variable|mayuscula_inicial}}`: los filtros son una lista cerrada.
- `{{#si condicion}}…{{#sino}}…{{/si}}`
- `{{#cada lista sep=", " ultimo=" y "}}…{{/cada}}`

**Quién calcula qué:**
- Las **variables llegan ya formateadas** por un *adaptador por caso*, que usa los formateadores actuales. La plantilla no formatea fechas ni importes, así que la equivalencia no depende de reimplementarlos.
- Las **condiciones** son booleanos que calcula el adaptador, como `es_menor`, `fuera_de_plazo` o `hay_saldo`.
- Las reglas de negocio y de destinatario se quedan en el código (R45).

**Vocabulario por caso:** nombre, descripción, fuente, tipo, si es obligatoria, formato y ejemplo. Por ejemplo `{{destinatario.nombre_pila}}`, `{{reserva.cuando}}`, `{{reserva.lugar}}`, `{{saldo.texto}}`.
- Un marcador desconocido, una sintaxis rota o una variable obligatoria vacía hacen que **no se genere el mensaje** (R23, A07).

**Orden de resolución** (`resolverContenido(caso, variante, canal)`):
1. Si el `modo` del uso es `legado`, el generador original y fuente «legado». **Es el valor por defecto de todos los casos al crearse.**
2. Si no, la versión **oficial liberada** del uso.
3. Si no, el **predeterminado** que pasó la equivalencia.
4. Se registra la fuente y la versión que se usaron.

**Fallos:**
- Si falla una versión oficial, no se vuelve en silencio al texto viejo. Se registra la incidencia y se ofrece el respaldo explícito, salvo en contenido sensible (R23).
- Un fallo del catálogo o del registro **no revierte la operación ya confirmada**. Se muestra «No se pudo registrar el aviso», y WhatsApp y Copiar siguen disponibles con el texto legado. En ese caso no se registra un envío falso (R28).

**Cuándo se registra:**
- El `preparado` se registra en la acción del servidor, **después** de confirmar la operación, con `try/catch`.
- «Abierto», «copiado» y «confirmado manualmente» se registran desde el cliente con una acción del servidor. Si esa acción falla, el botón funciona igual y se avisa.

**Idempotencia:**
- La acción del servidor genera un `evento_id` (uuid) cada vez que se ejecuta la operación.
- La clave es `evento_id:caso:variante:contacto_id:canal`.
  - Reabrir o copiar agregan una **acción** al aviso, no un aviso nuevo.
  - Volver a ejecutar la operación de negocio (por ejemplo, suspender de nuevo) crea un **evento nuevo**, y es correcto que sea así.
  - Un reenvío deliberado se registra como acción `reintento`.

**Generador original:** convive hasta R26, cuando todas las variantes estén conectadas y estables. Desde la etapa 2, el respaldo autorizado es justamente el generador original.

## 5. Plan por etapas e incrementos

| Inc. | Entrada | Entregable | Depende de | Aceptación |
|---|---|---|---|---|
| **0** (este) | requisitos 1.1, repo | inventario y plan | — | aprobás el alcance |
| **1.1** Caracterizar sin cambiar | plan aprobado | • Los textos B1–B9 que hoy se arman dentro de las acciones pasan a funciones puras en `src/lib/comunicaciones/legado/`. El texto se mueve **byte por byte**: `git diff --color-moved` lo demuestra.<br>• Pruebas de caracterización con `assert.strictEqual` para todas las variantes de N01–N21, con datos ficticios. | — | • tsc y npm test en verde<br>• cero cambios de texto en pantalla (e2e de humo de una reserva) |
| **1.2** Motor de plantillas | 1.1 | `src/lib/comunicaciones/plantillas.ts`, con:<br>• parser;<br>• validación del vocabulario;<br>• render;<br>• filtros cerrados. | 1.1 | unitarias de sintaxis, marcador desconocido, obligatoria vacía y escapes |
| **1.3** Catálogo y predeterminados | 1.2 | • Migración **0071**: las 7 tablas, RLS, módulo `comunicaciones` y control nuevo en `control_migracion.sql`.<br>• Predeterminados en `src/lib/comunicaciones/predeterminados/*.ts`: plantilla, esquema y adaptador por caso.<br>• Importación idempotente: hace upsert por (clave, hash) y **nunca toca** las versiones `oficial`.<br>• Usos creados en `modo='legado'`. | 1.2 | • si se importa 2 veces, no se duplica nada<br>• una versión oficial existente queda intacta<br>• ningún flujo cambia |
| **1.4** Equivalencia | 1.3 | `equivalencia.test.ts`: para cada caso y cada variante, `render(predeterminado, adaptador(datos)) === legado(datos)` con igualdad estricta, más un informe de evidencia por variante. | 1.3 | 0 diferencias. **Un caso con diferencias no puede pasar al módulo.** |
| **D** Diseño | inventario + paquete (§9) | mockups de S01–S05 y del formato D06 | 0 | apruebas los mockups |
| **2.1** Primer flujo conectado | 1.4 + D | • **N09–N10, `reserva.confirmada`**, pasa a `modo='modulo'` con el predeterminado.<br>• Se registran `preparado`, `abierto`, `copiado` y `confirmado_manual` (S05).<br>• `AvisoWhatsapp` recibe un `avisoId?` opcional; sin él se comporta exactamente como hoy. | 1.4, mockup S05 | • texto igual, carácter por carácter, en dev<br>• reintento sin duplicados<br>• falla de registro con la operación intacta<br>• volver a `legado` demostrado |
| **2.2** Editar y publicar | 2.1 + mockups S01–S03 | • Pantalla `/administracion/comunicaciones`, con catálogo, editor con marcadores protegidos y vista previa ficticia.<br>• Liberación por uso, retiro y reversión con motivo. | 2.1 | • borrador o aprobado no cambian el flujo<br>• publicar solo afecta el uso liberado y los avisos nuevos<br>• retirar vuelve al anterior y conserva el historial |
| **2.3** Historial | 2.1 + mockup S04 | historial de avisos con filtros, y detalle con la versión, la fuente y las acciones | 2.1 | • permisos (sin `ver`, no hay acceso)<br>• datos personales protegidos |
| **3.x** Expansión, un incremento por caso | 2.x | Por prioridad:<br>• N11–N12, suspensión de reserva<br>• N19–N21, clases de curso<br>• N17–N18<br>• N15–N16, N13–N14<br>• N07–N08<br>• ventas N01–N06<br>Además:<br>• **fase 4**: D06, P01–P03 y `documentos_emitidos`<br>• registro de emisiones de D01, D03 y D05<br>• revisión R21<br>• S06 destinos, con `contacto_verificaciones`<br>• email: asunto y cuerpo en los datos, **sin envío** | 2.x | por caso: la misma aceptación que en 2.1 |
| **3.e** Email real | proveedor y remitente decididos | adaptador de email con estados aceptado y rebotado | decisión | no bloquea 3.x |
| **4** H9 + R32 | 3.x | • horario hábil (patrón + excepciones, como la sala)<br>• cálculo de las 10 h hábiles (≠ las 8 h de cancelación)<br>• bandeja de pendientes asistida, que vuelve a resolver el destino antes de enviar (R39) | 3.x | fechas y excepciones validadas |
| **5** API WhatsApp, CRM | cuenta oficial | adaptadores, callbacks, reintentos; D25 y D26 | 4 | evidencia de envío y de costo |
| **6** App y popup | la app del usuario existe | identidad del usuario vinculada al contacto o tutor | 5 | — |

No hay estimaciones de tiempo. Cada incremento cierra con su PR, y pasa a producción solo con tu OK.

## 6. Pruebas
| Qué | Cómo |
|---|---|
| Equivalencia | `equivalencia.test.ts`, igualdad estricta (sin trim ni normalizar). Cubre todas las variantes de §1.2, más caracteres especiales (ñ, tildes, «¡»), horas con decimales, importes con miles, y fechas en el cambio de mes y de año. |
| Publicación por uso | unitaria de `resolverContenido`: una versión liberada para el uso A no afecta al uso B; borrador o aprobado no se usan |
| Reversión | liberar, retirar y revertir; el historial se conserva y `modo='legado'` restaura el texto original |
| Idempotencia | registrar el mismo evento 2 veces da 1 aviso y 2 acciones; un evento nuevo da un aviso nuevo |
| Destinatario | el adaptador recibe el resultado de dA, dT o cA; se prueba que el destinatario del aviso registrado coincide con el que muestra el botón (menor con tutor, organización, menor sin tutor) |
| Documentos históricos | se emite, se cambia un parámetro o se publica otra política, y la reimpresión no cambia (es el snapshot) |
| Marcadores | marcador desconocido, sintaxis rota u obligatoria vacía no generan mensaje |
| E2E | un spec por incremento visible, ejecutado una vez (por ejemplo: confirmar una reserva, registrar «abierto» y verlo en el historial) |

## 7. Migración, activación y reversión
- **0071 es solo aditiva:** tablas nuevas, sin tocar datos existentes. No necesita respaldo `*_previo_`.
- **Rollback:** se borran las tablas nuevas en orden inverso, y se prueba en dev.
- **Activación por caso:** `contenido_usos.modo` pasa de `legado` a `modulo`. Es un dato, no un interruptor global, y la reversión es volver a `legado`, con historial.
- No se reconstruye historial de envíos: los avisos se registran desde la activación (R9).
- **Producción:** con tu OK en cada pase. Foto previa:
  - conteo de `reservas_sala` y `reservas_historial`;
  - verificar que 0071 sea la próxima migración libre.
- **Numeración:** el plan de la fase 4 decía 0071 y pasa a la que esté libre en la etapa 3.

## 8. Pantallas y formatos que cambian
| ID | Dónde | Cambio | Incremento |
|---|---|---|---|
| S01–S03 | `/administracion/comunicaciones` (nuevo, en el grupo Administración de `BarraLateral`) | catálogo, editor y liberación | 2.2 |
| S04 | `/comunicaciones/historial` y un bloque en la ficha de la membresía | historial | 2.3 |
| S05 | `AvisoWhatsapp` y sus 7 contenedores | origen del contenido, «Marcar como enviado» opcional, aviso de error de registro. **Se mantiene un clic para WhatsApp y Copiar.** | 2.1 |
| S06 | fichas de contacto (`TarjetaContacto`, `EntidadAlumno`, `EntidadProfesor`) | formato, verificación y consentimiento por separado | 3 |
| D06 | ficha de la membresía, menú ⋯ | reporte de la membresía (mockup de la fase 4 ya entregado) | 3 |

D01, D03 y D05 no cambian de formato: solo se registra la emisión.

## 9. Paquete para Claude Design
- **Componentes y patrones que se mantienen** (se entregan capturas y rutas):
  - `Pagina` y `EncabezadoPagina`;
  - `Aviso` (`components/nuevo`);
  - `AvisoWhatsapp`, `AvisosAfectados`, `TarjetaConfirmacion` (su diseño ya prevé el estado «enviado»);
  - `FilaReserva`;
  - el patrón de Administración: `ClienteCatalogos`, `FilaParametro`, `MatrizPermisos`;
  - el modo enfoque y el menú plegable.
- **Datos ficticios:**
  - alumna «Ana Pérez», menor con tutor «Luis Pérez»;
  - organización «Colegio Sol», con su persona de contacto;
  - profesor «Mario Rojas»;
  - reserva «vie 02/10 de 15:00 a 16:00», en «Tropicana (Sala 1)», con saldo de 7.5 h de 10 h;
  - los textos resultantes de N09 y N11, de los generadores actuales.
- **Pantallas:** S01–S05 y el formato D06.
  - Estados: vacío, cargando, error, sin permiso, destino inválido, variable faltante, error de registro, respaldo autorizado.
  - Los estados se explican en lenguaje operativo.
  - Hay que diferenciar «preparado», «abierto», «copiado» y «confirmado manualmente», y también «aprobado» de «publicado o liberado».
- **Fuera de este diseño:** bandeja programada, CRM, campañas, IA, popup.

## 10. Primer incremento recomendado y decisiones que lo condicionan
**Recomiendo empezar con 1.1, caracterizar sin cambiar.** No tiene riesgo para la operación, no tiene migración, y sin él no se puede probar la equivalencia de los textos B1–B9.

**Primer flujo conectado: N09–N10 `reserva.confirmada`.**
- Por qué este:
  - es frecuente;
  - un mismo texto sirve a dos acciones;
  - tiene pocas ramas: particular o alquiler, lugar y saldo.
- **Alternativa más segura:** N21 `clase.reabierta`. Ya es una función pura con pruebas, tiene dos ramas y se usa poco. Sirve para un ensayo sin exposición, pero su valor es bajo.

**Decisiones que sí condicionan las etapas 1 y 2:**
1. **Primer caso:** N09–N10 (recomendado) o N21.
2. **Roles:** al principio Javier edita, revisa y publica; recepción solo usa. ¿Hace falta un revisor distinto?
3. **`no_contactar`:** hoy no se respeta. Recomiendo que en la etapa 2 se vea como advertencia y no bloquee. Bloquear cambia la operación.
4. **Edición excepcional del texto al enviar:** recomiendo **no** permitirla en la etapa 2. `texto_usado` queda previsto en los datos.
5. **Retención y acceso del historial:** recomiendo conservar los avisos sin límite, como `reservas_historial`. Ven el historial los roles con `comunicaciones` ver, con `todo` como alcance.
6. **Fase 4:** se reconstruye sobre esta capa en la etapa 3 (recomendado), o se adelanta como el segundo caso después de 2.1.

**Decisiones que no lo condicionan:**
- proveedor y remitente de email (3.e);
- cuenta de WhatsApp (5);
- D25 y D26 (5);
- unificar las reglas de destinatario para menores (D-nueva);
- qué avisos sensibles exigen un destino verificado (3, S06).

---

# Anexo B — Textos literales de los generadores (fuente para las plantillas)
El detalle literal de A1, A2, B0–B9, de los destinatarios y de los formateadores se copia al documento final desde el relevamiento de este día. Es la evidencia de la ficha N01–N21, con archivo:línea en la tabla §1.2. Las piezas centrales:
- **A1:** `mensajeInscripcion.ts:43-118`.
- **A2:** `avisosClase.ts:29-73`.
- **B0:** `particulares/acciones.ts:171-298`:
  - `fechaHoraCorta`, `horario`, `h`;
  - `contextoAviso`, que da `tuClase`, `tuClaseCorta`, `paquete`, `alumnoNombre`, `lugar`;
  - `avisos()`, `saldoTexto`.
- **B1–B6:** `particulares/acciones.ts:1105-1126`, `1446-1467`, `1522-1532`, `1635-1646`, `1780-1792`, `1899-1920`.
- **B7–B9:** `inscribir/acciones.ts:939-986`, `1623-1652`; `inscribir/accionesAlquiler.ts:512-528`.

