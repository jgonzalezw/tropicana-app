# R20 · E4c — Reporte de membresía D06 y políticas versionadas (plan v3, solo dev)

## Contexto
- **Qué pide E4c:**
  - el reporte de membresía D06 para Regular (incluye prueba), Particular y Alquiler;
  - las políticas P01–P03 versionadas como documentación;
  - la referencia de la membresía a la política vigente al venderse;
  - el envío asistido por WhatsApp del reporte de inscripción.
- **Límites:**
  - Las versiones de política **no** son un motor de controles: la operación sigue usando los parámetros globales.
  - PR #50 abierto, sin merge. Nada en producción. No se ejecutan migraciones hasta que revises este plan.
  - Sin E6, sin otros avisos, sin talleres ni servicios especiales.
- **Leído completo:**
  - plan R20 v2;
  - plan de certificaciones v2;
  - propuesta E4 v3;
  - handoff `design_handoff_reporte_membresia/README.md` y su mockup;
  - handoff `R20-Notificaciones/design_handoff_comunicaciones_r20/README.md` (rev. 2.1; capturas 21–27 del reporte).
- **Rama:** `r20-e4c-reporte`, apilada sobre `r20-e4b-n09` (necesita la 0074). La 0075 está libre en todas las ramas.

## Decisiones ya respondidas que el plan respeta
1. D06 es un **reporte de membresía**, nunca «certificado» en la interfaz, el impreso ni el código. Tiene dos modalidades:
   - **Reporte actual:** datos, estado e historial de hoy más la política vigente al imprimir. No guarda copia ni crea historial.
   - **Reporte de inscripción:** se registra una vez al completar la inscripción y se puede reimprimir tal cual.
2. **Venta y renovación:** una membresía nueva guarda la referencia a la política aprobada, publicada y liberada aplicable al venderse. Una renovación es una venta nueva y toma la vigente de ese momento. Sin ninguna liberada, la venta apunta a la base inicial.
3. **Cambios de parámetros:** un único borrador pendiente por tipo, con los valores actuales de todos los parámetros que la componen. La foto oficial e inmutable se fija al aprobarla. El parámetro de modo nace en **aprobación pendiente**.
4. **Bootstrap por entorno:** lee los parámetros de ese entorno y nunca aprueba, publica ni libera.
5. **C1–C3** se aplican como están. **C3:** el texto oficial no se edita al enviar; el respaldo explícito sigue como en E4b.
6. **Tres acciones distintas:** aprobación editorial, publicación y liberación. Ninguna dispara a la siguiente.

## Contradicciones documentales encontradas (solo estas)
- **A. Qué política muestra el reporte.**
  - Handoff R20 rev. 2.1, «Certificaciones» punto 1: es «la versión de la política **aplicable** a la membresía, no la vigente».
  - Plan R20 v2 §6.3: «El documento muestra la **aplicable**».
  - La decisión 1 dice lo contrario para el reporte actual: vigente al imprimir.
  - Coincide con la decisión el README del handoff del reporte, «Versión y documento oficial»: «El reporte usa la versión vigente».
  - Para el reporte de inscripción no hay conflicto: la vigente al inscribir **es** la aplicable.
  - **El plan sigue la decisión 1.**
- **B. Qué queda registrado.**
  - Handoff R20, «Certificaciones» puntos 2 y 4: «Emitir reporte nuevo» crea una emisión, y emitir y reimprimir quedan en el historial de la ficha.
  - La decisión 1 dice que el reporte actual no guarda ni crea historial, y que solo se registra el de inscripción.
  - **El plan sigue la decisión 1:** «Reimprimir original» queda solo para el reporte de inscripción.
- **C. Quién autoriza.**
  - Propuesta E4 v3 §1.6 (D-E4a-1: aprobar, publicar y liberar, solo el Administrador) y §1.3.3 (`es_admin()` dentro de cada función).
  - D-E4a-2: el módulo queda oculto en la matriz hasta E6.
  - Plan v2 C6: «vos editás, revisás y publicás».
  - Esto contradice el punto 3 de tu instrucción: autorizar por permisos asignables, no por nombre de rol.
  - **Qué hace el plan:**
    - todo lo nuevo de E4c se autoriza con `tiene_permiso`;
    - **no** cambia `cambiar_estado_version` ni `liberar_contenido` (§4).
