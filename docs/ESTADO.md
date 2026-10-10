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

Pasaron a `docs/archivo/ESTADO-2026-10.md` para que este archivo se pueda leer. Lo vigente de cada uno está en `docs/RETOMAR.md` y en `docs/reglas/`.

### L-01 · Un solo proceso de liquidación y una sola exposición — 2026-10-08

- **Pedido de Javier:** un solo proceso para todo cálculo de liquidación (el flujo solo cambia el objetivo) y una exposición consistente en formato y contenido en todo flujo. El cierre por retiro sigue como política (D34 punto 4): es un *modo*.
- **Cálculo:** `liquidar(datos, modo)` (`liquidar.ts`) con modos vencido, simulación, retiro y curso; `calcularLiquidacion` reemplaza `calcularPendientes*`; `lecturaAvance.ts` es el avance único (también en desasignar). Comparador antes/después: 0 diferencias en liquidaciones, pre-liquidación, simulación, retiros y cierres. Multicurso: pruebas de unidad (prorrateo, regla 17) y semilla permanente en dev (`scripts/seed_multicurso_dev.sql`).
- **Exposición:** `lineas.ts` (línea estándar), `lecturaContexto.ts` (cuenta, bonos, criterio y ciclo), `formatoLiquidacion.ts`, `TablasLineas.tsx` e `imprimirLineas.ts`. Las usan el retiro, la pre-liquidación y la simulación (pantalla e impreso, ahora apaisado) y el paso previo de Liquidaciones, que abre «Ver qué compone el monto» por profesor. El comprobante mide el avance con la regla de Asistencia, al cierre del período.
- **Retiro:** muestra en la misma tabla las membresías ya liquidadas sin pagar (Ortiz y Fernandez, N° 3) con «Este cierre —»; lo que el cierre dejaría afuera (regla 17, falta de foto de pago) es una traba en «Hay que resolver antes de confirmar», con curso y fechas. Pre-liquidación y Liquidaciones también ponen arriba lo que hay que resolver.
- **Verificado:** `tsc`, `lint`, `npm test` (366), y en pantalla en dev. Semilla de dev: `scripts/seed_liquidacion_pendiente_dev.sql`. Sin migración.
- **Anotado:** escritura única (TS vs RPC `retirar_profesor`) pide migración; el retiro a fecha futura no proyecta clases (incidente de la simulación a fecha futura).

### H0 · Higiene — 2026-10-08

- **Caja:** `lineasPorPagar` y `lineasPorCobrar` (`src/lib/cuentas.ts`) leen con `exigir()` (calidad 1): un fallo de lectura se ve, no deja la Caja vacía. Sin cambio de montos.
- **INCIDENTES:** reportes abiertos renumerados a I-012 (membresías) e I-013 (curso); filas de I-005b, I-006 e I-007; estados de I-001, I-003, I-005, I-009 y L-01 al día.
- **ESTADO:** secciones 1–7 archivadas en `docs/archivo/ESTADO-2026-08-09.md` (38 → 20 KB). `desasignar` ya usaba `avanceAlCorte` desde L-01.
- **Probado:** `tsc`, `lint`, `npm test` (366); `/caja` en dev (Por cobrar 1.530, Por pagar 1.749,11, cuadran con sus líneas).
- **Producción:** PR #32, `bf76d8a`, deploy `success`; sin migración; chip PROD confirmado por Javier.

### I-012 · Membresías, fase 0 (datos, sin pantalla) — 2026-10-08

