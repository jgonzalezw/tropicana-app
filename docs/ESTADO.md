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