- **Limitación existente, no contradicción:** `tiene_permiso` (0048:770-787) devuelve verdadero para el Administrador por nombre de rol. No se toca (no se reingenieriza). Hay que tenerla en cuenta: hoy el Administrador tiene de hecho todo permiso de negocio.

## 1. Políticas: textos, fotos y borrador único

### Textos P01–P03
Son contenidos del módulo existente, con su flujo editorial sin cambios (borrador → en revisión → aprobado → publicado; liberar es otra acción).

| | P01 Regular (incluye prueba) | P02 Particular | P03 Alquiler |
|---|---|---|---|
| Tipo | `politica` | `politica` | `politica` |
| Canal | `documento` | `documento` | `documento` |
| Uso | `reporte.membresia.politica` | `reporte.membresia.politica` | `reporte.membresia.politica` |
| Variante | `regular` | `particular` | `alquiler` |
| Fuente literal | `referencias/Guia_Regulares_Oct2026.pdf` | mockup (README: «armada desde la de alquiler») | `Guia_Alquiler_Oct2026.png` |

- Los valores fijos pasan a marcadores con el nombre exacto del parámetro: `{{prueba_plazo_dias}}`, `{{reserva_solicitud_validez_horas}}`, `{{reserva_cancelacion_plazo_horas}}`.
- Solo marcadores simples, sin condiciones ni listas; una prueba lo exige.
- **Partes vivas:** «En tu membresía: …» y el ejemplo con la próxima reserva real salen de la membresía al armar el reporte, no de la plantilla. El plazo propio del plan (`planes.prueba_plazo_dias`) va en esa línea viva, no en la foto global.

### `politica_fotos`
Una tabla de historial de políticas, sin columnas de foto en `membresias`.
- **Columnas:** id, variante, `estado` (`base` / `borrador` / `aprobada`), `parametros` jsonb, `contenido_version_id`, `render` jsonb, `creado_en`, `actualizado_en`, `aprobado_en/por`, `hash`.
- **`base`:** la creó el bootstrap con los parámetros del entorno al instalar.
  - Es inmutable y **no es oficial**.
  - Es la referencia de las membresías existentes y de las ventas mientras no haya ninguna aprobada.
- **`borrador`:** a lo sumo **uno por variante**, con un índice único parcial.
  - Es mutable solo por los triggers de abajo.
  - Siempre tiene los valores **actuales** de todos los parámetros que componen esa política.
- **`aprobada`:** fija el texto liberado de ese momento, los parámetros y el render.
  - Es inmutable para siempre.
  - Es la **vigente** cuando es la última aprobada de su variante.

### Cómo se mantiene el borrador único (medido en el repo)
- **Dónde se cambian hoy esos parámetros:** solo desde `/administracion/parametros`, con `guardarParametro` (`administracion/parametros/acciones.ts:14-66`).
  - Se guarda **una clave por vez**, con el permiso `administracion.editar`.
  - No hay lote ni un «terminé».
  - `/catalogos` no guarda ninguno de los tres.
  - El plazo de prueba por plan se edita en `/planes`, pero no es parte de la foto global.
- **Trigger en la base, no en la pantalla** (`after update of valor on parametros`). Así cubre cualquier flujo actual o futuro, sin depender de qué pantalla guarde. Cuando cambia una clave usada por alguna política:
  1. **Arma los valores:** lee los valores actuales de **todas** las claves de esa política.
  2. **Inserta o actualiza** el borrador de la variante.
  3. **Lo borra si sobra:** si los valores coinciden con la última aprobada y el texto también, el borrador ya no hace falta y se borra. No es historial.
- **Cambio de texto:** cuando se libera una versión nueva de P0x, un trigger sobre `contenido_usos_historial` (solo usos `reporte.membresia.politica`) crea o actualiza el borrador de esa variante. **Liberar no aprueba la foto.**
- **Ninguno de los dos triggers aprueba nada.**

### Aprobar la foto
- **Requisito:** que el texto de esa variante esté **publicado y liberado** (`contenido_usos.modo='modulo'`).
  - La aprobación de la foto no publica ni libera.
  - Liberar no aprueba la foto.
- **Función** `aprobar_politica_foto(variante, hash_visto)`, `security definer`.
  - Verifica `tiene_permiso('comunicaciones','editar')`.
  - Calcula el render en SQL reemplazando los marcadores; si queda un marcador sin resolver o falta un parámetro, falla.
  - Verifica que el hash que vio quien aprueba coincida.
  - Pasa el borrador a `aprobada`, con el texto liberado fijado.