- **Qué hay:** `src/lib/listaMembresias.ts` (puro: tipo, renovada, uso, banderas, chip, filtro y orden), `src/lib/membresiasLectura.ts` (lectura con `exigir`) y `src/app/(privado)/membresias/acciones.ts` (`listarMembresias`, `obtenerMembresia`; sin `page.tsx`, no crea ruta). Definiciones en D37 (`docs/decisiones/vigentes.md`).
- **`cuentas.ts`:** `estadoDeCuenta` sigue con la misma consulta y salida; el armado por membresía pasó a `armarMembresiasCuenta`, que comparte con la lista, y todas sus lecturas usan `exigir()` (un fallo de lectura se muestra). Anotado sin carril: `registrarCobro` y el `restantes` de la cuenta (cuenta solo presentes, mismo defecto de I-011) siguen igual.
- **Probado en dev:** `tsc`, `lint`, `npm test` (388); texto de `/alumnos/[id]/cuenta` (59) y `/caja/recibo/[id]` (71) antes y después: 0 diferencias; la lista da 73 membresías (48+15 regulares, 6 pruebas, 4 particulares), saldo total 1.530 y avance 108/225 · 110/116 · 6/6, igual que el SQL; 12 fichas de muestra (particulares con 6, 4, 3 y 2 reservas, una renovada 22→28).
- **Medido:** «por vencer» exige un ciclo de más de una clase: las 18 membresías de una sola clase (preventas y clase suelta) inflaban «por vencer» (24 contra 6). El interruptor `membresias_nuevas` nace en la fase 1a, con la primera pantalla; Playwright, también.
- **Alineado con H6:** una extensión agranda la misma membresía y no es renovación; la ficha deja `extensiones: []`. La migración 0063 del plan de H6 ya no es el número libre (la próxima es la 0067) y su botón «Extender» iría en la ficha nueva (fase 5); se decide al retomar H6.
- **Producción:** PR #34, merge `8abac17`, deploy `success` (2026-10-08); sin migración. I-014 abierto por PR #35 (`91823fc`), solo docs.

### I-012 · Membresías, fase 1a (shell básico) — 2026-10-08

- **Qué hay:** interruptor `membresias_nuevas` (migración **0067**, solo inserta el parámetro con `false`, grupo Sistema; en dev está en `true`); `src/lib/secciones.ts` (`seccionesVisibles`, pura, con pruebas) y su envoltorio `obtenerSeccionesVisibles()` en `sesion.ts`; entrada «Membresías» en `BarraLateral` (interruptor **y** `alumnos.ver` ∨ `particulares.ver` ∨ `alquileres.ver`); componentes en `src/components/nuevo/` con el tema `.ui-nuevo` (variables `--n-*` derivadas de la app, Geist solo ahí); `/membresias` con esqueleto (lista vacía + ficha «Elegí una membresía») y `/membresias/muestrario`.
- **Gate:** `membresias/layout.tsx` da `notFound()` con el interruptor apagado o sin permiso. El muestrario además da 404 en producción (entorno por la base, como el chip PROD/DEV).
- **Pieza compartida:** `AvisoWhatsapp` solo suma `onEnviado?` opcional; su aspecto dentro de `.ui-nuevo` se ajusta con CSS (`.n-wa`). `useCapa` lleva una pila de capas: Esc y Tab los atiende la de arriba (con una hoja con datos, el primer Esc cierra «¿Descartar?», no la hoja).
- **Probado en dev:** `npm test` (391), `tsc`, `eslint`, Playwright 11/11 (`npm run e2e`: entrada, muestrario, celular a 390 px y «interruptor apagado», que solo corre contra dev y restaura el valor). Con el interruptor apagado, recorrido en Chrome de Particulares, Alquileres, Alumnos y su cuenta, Sala, Caja y Liquidaciones: sin entrada nueva en la barra, `/membresias` da 404 y el resto igual.
- **Pendiente antes del pase:** el interruptor debe quedar en `false` en producción (la 0067 lo inserta así). Fuera de la 1a: lista, buscador, filtros y «+ Vender» son de la 1b.
- **Anotado:** en dev hay nombres con `??` (p. ej. «Yubinca ??»): dato, no de esta fase.
- **Cierre de la 1a (2026-10-08):** PR #37 fusionado en main (`10f33b4`), sin pase a producción; los `??` de nombres en dev los corrigió Javier.

### I-012 · Membresías, fase 1b (lista y ficha de lectura) — 2026-10-08

