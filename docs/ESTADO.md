# Tropicana — ESTADO (fuente única de verdad del avance)

> Este documento es la memoria del proyecto entre sesiones. Se versiona en cada
> hito. Ante contradicción entre este doc y el repo, **gana el repo** (y se
> corrige acá). Documentos hermanos: `docs/archivo/PLAN_ETAPA1.md` (plan técnico),
> `docs/design/README.md` (fuente de verdad del **diseño**), `docs/archivo/CONTEXTO_AVANCE.md`
> (bitácora larga de Etapa 0), `docs/DESIGN_SYNC.md` (cómo entran los handoffs).
>
> **Cómo leer este documento.** Los bloques con fecha son **bitácora**: cuentan
> cómo estaban las cosas **ese día** y no se reescriben. Cuando una frase vieja
> ("solo en dev", "sin construir", "pendiente") dejó de ser cierta, lleva al
> lado una marca *(➜ hoy: …)* con la fecha del cambio. El estado **vigente**
> vive en las tablas (§0bis, la cola C1→C5), en `DECISIONES.md` (decisiones y
> registro de pases) y en `ROADMAP.md` (trabajo pendiente).
>

## Índice de lo archivado (recorte 2026-10-04)

Este documento conserva las **tablas vigentes**. La **bitácora fechada** (lo que pasó cada día, sin reescribir) se movió, sin cambios y en el mismo orden, a `docs/archivo/`. Mapa de rutas en `docs/archivo/README.md`.

Dentro de lo archivado hay dos datos de referencia que no viven en otro lado: la **cuenta de verificación en dev** (`claude@tropicana.dev`, subsección de «0quater. Caja») y la **URL de producción en Vercel** (`tropicana-app.vercel.app`, en «5. Pendientes»). Ambos están en `docs/archivo/ESTADO-2026-08-09.md`.

**En `docs/archivo/ESTADO-2026-08-09.md`** (agosto y septiembre, hasta el 2026-09-30): la serie de «Última actualización» del encabezado y estas secciones:

- 0ter. Decisiones de política y reparación de la migración (2026-09-10)
- 0quater. Caja (2A) y notas para el Paso 2 (2026-09-10)
- 0sexies. Mejora transversal — abrir la ficha de cualquier entidad (2026-
- 0septies. Corregir una membresía ya vendida (2026-09-10)
- 0octies. `docs/REGLAS.md` — las reglas invariables, cargadas siempre (20
- 0nonies. El fin de ciclo pasa a calcularse (2026-09-10) — HECHO EN DEV
- 5. Pendientes y decisiones abiertas
- Clase de prueba — Paso D (padrón de asistencia) · cerrado 2026-09-11
- Clase de prueba — una fecha por curso (0024) · cerrado 2026-09-11
- Liquidación a prorrata — cierre de E, y las reglas 16 a 19 · 2026-09-11/
- D18 — la comisión es de quien dictó, no de quien está asignado hoy · 202
- D17a — quién dictó la clase deja de ser una suposición · 2026-09-12
- Pase a producción de las migraciones 0023–0030 · 2026-09-12
- D17b — el descuento del reemplazante en la liquidación · 2026-09-12 (dev
- Vigencia del curso · 2026-09-12 (dev)
- Pase a producción de las migraciones 0032 y 0033 · 2026-09-12
- D6 — la duración de la clase, y con ella la hora de fin · 2026-09-12 (de
- Pase a producción de la migración 0034 · 2026-09-12
- Precios y paquetes, y la base de la sala · 2026-09-12 (dev)
- La segunda sala, y las excepciones por rango · 2026-09-12 (dev)
- Un alumno duplicado en el padrón de asistencia · 2026-09-16
- C5 (lado de cursos regulares): un cierre de sala avisa y suspende · 2026
- Roles y Permisos: Planes, Liquidaciones, Precios y Sala separados · 2026
- Dos correcciones de UI encontradas probando en celular · 2026-09-16
- Cuenta del alumno: membresías multi-curso completas, y fecha de fin real
- Corrección de datos en producción: la clase de Yubinca acreditada a la m
- Ítem 3: intervalo estándar de tiempo (parámetro único de incrementos) · 
- R23 corregido y pasado a producción · 2026-09-17
- C2 — Disponibilidad + reserva mínima de sala · 2026-09-17 (dev)
- El trigger de alta no copiaba el email a `perfiles` · 2026-09-17
- Visibilidad de datos propios (0043) · 2026-09-17 (dev)
- El mensaje de "clase congelada" no se notaba (sin migración) · 2026-09-1
- La cuenta del profesor: deuda, pago clasificado y cierre de períodos · 2
- D1 + D3 — un solo nombre para la membresía · 2026-09-24 (dev)
- C3 — H1: plantillas de plan de particulares · 2026-09-25 (dev)
- C3 — H2: vender un plan de particulares · 2026-09-26 (dev)
- C3 — H3: reservas con los 7 estados · 2026-09-26 (dev)
- C3 — H4: cierres de sala sobre reservas · 2026-09-26 (dev)
- Ajustes tras cargar datos reales: contacto_id, sala externa por plan, du
- Agendamientos externos de hoy, en /sala · 2026-09-27 (dev)
- C3 — H5: liquidación de particulares · 2026-09-27 → 2026-09-30 (dev, sin

**En `docs/archivo/ESTADO-2026-10.md`** (desde el 2026-10-01):

- C3 — H5, Paso 4: criterios 2 y 3 en cursos regulares · 2026-10-01 (dev, 
- Informe de pre-liquidación · 2026-10-01 (en producción, chip `#9a9ff64`)
- Desasignar a un profesor de un curso · 2026-10-01 (dev, sin pase) — URGE
- Cierre de cuentas al desasignar · 2026-10-01 (dev, sin pase) — caso Isab
- C3 — H7: alquiler de sala, tanda 1 (base) · 2026-10-01 (dev, sin pase)
- C3 — H7: alquiler de sala, tanda 2 (la venta) · 2026-10-01 (dev, sin pas
- Ventas y contactos con el mismo comportamiento — E1 (piezas comunes + al
- E2 — Clase particular con las piezas comunes (2026-10-01, dev)
- E3 — Inscripción regular y clase de prueba con las piezas comunes (2026-
- E4 — Agregar un rol a un contacto existente desde Alumnos y Profesores (
- Cierre de la tanda de ventas — vigencia, cobro y avisos (2026-10-02, dev
- Pase a producción de H7 + ventas unificadas · 2026-10-02 (en producción)
- Hito B — rendimiento de /sala (2026-10-02, dev; sin push)
- Hito B — estandarización de /sala y panel Gestionar (2026-10-02, dev; si
- /sala: gestionar sin salir de la pantalla (2026-10-02, dev; sin push)

---

> Los bloques 0bis, 0quinquies y 0duodecies (septiembre 2026) se archivaron el 2026-10-08 en `docs/archivo/ESTADO-2026-09.md`.

> Las secciones base §1–§7 (estado por hito de Etapa 0/1, handoff de diseño, decisiones de negocio absorbidas, migraciones 0001–0017, protocolo y metodología de release) se archivaron el 2026-10-08 en `docs/archivo/ESTADO-2026-08-09.md`, al final. Lo vigente está en `docs/reglas/`, `docs/DECISIONES.md` §3 y `docs/ENTORNOS_CLAUDE.md`.

## I-001, I-009, I-005, I-003, I-005b, I-006, I-007, I-010, I-011 — archivados (2026-10-09)
Movidos a `docs/archivo/ESTADO-2026-10.md` el 2026-10-10 (ESTADO superaba 25 KB). Todo quedó en producción hasta 0001–0070.

## R20 — Etapa 0: inventario y plan de comunicaciones (2026-10-09)
- **Sin código ni migraciones.** Rama `r20-notificaciones`. Plan: `docs/relevamientos/2026-10-09-plan-r20-notificaciones.md` (sin aprobar el alcance de los incrementos).
- **Inventario:** 21 casos de mensaje (N01–N21), 15 operaciones que avisan, 7 contenedores, 5 documentos imprimibles; generadores en `mensajeInscripcion.ts`, `avisosClase.ts` y dentro de `particulares/acciones.ts` e `inscribir/`.
- **Hallazgos:** ningún aviso consulta `no_contactar`; tres reglas de destinatario distintas para un menor (dA, cA, dT); no queda registro de ningún envío; `politicas_texto` ya existe (consentimiento).
- **Fase 4 (reporte):** plan guardado en `2026-10-09-plan-i012-fase-4-reporte.md`, en PAUSA; se apoya en la capa de R20 y no crea `membresia_eventos` por su cuenta.
- **Próxima migración libre:** 0071 (la usa el incremento 1.3 de R20).


## R20 — Plan v2 y autorización de E2 (2026-10-09)
- Plan v2 en `docs/relevamientos/2026-10-09-plan-r20-notificaciones-v2.md`; la v1 queda como antecedente.
- Recuento: 13 eventos, 21 casos de mensaje, 16 operaciones (13 con generador propio), 9 consumidores de `AvisoWhatsapp`. Variantes: se cuentan en E2.
- Medido en dev (solo lectura): `no_contactar` en 0 de 67 contactos y nadie lo escribe; 5 consentimientos (3 otorgados, 2 rechazos), que hoy no frenan ningún aviso. Producción sin medir (M1).
- Certificaciones pasan a entrega 7a, con plan propio; el plan viejo de la fase 4 queda archivado.
- Autorizado: E2 en hitos, en dev. Sin migraciones, sin conectar casos, sin tocar consentimiento ni producción.

## R20 — E2 · H3 completo: reservas, clases y ventas (2026-10-10)
- Los 21 casos (N01–N21) tienen referencia capturada del código anterior, función pura y plantilla predeterminada, con equivalencia en tres vías y condiciones de no-aviso: reservas 161 variantes (+23 de N09–N10), clases 38, ventas 62. 0 diferencias. Informes: `2026-10-10-r20-equivalencia-{reservas,clases,ventas}.md`.
- Motivo de suspensión vacío o nulo: la función movida ya imprimía «()»/«null»; solo la plantilla lo detenía. Corregido con `permiteVacia` y referencias nuevas; la validación mejor queda como cambio posterior.
- `npm run inventario:avisos` (`scripts/inventario-avisos.mjs`): falla si aparece un consumidor de `AvisoWhatsapp` fuera de los 9, falta una de las 16 operaciones o un caso sin referencias o plantilla.
- `tsc` limpio, `npm test` 791/791, e2e de humo 14/14 (membresías 1a y reprogramar/cancelar/reagendar). Sin migraciones, sin conectar casos, sin tocar consentimiento ni producción.


## R20 — E4a · contenidos, versiones y asignaciones (2026-10-10, solo dev)
Rama `r20-e4a-contenidos`, apilada sobre `r20-notificaciones` (PR #47): necesita los `predeterminados/*.ts` de E2. No conecta operaciones, no activa contenido oficial, sin pantallas.
- **Migraciones 0071 (estructura), 0072 (importación generada) y 0073 (historial editorial de versiones: cada cambio de estado, incluido el retorno de `en_revision` a `borrador`, con actor, fecha y motivo) aplicadas en dev.** 24 contenidos / 24 asignaciones (`legado`) / 24 versiones en `borrador`. Texto verificado igual al código.
- Estados `borrador→en_revision→aprobado→publicado→retirado` con tabla de transiciones; aprobar ≠ publicar ≠ liberar; solo Administrador (D-E4a-1); historial permanente (D-E4a-3); módulo oculto hasta E6 (D-E4a-2).
- Hash canónico (SHA-256, claves ordenadas, texto exacto) calculado solo en `contenidos/hash.ts`. Importación generada con prueba de deriva: cambiar un predeterminado rompe `npm test` y `contenidos:generar -- --verificar` hasta generar una migración nueva (solo versiones nuevas en borrador).
- Pruebas: 807 tests; `scripts/prueba_0071_contenidos.sql` (55 comprobaciones con roles, transacción descartada); controles 55–60 = 0; rollback probado en transacción descartada (`scripts/rollback_0071_comunicaciones.sql`, aborta ante trabajo editorial).
- Reinstalación probada (`scripts/armar-prueba-reinstalacion.mjs`, transacción descartada): el rollback aborta ante cualquier trabajo editorial (5 casos); en estado limpio revierte, reinstala 0071+0073 y deja estructura (145 elementos) y datos idénticos. Controles 55–62 probados con corrupción deliberada (`scripts/prueba_controles_55_62.sql`). Email/asunto modelados y probados (no se importan plantillas de email).
- Límites conocidos: los perfiles que aprobaron/publicaron no se pueden borrar (desactivar); la importación de `asunto` (correo) no está implementada.
- Próxima migración libre: **0074**. Sin pase a producción.

## R20 — E4a en producción y PR #47 mergeado (2026-10-10)
- **PR #47** (E2, solo código y docs, sin migraciones) mergeado en `main` (`11b426e`) con OK de Javier; Vercel de producción en success. Cobertura operativa pendiente (N03–N08, N10–N14, N16, N18, N17/N18 fuera de plazo en pantalla) anotada en RETOMAR; no bloqueó el pase.
- **PR #48** (E4a) con base `main`, solo E4a (23 archivos). Merge `e9baf23`, deploy de producción en success.
- **Migraciones 0071, 0072, 0073 en producción** (0001–0073): 24 contenidos, 24 versiones en borrador, 24 asignaciones en legado, 0 historial. Huella de datos idéntica a dev; controles 55–62 en 0; sin escritura directa para anon/authenticated. Sin conectar y sin pantallas.
- **Probado en dev:** instalación, reversión y reinstalación con los archivos reales de 0071/0072/0073 (transacción descartada, 11/11, 145 elementos de estructura y datos idénticos); el rollback aborta ante 5 tipos de trabajo editorial; controles 55–62 detectan corrupción deliberada (16/16); 810 tests.
- La firma de funciones de la prueba ignora comentarios y espacios (la 0071 de dev nació sin dos comentarios internos; mismo comportamiento).
- No se probó la idempotencia de reaplicar 0071/0073. Los perfiles que aprueben o publiquen no se podrán borrar (historial permanente).