- **Vigencia que se imprime:** «Versión {etiqueta} · vigente desde {aprobado_en}».

### Parámetro `politica_cambio_parametro_modo` (nace en 0075, grupo «Comunicaciones», con lista)
- **Valor inicial:** `aprobacion_pendiente`. Hoy es la **única opción de la lista**.
- **El modo automático no se implementa, porque no hay un punto fiable para agrupar.** `guardarParametro` guarda claves sueltas y no hay ningún paso de «confirmar cambios». Aprobar al guardar cada clave aprobaría políticas a medio cambiar.
- **Opción mínima propuesta, para que la dueña decida:** el borrador se aprueba solo en el **primer hecho que lo usa**, es decir, la próxima inscripción o renovación, siempre que el texto esté liberado.
  - Agrupa todo lo cambiado hasta ese momento.
  - Coincide con el momento relevante, la inscripción.
  - El costo: la aprobación la «hace» una venta, y quien vende no eligió aprobar.
- **Alternativa:** un botón «Aplicar cambios de política» junto a los parámetros. Pero eso es aprobación manual con otro nombre.
- Elegida una, se agrega la opción `automatica` a la lista con una migración de una línea.

## 2. Referencia de la membresía
- **Columna:** `membresias.politica_foto_id`, la única columna nueva en `membresias`.
- **Cómo se fija:** un trigger `before insert`, que cubre las 4 vías de venta y la renovación sin tocar sus acciones TS.
  - Toma la última foto `aprobada` de su variante; si no hay ninguna, la `base`.
  - Solo se fija en el insert: otro trigger rechaza cambiarla.
- **Variante:** replica `tipoDeMembresia` (`src/lib/listaMembresias.ts:50`), con una prueba TS que la cruza.
  - `categoria_aplicada` → alquiler;
  - `es_prueba` → regular;
  - `curso_id` nulo → particular;
  - si no, regular.
  - Un plan `taller` queda nulo y fuera de alcance.
- **Ningún flujo operativo lee esta columna.**

## 3. Reporte D06

### Constructor y pantalla
- **Un solo constructor:** `src/lib/reporteMembresia.ts`.
  - Arma el HTML para la vista previa (`iframe srcDoc`) y para imprimir, con el patrón de `ImprimirCuenta.tsx:14-31`: A4, `break-before` en la hoja 2 y `break-inside: avoid`.
  - Recrea el mockup con los tokens del repo.
- **Hoja 1:** sale de `obtenerMembresia` (`membresias/acciones.ts:112`) e `historialDe` (`fichaMembresia.ts:193`).
- **Hoja 2:** la foto vigente más las partes vivas.
- **Menú ⋯ › «Reporte de la membresía»:** se habilita en `AccionesFicha.tsx:28` para regular, prueba, particular y alquiler.

### Reporte actual
- **Encabezado impreso:** «Reporte actual · emitido el … · refleja el estado a esa fecha».
- **Acciones:** Imprimir / PDF. No se registra nada.
- **Sin foto aprobada:** muestra «sin política liberada para este tipo» (captura 25) y no arma la hoja 2.

### Reporte de inscripción
- **Encabezado impreso:** «Reporte de inscripción · {fecha de la venta}».
- **Hoja 2:** la foto referenciada por la membresía.
- **Cuándo se registra:** al terminar cada acción de venta: `inscribirYCobrar` (`inscribir/acciones.ts:133`), `venderPrueba` (`:648`), `venderParticular` (`:1406`) y `venderAlquiler` (`accionesAlquiler.ts:358`).
  - Es un paso posterior: **la venta no cambia**.
  - Llama a `registrarReporteInscripcion(membresiaId)` en `src/lib/comunicaciones/documentos/`.
- **Tabla `documentos_emitidos`** (solo agregar):
  - **Columnas:** clave única `reporte_inscripcion:<membresia_id>`, `membresia_id`, `politica_foto_id`, `html`, `hash`, `creado_en/por`.
  - **Escritura:** solo por una función `security definer` idempotente.
- **Si falla el registro:** la confirmación de la venta lo dice y ofrece «Registrar reporte de inscripción» (idempotente, también en la ficha), con `exigir()`.
- **Reimprimir:** dibuja el `html` guardado, idéntico (capturas 24 y 27). No crea una emisión nueva.
- **Membresías anteriores a E4c:** no tienen reporte de inscripción y no se inventa. La ficha lo explica: «La inscripción fue anterior a este registro».