- **Qué hay:** `/membresias` (lista persistente con búsqueda «Alumno, WhatsApp, profesor o plan», filtros de tipo y estado en la URL) y `/membresias/[id]` (encabezado, indicadores, pestañas Clases o Reservas · Pagos · Historial, y columna con cuotas y cuenta, saldo de horas, detalle por tipo, lugar externo, profesor o servicio y avisos). Solo lectura: sin migración, sin acciones. Reglas en `src/lib/fichaMembresia.ts` (puro, con pruebas); la lectura se amplió en `membresiasLectura.ts` (pagos, clases, titular, alquiler).
- **Titular, no alumno:** la lista y la ficha muestran el titular con su rol (alumno, profesor de Tropicana, institución, persona sin rol) y «Avisos a» (tutor si es menor; quien atiende si es una institución).
- **Acciones de fases futuras:** Cobrar, Renovar y el menú ⋯ (Modificar, Reporte, Nueva reserva, Imprimir/Copiar, Dar de baja) y el lugar externo se ven deshabilitados con «Llega en la fase N». **Provisional:** antes de encender el interruptor en producción deben desaparecer o activarse.
- **Volumen:** 73 membresías en dev (52 activas) y 81 en producción (62 activas), 0 alquileres. La lista se lee entera una vez; `leerBase` falla con mensaje si la API cortara las filas. Carga medida en dev: 52 filas, 6–10 s con compilación en frío. Disparador: pasar de ~500 membresías → filtrar y paginar en el servidor.
- **Permisos:** una ficha inexistente y una que el rol no ve dan el mismo texto («Esa membresía no existe o no tenés permiso para verla.»); `membresiaVisible` es pura y está probada.
- **Probado en dev:** `npm test` (406), `tsc`, `eslint`, `next build`, Playwright 20/20 (lista, filtros y búsqueda, ficha regular y particular, paridad de saldos con la cuenta del alumno y con `/particulares/[id]`, ficha ajena, celular, y alquileres sembrados a nombre de una institución y de un profesor, borrados al terminar; «interruptor apagado» ahora incluye `/membresias/[id]`).
- **Diferencias con el diseño (a confirmar):** Clases muestra las ya registradas, sin la fila «Próxima»; Pagos no tiene «Pago reportado» (no existe el dato); el profesor de un curso se muestra como «quién dictó» (la membresía no lo guarda) (➜ hoy 2026-10-09: titular del curso por asignación, y quién dictó va por clase); sin «titular desde».

### I-012 · Membresías, fase 1b: revisión de Javier — 2026-10-09

- **Qué cambió:** la búsqueda reutiliza `coincideBusqueda` (la de Alumnos) y la aplica también al **tutor** (nombre y WhatsApp), sin acentos; busca además por plan, estilo, cursos y profesor titular. La `q` se lee siempre de la URL; con menos de 2 caracteres la lista lo dice. Lista vacía o con resultados avisan de los otros estados («Hay N en Históricas · Ver», «También hay N…»).
- **Menores:** la fila y la ficha dicen «Menor · tutor …» (`textoMenor`, como Alumnos e Inscripción; «tutor» genérico, decidido) y la ficha muestra el WhatsApp de avisos con enlace `wa.me` (`destinatarioAviso`).
- **Profesor:** la ficha muestra el titular de cada curso por asignación (`titularVigente`); en Clases, quién dictó y el sustituto = quien dictó sin ser el titular de ese día (`esSustituto`, regla 20).
- **Velocidad (sin cambiar datos):** `obtenerMembresia(id)` lee solo esa membresía (más las demás en columnas mínimas, para saber si la renuevan); consultas independientes en paralelo; `loading.tsx` con esqueleto. Medido en build local contra dev (clic → ficha): regular 4,9→4,4 s, particular 6,9→4,4 s, alquiler 7,9→4,9 s; ~300 ms por consulta desde esa máquina. No se midió en Vercel (preview con login de Vercel). Medición cerrada por Javier.
- **Interruptor:** `zz-interruptor-apagado` anota el valor original en `playwright/.interruptor-original.json` y lo repone `login.setup` si el proceso se cortó.
- **Filtros trabados:** no se reprodujo (25 combinaciones y volver a Todas + Activas dieron la cantidad inicial); si vuelve, se reabre.
- **Probado:** `npm test` 419, `tsc`, `eslint`, Playwright 35/35 en dev; conteos tipo × estado = consulta directa a la base. Javier probó a mano y aprobó.
- **RLS (pendiente de cierre):** un Profesor con alcance propio no ve el titular de una de sus particulares (`contacto_visible_por_profesor` no cubre `membresias.profesor_id`); Gerente y Asistente sí lo ven. Antes de la fase 2: explicarle a Javier qué cambio hace falta (migración 0068).
- **Cierre:** PR #38 (`a6af127`) y #39 (`9ec1bf7`) fusionados en main, sin pase a producción; interruptor apagado en producción (0067 sin aplicar).

### I-012 · Membresías, fase 2 (reservas en la ficha + corrección visual) — 2026-10-09