### Permisos (por la matriz, asignables)
- **Ver e imprimir el reporte actual y reimprimir el de inscripción:** el acceso de la ficha (`accesoActual`, `membresias/acciones.ts:22`, permiso del módulo del tipo).
- **Registrar el reporte de inscripción:** lo hace la venta, con el permiso que ya exige esa venta.
- **Aprobar la foto de política:** `comunicaciones.editar`.
  - El módulo `comunicaciones` entra a `MODULOS` y `ETIQUETA_MODULO` (`src/lib/tipos.ts:768-814`) solo con ver y editar.
  - Se siembra en 0075 **sin otorgarlo a ningún rol**: la dueña lo asigna en la matriz.
  - Esto choca con D-E4a-2 (contradicción C).
- **Enviar por WhatsApp:** el chequeo de avisos de E4b (`puede_registrar_aviso`, 0074:217).

## 4. Envío por WhatsApp del reporte de inscripción

### Alternativa más sencilla con lo que existe
- **Paso 1:** en la confirmación de la venta, junto al aviso de venta actual (`ConfirmacionVenta`), aparece **«Reporte de inscripción»** con «Imprimir / PDF» y **«Enviar por WhatsApp»** (`AvisoWhatsapp`/S05 de E4b).
- **Paso 2:** WhatsApp se abre al destinatario correcto con un **texto breve**.
  - El texto dice: «Te enviamos el reporte de tu inscripción a {plan}… versión de política {etiqueta}».
  - El caso nuevo es **N22**, uso `venta.reporte_inscripcion`, registrado en `avisos` con `fuente_evento='documentos_emitidos'` e `id_evento` = la emisión.
- **Paso 3:** quien atiende **adjunta a mano el PDF** que guardó con «Imprimir / PDF». WhatsApp en la computadora permite adjuntar.
- **Constancia:**
  - quedan las acciones abierto y copiado;
  - «Marcar como enviado» es una declaración opcional, rectificable (rev. 2);
  - **abrir o copiar nunca cuenta como enviado.**

### Qué no es viable sin una inversión desproporcionada
- **Adjuntar el PDF automáticamente:** `wa.me` no admite archivos. Requiere la API de WhatsApp (8d).
- **Enlace al reporte:** sería una página sin sesión con token, es decir, superficie nueva. **No se introduce.**