- **Rama** `membresias/fase-2` (commits 5–13), sin pase a producción. Migraciones **0068** `menu_plegable` (control 52) y **0069** `reagenda_de` (control 53), aplicadas solo en dev.
- **Qué cambió:** reservas dentro de la ficha (`FilaReserva`, gestión desde la fila); menú lateral plegable (rail 4,25 rem / desplegado 17 rem); escala única en rem; disposición final de la ficha por container queries; hoja «+ Nueva reserva» con grilla de franjas (`lib/franjasReserva.ts`, `HojaFranjas`, `SemanaChips`), que también reprograma (`moverReserva`) y reagenda.
- **Regla de duración (Javier):** al menos `duracion_minima_curso_min`, y de ahí de a `tiempos_incremento_min`. Con el rango en lo disponible, el resumen dice «No quedan horas para alargar · disponible X h» y el clic en la franja inmediata mueve sin alargar.
- **«Por reagendar»** (etiqueta de `reagendar`; `TRANSICIONES` no cambia): la fila ofrece «Reagendar», que abre la hoja como reserva nueva y guarda `reagenda_de`; la original muestra «Reagendada → fecha · hora». Una reserva se reagenda una sola vez; el plazo no se valida todavía.
- **Avisos de WhatsApp** de las acciones de la ficha: tarjeta «Para avisar» en la columna derecha, cerrable, solo en memoria.
- **Velocidad (commit 13):** sesión memorizada por petición (`porPeticion` en `sesion.ts`), identidad por `getClaims()` en el proxy y las acciones, precarga de la semana siguiente. Abrir la hoja 2,5 s → ~1,7 s; semana siguiente ~0,3–0,45 s.
- **E2E:** membresía de prueba propia (`e2e/membresiaDePrueba.ts`), reservas a más de 48 h; el barrido de datos de prueba es por SQL, solo en dev.
- **Antes del pase a producción (➜ hoy 2026-10-09: hecho, ver bloque de abajo):** JWKS de producción asimétrico; duración del token de acceso en dev y producción; pruebas intermitentes del muestrario anotadas como conocidas.
- **Falta (➜ hoy 2026-10-09: e2e con el menú plegado, PR #41 y 0070 hechos, todo en producción):** e2e con el menú plegado, PR. Después: RLS del Profesor (migración **0070**) en su propio PR.
- **Probado:** `npm test` 465, `tsc` y `eslint` limpios; e2e de `membresias-2-reprogramar` (5 casos).

### I-012 · Pase a producción (fase 2 + RLS del Profesor) — 2026-10-09

- **PR #41** (`c58133b`, migraciones 0067, 0068, 0069) y **PR #44** (`ae427b3`, migración 0070). Producción en **0001–0070**; `membresias_nuevas` y `menu_plegable` en `true` para todos. Sin 1.0 ni interruptor por rol (proceso simple: dev → producción).
- **Respaldo del PR #41:** `reservas_sala_previo_0069` y `parametros_previo_0069`; rollback `scripts/rollback_0067_0069_membresias.sql` probado fila por fila en dev y en seco en producción. Validado por Javier con la membresía «PRUEBA» (id 88), retirada con el barrido SQL (trigger `reservas_historial_no_update` apagado dentro de una transacción, verificado en `O`); tablas `*_previo_0069` borradas con su OK.
- **Token de producción** (leído por Javier): ES256 (clave `5bbd09b5…`), 3600 s, igual que dev; JWKS público coincide.
- **0070 (solo funciones):** `contacto_visible_por_profesor` ve al titular de las particulares que dicta (`membresias.profesor_id`) y al tutor de un menor visible (`tutor_de`); ayudante `contacto_visible_directo_por_profesor`; control 54; rollback `scripts/rollback_0070_profesor_titular.sql` (probado en dev, misma huella que la 0048 en producción).
- **Código del PR #44:** con **contactos** en alcance propio, la lista y la ficha de Membresías solo muestran regulares y pruebas de cursos del profesor (`cursosPropios`, `membresiaVisible`). Primer intento con `alumnos` falló: ese módulo no tiene selector en `rol_visibilidad`.
- **Probado:** prueba técnica en producción (login, `/membresias`, ficha, `/caja`, `/sala`, `/liquidaciones`); `npm test` 466, `tsc` y ESLint limpios; cuenta de Oscar Nuñez en dev (12 activas, 3 históricas) y confirmación de Javier en producción.
- **Anotado:** aviso React #418 (hidratación de texto) una vez al cargar `/caja`; sin reproducir.

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

## R20 — E4b + E5 · avisos registrados y N09–N10 (2026-10-10, solo dev)
Rama `r20-e4b-n09`. Migración 0074 aplicada en dev; N09/N10 liberadas (`modo='modulo'`) con S05. Detalle, pruebas y M1 en `docs/relevamientos/2026-10-10-r20-e4b-e5-avisos-n09-n10.md`. Próxima migración libre: **0075**. Sin pase a producción.