### Qué falta
1. **Texto N22:** necesita tu decisión (D-3 abajo).
2. **E4b en producción** (merge de PR #50 y pase de 0074) para usarlo fuera de dev.
3. **Diseño del lugar en la confirmación de venta:** el mockup tiene el envío desde el reporte, no desde la confirmación. Hay que avisar antes de construir (proceso 3).

## 5. Migraciones (dev; se aplican solo después de tu revisión)
- **0075 `0075_comunicaciones_reporte_membresia.sql`** (a mano):
  - checks de `contenidos`: `caso ~ '^(N|P)[0-9]{2}$'` y canal `documento` sin asunto (con `create or replace` del guard);
  - `politica_fotos` con sus triggers;
  - `documentos_emitidos`;
  - columna y triggers de `membresias`;
  - trigger de `parametros`;
  - funciones `aprobar_politica_foto`, `registrar_reporte_inscripcion`, `politica_vigente(variante)` y `politicas_inicializar()`;
  - el parámetro de modo;
  - el módulo `comunicaciones` en `rol_permisos` sin otorgar;
  - RLS y grants con el patrón 0071/0074;
  - `notify pgrst`.
- **0076 importación generada** (`scripts/generar-importacion-predeterminados.mjs`, ampliado para P01–P03 y N22): en borrador, asignaciones en `legado`. Pasa la prueba de deriva.
- **0077 `0077_comunicaciones_politicas_inicializar.sql`**: `select public.politicas_inicializar();`.
- **Controles 68–72** (sin tocar los encabezados `-- 55-62.` ni `-- 63-67.`):
  - 68: membresía en alcance sin referencia;
  - 69: foto aprobada cuyo render no coincide;
  - 70: más de un borrador por variante;
  - 71: escritura para anon o authenticated;
  - 72: venta desde 0075 sin reporte de inscripción (para reintentar).
- **Control 59:** admite `modulo` en los usos de política cuando se liberen.

## 6. Rollback (`scripts/rollback_0075_reporte.sql`)
**Aborta antes de borrar o alterar nada** si existe cualquiera de estas condiciones:
1. alguna fila en `documentos_emitidos`;
2. algún aviso o acción con `fuente_evento='documentos_emitidos'` o del caso N22;
3. alguna foto `aprobada`;
4. alguna membresía creada **después** de la instalación (`creado_en` > `creado_en` de la foto base) con referencia, porque esa referencia es historia de una venta;
5. alguna versión P0x o N22 fuera de borrador, o algún historial o liberación de sus usos.

Si no hay nada de eso:
- deja nulas las referencias que puso el bootstrap;
- borra borradores, bases, funciones y tablas;
- revierte checks y parámetros.

Se prueba en dev: aplicar, revertir, reaplicar, y que aborta ante cada condición.

## 7. Bootstrap futuro en producción (paso del plan de pase, **no autorizado ahora**)
- **Requisito:** producción en 0074 (pase previo de E4b) y tu autorización explícita.
- **0077 en producción:** por variante sin base, crea la `base` y el `borrador` con los parámetros **leídos de producción en ese momento**. Asigna la base a las membresías en alcance sin referencia.
  - **No aprueba, no publica, no libera.**
  - Reaplicarlo no cambia nada.
- **Antes y después:**
  - respaldo `*_previo_*` de (`membresias.id`, `politica_foto_id`);
  - conteos de membresías por variante;
  - valores leídos de producción.
  - Todo queda anotado en `docs/PASES.md`.
- **Efecto visible tras el pase:** los reportes muestran «sin política liberada» hasta que la dueña o quien tenga permiso apruebe, publique y libere los textos y luego apruebe las fotos.

## 8. Comprobación en dev (puntual, sin repetir E4b/E5)
- **Aplicar y reaplicar:** aplicar 0075–0077; reaplicar 0076–0077 no cambia filas; controles 55–72 en 0.
- **Base y referencias:** 3 bases con los parámetros de dev; membresías de dev referenciadas; una venta real de cada tipo toma la base.
- **Transacción descartada** (patrón `prueba_0074`):
  - cambiar dos parámetros de P02 deja **un** borrador con ambos valores;
  - volver a los valores aprobados lo elimina;
  - aprobar sin texto liberado falla;
  - publicar y liberar P02 no aprueba la foto;
  - aprobarla con `comunicaciones.editar` funciona;
  - un rol sin ese permiso falla;
  - la venta siguiente toma la foto aprobada;
  - no se puede modificar una foto aprobada ni la referencia;
  - al terminar no queda nada liberado.
- **Reporte de inscripción:**
  - una venta de cada tipo deja 1 emisión;
  - repetir no duplica;
  - un fallo simulado deja la venta intacta y ofrece el reintento;
  - reimprimir devuelve el `html` igual byte a byte.
- **Rollback** probado como en §6.
- **Código:** `tsc` y `npm test` (deriva, catálogo, plantillas de política sin condiciones, tipo SQL = TS, render SQL = motor TS).
- **Chrome:** reporte actual y de inscripción de cada tipo, «sin política liberada», vista de impresión y N22 en la confirmación con el texto del predeterminado.

## Pendiente de decisión
- **D-1. Contradicción C:** ¿la aprobación, publicación y liberación de textos (`cambiar_estado_version`/`liberar_contenido`, hoy `es_admin()`) pasa también a `comunicaciones.*`? ¿Y `comunicaciones` sale ya a la matriz (contra D-E4a-2)?
- **D-2. Punto de agrupación del modo automático** (§1): primera inscripción o renovación, o un botón explícito.
- **D-3. Texto N22:** ¿se usa en `legado` con el texto del código, revisado en el PR, como hoy los N01–N21? ¿O espera a estar aprobado, publicado y liberado antes de usarse?
- **D-4. Reporte de inscripción sin foto aprobada:** registrar solo la hoja 1 con la advertencia (propuesta 5 del handoff R20, no aprobada). La venta ya ocurrió, así que no se puede bloquear.
- **D-5. Mockups faltantes:** el bloque de aprobación de la foto (dónde vive, sugerido junto a Parámetros) y el lugar del reporte en la confirmación de venta. Proceso 3 pide avisar antes de construirlos.

## Datos que no salen de la configuración
- P02 no tiene guía oficial: su texto sale del mockup.
- Regla de cambio de horario en alquiler sin definir: nota del mockup, línea 670.
- Etiqueta de versión («Oct 2026»): se fija al publicar.
- Tope de bono y tolerancia en P01: son por plan y quedan en texto genérico.
- Retención (C5): sin borrado automático ni plazo implícito; la decisión formal sigue abierta.
