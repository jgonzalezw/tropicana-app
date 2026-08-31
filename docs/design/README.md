# Handoff: Tropicana — Login, Inscripción, Asistencia, Caja, Precios, Servicios y Profesores

> **Esta carpeta es la fuente de verdad del diseño.** Los `.dc.html` de acá son los prototipos vigentes, con los cambios de copy hechos en revisión ya bajados. Code los toma al construir; no se editan del lado del código.

## Changelog

### 30 ago 2026 (4) — Profesores, y dos patrones que suben al sistema
| Pantalla | Qué cambió |
| --- | --- |
| **Profesores y asignaciones** (nueva) | Dos pestañas en una pantalla. *Listado*: el padrón como `.table.table-edit`, con **Editar** y **Eliminar / Desactivar / Activar** y el motivo al lado del botón, nombrando los dependientes concretos. *Asignación a curso*: tres bloques progresivos — curso, titular, comisiones — con los dos porcentajes en campos grandes y un panel con **candado** que dice, antes del botón, que confirmar los congela para esa asignación. Reemplazar un titular avisa con los porcentajes y la fecha de la asignación que se cierra. La tabla de asignaciones vigentes es la única del producto que **no** usa celdas editables: esos números son fijos por diseño. |
| **Profesor** (componente nuevo, compartido) | Buscar, alta, edición y baja de un profesor en un solo componente, montado idéntico donde el profesor participe — mismo contrato que `Cobro`: los datos entran por prop, el componente avisa hacia afuera. Incluye nombre y apellido separados, WhatsApp con el panel de duplicado de siempre, especialidades como chips, el tipo Activo/Externo con la consecuencia de tarifa de sala escrita al lado, y el **vínculo opcional uno a uno con una cuenta de login** — con la copy adaptada: un externo que solo alquila la sala normalmente no necesita cuenta. |
| **Design system Organic** | Suben dos patrones que ya se habían compuesto dos veces: **`.table-edit`** (celda de tabla editable, `.cell-input`, `.is-num`, `.is-empty`, `tr.is-off`, `.cell-reason`) y **`.chips`** (multi-select de pills), cada uno con su página de referencia en `components/`. Screen 9 los toma del sistema, no los recompone. |
| App Shell | *Profesores → Profesores y cursos* ahora apunta a la pantalla nueva. |
| Precios y paquetes · Login · Inscribir y cobrar · Vender servicio · Confirmar sesión · Tomar asistencia · Caja y resumen · Cobro | Sin cambios. |

**Desviaciones del sistema de diseño:** ninguna — al contrario, esta ronda **devuelve** al sistema dos patrones que estaban compuestos a mano. Dos cosas a mirar: (1) los agregados están escritos en la copia del sistema bound a este proyecto y **falta mergearlos al proyecto del design system** para que otros proyectos los hereden; (2) *Precios y paquetes* sigue con las clases locales originales — el mapeo a las del sistema es uno a uno y quedó documentado, pero lo dejé para una pasada aparte para que el cambio sea revisable solo.

**Además, sin diseño:** quedó escrita la **directriz para Etapa 1** (componentes de entidad compartidos y CRUD con eliminación guardada, incluido el caso de Alumno) como sección propia de este README — es la regla de construcción para Code, no un pedido de pantalla.

### 30 ago 2026 (3) — Copy revisada en pantalla, y el paquete pasa a `docs/design/`
| Pantalla | Qué cambió |
| --- | --- |
| Login | Cuerpo del panel de credenciales: "Revisá el correo y volvé a escribir la contraseña." → **"Volvé a escribir la contraseña."** El encabezado ya dice qué falló; la segunda oración repetía la instrucción. |
| Precios y paquetes | Bajada de la pantalla: se cae "Nada está fijo en el código:" y queda **"Todo precio que cobra la escuela se carga acá. Si un valor no está en estas cinco tablas, el sistema no lo puede cobrar."** — la consecuencia sola dice lo mismo sin hablar del código. Encabezado de columna del bloque B: "Descuento" → **"%Descuento"**, la unidad en el título en vez de en la celda. |
| Paquete | El handoff se muda de `design_handoff_tropicana/` a **`docs/design/`**, con los prototipos, el README, DECISIONES.md, las capturas y el design system. Los `.dc.html` de esa carpeta son la fuente de verdad; Code los toma al construir. |

**Desviaciones del sistema de diseño:** ninguna. Cambios de texto, sin tocar layout ni tokens.

### 30 ago 2026 (2) — Servicios: particulares y alquiler de sala
| Pantalla | Qué cambió |
| --- | --- |
| **Vender servicio** (nueva) | Los dos servicios que no son inscripción mensual, en tres bloques progresivos como *Inscribir y cobrar*: tipo y comprador, paquete, cobro. En particular, el buscador de alumno con el mismo panel de duplicados, un **acompañante opcional** que es lo único que define el tamaño (no se vuelve a preguntar), y el profesor elegido de una lista donde cada fila muestra la categoría con la que entra a la tabla E. En alquiler, la categoría del comprador filtra el padrón que se busca — y *Tercero* reemplaza el buscador por un nombre libre. Antes de cobrar, un panel `accent-2` muestra el efecto invisible: **"Costo de sala para Nuñez Oscar: Bs. 140, se descuenta de su liquidación mensual"**, con las coordenadas resueltas debajo. |
| **Confirmar sesión** (nueva) | El equivalente de asistencia para un paquete de particular: datos del paquete, horas restantes, duración de la sesión (0,5 / 1 / 2 h, recortada a lo que queda) y **un solo botón "Sesión dictada"** — la pareja es una unidad, no dos marcas. Los tres efectos (paquete del alumno, paquete de sala del profesor, comisión) se muestran como previa antes de confirmar y como recibo después. Paquete en cero: card *Paquete agotado*, botón deshabilitado. |
| Tomar asistencia | **Las clases de prueba entran a la misma lista**, al final: una fila "Alumno de Prueba (3)" que se marca como unidad si se vendió como genérico con cantidad, o una fila por persona si se cargaron alumnos identificados. Pill `tag-outline` **Prueba**, sub-línea con el precio de la tabla C, y **los contadores pasan a contar personas, no filas** (14 alumnos + 3 pruebas = 17). El cobro de la prueba suma a la comisión del profesor y el banner de guardado lo dice. |
| App Shell | Dos ítems nuevos: **Vender servicio** bajo *Inscripciones y Cobros* y **Confirmar sesión** bajo *Profesores* (22 destinos). |
| Precios y paquetes · Login · Inscribir y cobrar · Caja y resumen · Cobro | Sin cambios. |

**Desviaciones del sistema de diseño:** ninguna. Un detalle a mirar: la pill **Prueba** usa `tag-outline`, el único tag del sistema sin relleno — elegido a propósito para que no compita con `tag-accent` (tolerancia) ni `tag-accent-2` (estados positivos) en la misma fila.

**Para confirmar con vos:** (1) en *Vender servicio* la lista de profesores incluye **activos y externos** con su tag, porque el efecto en la tabla E que pediste nombra las dos categorías, aunque el bloque 1 decía "lista de profesores activos"; (2) el alta de alumno en esta pantalla trae el panel de duplicado por WhatsApp pero **no** la clave compuesta de menor con tutor — el alta completa sigue viviendo en *Inscribir y cobrar*.

### 30 ago 2026 — Precios y paquetes
| Pantalla | Qué cambió |
| --- | --- |
| **Precios y paquetes** (nuevo) | Las cinco tablas de precios en **una pantalla con cinco pestañas**, no cinco destinos del menú: *Inscripción parcial · Meses adelantados · Clase de prueba · Clases particulares · Alquiler de sala*. Celdas editables siempre visibles (sin modo edición), tarifa faltante marcada con `accent-100`/`accent-400` y el tag "Cae al mensual", y una regla de CRUD igual en las cinco: se elimina de verdad solo la fila sin uso; la usada se desactiva y el motivo se muestra al lado del botón, no en un tooltip. La matriz de alquiler resuelve sus tres dimensiones como **un segmentado de categoría + una grilla horas × tamaño**, con los máximos de personas de cada tamaño editables, un panel que declara la tabla como fuente única del costo de sala, y un simulador que muestra qué celda usa una clase particular para el descuento en la liquidación. |
| App Shell | Un ítem nuevo bajo *Administración*: **Precios y paquetes** (ahora cuatro sub-ítems, 22 destinos). |
| Inscribir y cobrar · Login · Tomar asistencia · Caja y resumen · Cobro | Sin cambios. |

**Desviaciones del sistema de diseño:** ninguna nueva. Sí conviene registrar un patrón que antes no existía en el producto: **una tabla de datos con celdas editables**. Organic trae `.table` para lectura y `.input` para formularios, pero no una celda de edición. Se compuso con las dos piezas (`.input` de 42px dentro de `td`) más tres clases utilitarias (`.pp-tbl`, `.pp-num`, `.pp-txt`) que solo ajustan medidas y alineación — sin colores ni radios nuevos. **Si esto se repite en otras pantallas de administración, conviene subirlo al sistema como componente.**

### 29 ago 2026 (4) — *Medio mes*: subconjunto de días
| Pantalla | Qué cambió |
| --- | --- |
| Inscribir y cobrar | El reparto de *Medio mes* pasa de **radio a casillas**: se puede tildar y destildar cada día de clase del curso, no solo "todos" o "uno". Así un curso de tres días permite el caso intermedio — Lu-Mi-Vi tildando Lu y Mi son las mismas **6 clases en 3 semanas**. Se agrega una línea de resumen bajo el control ("6 clases · 2 días por semana · se completan en 3 semanas") y las **fechas de inicio se limitan a los días tildados**, para no ofrecer arrancar un viernes que el alumno no toma. Se agregó al prototipo un curso de 3 días semanales (*Salsa Intensivo*, Lu-Mi-Vi, Bs. 330) para poder probarlo. |
| App Shell · Login · Tomar asistencia · Caja y resumen · Cobro | Sin cambios. |

**Desviaciones del sistema de diseño:** ninguna. Las casillas usan el mismo `.seg` / `.seg-opt` que los radios — Organic oculta el input y pinta el `label`, así que `:has(input:checked)` funciona igual con `type="checkbox"`.

### 29 ago 2026 (3) — Corrección de *Medio mes*
| Pantalla | Qué cambió |
| --- | --- |
| Inscribir y cobrar | **El total de clases de *Medio mes* lo fija el curso, no la selección de días.** La versión anterior descontaba clases al elegir un solo día (curso Lu-Mi + solo lunes → 2 clases). Ahora son siempre `2 × días semanales del curso`: el mismo curso da **4 clases** en las dos distribuciones, y lo que cambia es en cuántas semanas se consumen — 2 semanas tomando Lu y Mi, o 4 lunes seguidos. Las etiquetas del control pasan a llevar su propio span: "Todos los días · 2 semanas", "Solo lunes · 4 semanas". La nota de período sigue listando exactamente las clases contadas. |
| App Shell · Login · Tomar asistencia · Caja y resumen · Cobro | Sin cambios. |

**Desviaciones del sistema de diseño:** ninguna. Solo cambia el cálculo y el texto de las etiquetas.

### 29 ago 2026 (2) — App Shell + correcciones de inscripción
| Pantalla | Qué cambió |
| --- | --- |
| **App Shell** (nuevo) | Armazón de navegación para los dos perfiles: barra lateral persistente de 264px en escritorio con siete grupos y sub-ítems, drawer con hamburguesa por debajo de 900px, y barra inferior de dos pestañas para la profesora. El encabezado suelto (logo + "Natalia · admin") y el cierre de sesión pasan al shell. |
| Inscribir y cobrar | **(A)** Identidad del menor = WhatsApp del tutor + nombre; el celular propio pasa a ser opcional cuando hay tutor, con detección de duplicados sobre la clave compuesta. **(B)** Si el WhatsApp del tutor ya es de un alumno, se ofrece vincular en vez de duplicar. **(C)** *Medio mes* deja de ser una ventana de 15 días de calendario y pasa a contarse por repeticiones del patrón semanal, con la nota de período listando exactamente esas clases. *(Ajustado de nuevo en la ronda (3) — ver arriba.)* |
| Login · Tomar asistencia · Caja y resumen · Cobro | Sin cambios. |

**Desviaciones del sistema de diseño en esta ronda:** ninguna nueva. El shell usa los mismos tokens, rampas, radios y tipografía. Dos apartados menores que sí conviene registrar, porque no existían antes en el producto:
- **Dos clases utilitarias en `<style>`** (`.aside-fija` / `.aside-drawer`) en lugar de estilos inline, para que la barra lateral y el drawer sean **el mismo elemento** en dos posiciones y no dos listas de navegación duplicadas.
- **El fondo del drawer** usa `rgba(12, 10, 9, .62)`, un negro translúcido que no está en las rampas. Organic no define un token de backdrop; se eligió el negro más cercano al `--color-bg` en lugar de inventar un token nuevo. **Si querés, lo convertimos en token.**

**A revisar (decisión de producto, no de diseño):** los tres perfiles de administración (admin, gerente, asistente) ven hoy **los siete grupos completos**. Falta definir qué ve cada uno — probablemente el asistente no debería ver *Administración* ni *Reportes*.


### 29 ago 2026 — se agrega Login
| Pantalla | Qué cambió |
| --- | --- |
| **Login** (nueva) | Pantalla única de acceso: logo centrado, correo, contraseña con mostrar/ocultar, acción primaria "Iniciar sesión", error de credenciales en línea. Sin registro ni recuperación de contraseña — fuera de alcance por decisión explícita. |
| Inscribir y cobrar | Sin cambios. |
| Tomar asistencia | Sin cambios. |
| Caja y resumen | Sin cambios. |
| Cobro (paso compartido) | Sin cambios. |

**Desviaciones del sistema de diseño en esta ronda:** ninguna nueva. Login reusa los tokens oscuros, las rampas, los radios y la tipografía ya definidos, sin agregar valores. Las cuatro desviaciones vigentes (fondo oscuro, Montserrat en lugar de Caprasimo, sin sombras, sin fotografía) siguen siendo las mismas y están documentadas en *Design Tokens* y en `DECISIONES.md`.

**Punto a revisar, no una desviación:** el error de credenciales usa el panel `accent-100` — el mismo tratamiento que el aviso de WhatsApp duplicado, por pedido explícito. Eso hace que en este producto el panel `accent-100` cubra dos casos, informativo y de error. Los errores de validación de campos vacíos siguen usando la franja `accent-200` de las otras pantallas. Ver *Two error treatments* en la pantalla 4.

## Overview
Nine screens for **Tropicana**, a dance school in Bolivia, covering the school administrator's and the teacher's daily jobs:

1. **Inscribir y cobrar** (mobile) — enrol a student in a course and take the first payment in a single flow: a full month, a partial modality (one class, one week, half a month) at its own tariff, or several months in advance with the automatic discount.
2. **Tomar asistencia** (mobile) — a teacher takes attendance for one class, standing in the studio.
3. **Caja y resumen** (mobile + desktop) — cash balance, month summary, and manual cash movements.
4. **Login** (mobile + desktop) — the entry point to all of the above. Email and password, nothing else.
5. **App Shell** (mobile + desktop, both roles) — the navigation frame the four screens above are mounted inside.

All copy is in **Spanish (Bolivia)**. Currency is the **Boliviano**, always formatted as prefix `Bs. ` with `es-BO` thousands separators (e.g. `Bs. 1.360`).

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behaviour, **not production code to copy directly**. They are authored as "Design Components": a single `.dc.html` file per screen holding markup plus a small logic class, with all styling inline against CSS custom properties.

The task is to **recreate these designs in the target codebase's existing environment** (React, Vue, SwiftUI, Flutter, native, etc.) using its established patterns, component library, and state management. If no environment exists yet, choose the framework that best fits the product (a mobile-first web app is a good default here: the administrator and teachers work from phones, and one screen must also work on a desktop browser) and implement the designs there.

The data in the prototypes is **hard-coded sample data** taken from the school's real spreadsheet (students, courses, prices, teachers). In production all of it comes from the backend.

## Fidelity
**High-fidelity (hifi).** Colors, typography, spacing, radii, states, and copy are final. Recreate the UI pixel-perfectly using the codebase's own libraries where they exist. Two caveats:

- **All three screens are responsive**: one app-shell column that works from a 360px phone up to a desktop browser. Each is a `100dvh` flex column — header, scrolling content, sticky action footer — centred with a `max-width` (680px for enrolment, 900px for attendance; the cash screen is a normal 1180px page). Nothing needs a device frame.
- Fonts are loaded from Google Fonts in the prototype. In production, self-host or use the app's existing font pipeline.

## Design Tokens

The prototypes consume the **Organic** design system (warm, rounded, cream-and-terracotta) but override its tokens for a **dark ground**. The dark values below are the ones to implement. The ramps are inverted relative to the light system, so step 100 is the darkest and 900 the lightest; muted text uses `neutral-700`, tinted fills use `accent-200` / `accent-2-200`, and text on those fills uses `accent-800` / `accent-2-800`.

### Color — roles
| Token | Hex | Used for |
| --- | --- | --- |
| `--color-bg` | `#1c1815` | page ground; also the "ink" color for icons/text sitting on a solid accent fill |
| `--color-surface` | `#272220` | cards, sticky footer, header bar |
| `--color-text` | `#f4ebdd` | body and heading text |
| `--color-divider` | `rgba(244,235,221,0.16)` | 1px rules, input borders |
| `--color-accent` | `#e08b4f` | primary buttons, step badges, chevrons, caret |
| `--color-accent-2` | `#9bad78` | second voice (sage) |
| `--tropi-chip` | `#f4ebdd` | cream pill behind the Tropicana logo |

### Color — neutral ramp (dark, inverted)
`100 #302a25` · `200 #3a332d` · `300 #463e37` · `400 #6d6359` · `500 #8f8578` · `600 #ab9f91` · `700 #c8bbaa` · `800 #e2d7c6` · `900 #f4ebdd`

- `100` — elevated surfaces inside a card (student card, form card, input fills, movement rows)
- `300` — progress-bar tracks
- `400` — unchecked circle outline in the attendance list
- `700` — muted/secondary text (the most-used step)

### Color — accent ramp (terracotta, dark, inverted)
`100 #37200f` · `200 #6b3714` · `300 #8c491a` · `400 #b2622d` · `500 #d67f48` · `600 #f6a06b` · `700 #ffc0a0` · `800 #ffd3b5` · `900 #fff2eb`

- `200` fill + `300` border + `800` text — the **ausente** row, error messages
- `700` — debt text, "descuenta de…" helper text, solid circle behind the ✕ mark
- `600` — egresos bar fill
- `100` — duplicate-WhatsApp warning panel, discount panel fill

### Color — accent-2 ramp (sage, dark, inverted)
`100 #232a18` · `200 #3a4726` · `300 #56633f` · `400 #728157` · `500 #8fa073` · `600 #a8bb88` · `700 #ccdbb2` · `800 #dcebc4` · `900 #f0fae1`

- `200` fill + `300` border + `800` text — the **presente** row, success banners
- `600` — solid circle behind the ✓ mark, ingresos bar fill
- `800` — ingresos figure, "por cobrar" total

### Typography
| Role | Value |
| --- | --- |
| Headings / big numbers | **Montserrat**, weight **800**, `letter-spacing: -0.025em`, `line-height: 1.12` |
| Body / UI | **Figtree**, 400 / 600 / 700 |
| Buttons | Montserrat 700, `letter-spacing: 0.01em` |

Sizes actually used (px): body/labels 13–17, list item names 17–19, section headings 19–21, screen titles 24–29 (desktop title `clamp(30px, 5vw, 42px)`), hero figure `clamp(44px, 9vw, 72px)`, secondary figures 26–32.

**Minimums to respect:** no interactive text below 15px, no tap target below 44px. Inputs are `min-height: 50–52px`, primary buttons `min-height: 56–58px`, attendance rows `min-height: 74px`.

### Radius, spacing, elevation
Over-round, per the design system: outer cards **26–32px**, inner cards / panels **20–22px**, inputs and buttons and chips **999px (pill)**, small fills 18–20px, avatar/marker circles 50%.

Spacing: card padding 16–20px on mobile, `clamp(18px, 3vw, 28px)` on desktop; 8px between list rows; 10–14px between fields; 12px between stacked cards.

No box-shadows are used on the dark ground — separation comes from surface steps (`bg` → `surface` → `neutral-100`).

### Icons
**Lucide**, `stroke-width: 2.75`, `stroke-linecap/linejoin: round`. Used: `check` (✓), `x`, `plus`, `chevron-down`. Sizes 18–24px.

### Motion
One entrance only: `@keyframes` from `opacity: 0; translateY(6px)` to `opacity: 1`, **200–250ms ease-out**, on banners and panels that appear in place. No other animation.

---

# Shared step — Cobro (`Cobro.dc.html`)

**Taking money is one flow, called from every operation.** Enrolling a student, paying a teacher's commission, settling a supplier — the decision is always the same shape: *this is the balance, how much moves, by what means, with what discount or adjustment, and what is left*. That shape lives in one component, mounted by the screens that need it, instead of being re-implemented per screen (which is how the two screens drifted apart in the first place).

It renders, in order:

1. **Reference header** (only with a subject): the subject 18px/700, a detail line 14px `neutral-700`, and on the right the reference label 14px `neutral-700` over the amount in Montserrat 26px — **the figure the discount and the payment apply to, always on screen**.
2. **Mode segmented**: `Cuota entera` / `Otro monto` / `No cobra hoy` for a collection, `Pago total` / `Pago a cuenta` / `No paga hoy` for a payment. The third option only when `permitirSinCobro`.
3. **Amount field**, when the mode is partial (or when there is no reference at all).
4. **Medio de pago** segmented, from a caller-supplied list; an option matching `Otro` reveals a free-text note.
5. **Discount / adjustment**, per the caller's `politica`: a ghost button revealing an `accent-100` panel with amount + **obligatory motive**. `descuento` labels it "Aplicar un descuento", `ajuste` labels it "Registrar un ajuste", `simple` omits it entirely.
6. **Totals**: the discount line in `accent-2-800` when there is one, then `Cobra hoy` / `Paga hoy` and `Queda pendiente`.

```
total = max(0, referencia − ajuste)
mueve = modo 'sin' ? 0 : modo 'entero' ? total : parsed(monto)
saldo = max(0, total − mueve)
```

**Props:** `sujeto`, `detalle`, `referencia` (number), `referenciaLabel`, `politica` (`descuento|ajuste|simple`), `direccion` (`cobro|pago`), `medios` (comma-separated), `permitirSinCobro`, `cuentaId` (changing it resets the step), `onChange`.

**`onChange` payload:** `{cuentaId, modo, monto, medio, notaMedio, ajuste, ajusteMotivo, referencia, total, saldo, valido}`. The host owns persistence, validation messages and its own summary; the step owns only this decision.

**With no reference** (`referencia = 0`, a loose cash movement, or a creditor whose balance is settled) it collapses to amount + means: no mode segmented, no discount, no "queda pendiente". The subject header still shows when a subject was passed, so paying a teacher who is up to date reads "Salek Natalia · Salsa y Bachata Inicial — Saldo a pagar Bs. 0" and the movement is recorded as an advance.

Implement it as one reusable component in the target codebase, and mount it from every operation that takes or hands over money.

---

# Screen 1 — Inscribir y cobrar

**File:** `Inscribir y cobrar.dc.html` · **Responsive: 360px phone to desktop, column capped at 680px** · **User:** the administrator, on her phone at the front desk or at the computer.

## Purpose
Enrol a student and take the first monthly fee **without leaving the screen**. One scrolling page with three numbered blocks that open progressively; a sticky footer holds the total and the confirm action.

## Layout
Column, full height:
1. **Header** (`padding: 18px`): cream logo pill (`--tropi-chip`, radius 999px, padding 5px 13px, logo image 24px tall), then `Natalia · admin` pushed right, 13px, `neutral-700`.
2. **Title block** (`padding: 4px 18px 14px`): h1 29px "Inscribir y cobrar"; subtitle 15px `neutral-700` "Alumno, curso y primera cuota en una sola pantalla."
3. **Scroll area** (`flex: 1; overflow: auto; padding: 0 14px 26px`) — the three blocks.
4. **Sticky footer** (`--color-surface`, 1px `divider` top border, `padding: 12px 16px 16px`).

Each block is a card: `--color-surface`, radius 26px, padding 16px, 12px gap. Header row per block: a 30px circle badge (`--color-accent` fill, `--color-bg` numeral, Montserrat 15px) + the block name (Montserrat 19px).

## Block 1 — Alumno

### State A: no student selected
- **Search field.** Label 14px "Buscar por nombre o WhatsApp"; pill input, `neutral-100` fill, 17px text, min-height 50px, placeholder `ej. Virginia · 7105`. Searching starts at 2 characters; name match is a substring (case-insensitive), WhatsApp match is a prefix match on digits only (3+ digits). Max 4 results.
- **Result rows.** `neutral-100` fill, 1px `divider` border, radius 20px, padding 12px 14px, 8px gap. Left: name 17px/600, `WhatsApp 71 054 962` 14px `neutral-700`. Right: a nowrap pill — `Debe Bs. 200` (tag-accent) when the student owes, `Al día` (tag-accent-2) when not. Whole row is the tap target.
- **Empty state.** 15px `neutral-700`: "Nadie con ese dato. Cargalo como alumno nuevo."
- **"Alumno nuevo"** secondary button, full width, `neutral-100` fill, 18px, min-height 56px, with a `plus` icon. Opening it pre-fills the WhatsApp field if the query looked like a number.

### State A2: new-student form (`neutral-100` card, radius 22px, padding 14px)
- **Nombre** and **Apellido** side by side (`display: flex; gap: 10px`) — **separate fields, never one "full name" input**.
- **WhatsApp**, full width, `inputMode="tel"`. Its label carries the rule inline, and **the qualifier changes with the form's state** (`accent-700`): "· identifica al alumno" with no tutor, "· opcional si hay tutor" once a tutor is open. **WhatsApp is the unique identifier for an adult student.**
- **Duplicate check.** As soon as the digits reach 6, look the number up. On a hit show a panel (`accent-100` fill, radius 20px, padding 14px): heading 14px/600 `accent-800` "Ese WhatsApp ya está cargado", the existing student's name 17px/600, then `Deuda actual: Bs. 250` and `Cursos: …` (or "ninguno activo") at 14px `neutral-700`. Two actions: **"Usar este alumno"** (primary, flex 1, min-height 48px) selects the existing record; **"Es otra persona"** (secondary) dismisses the check for the current input. While the panel is open, "Guardar alumno" stays disabled.
- **Tutor (optional).** Ghost button toggles between "Es menor: agregar tutor" and "Quitar tutor"; open state reveals **Tutor** (name) and **WhatsApp tutor** side by side, the second labelled "WhatsApp tutor · identifica al menor". Closing clears both, plus the link and both dismissals.
  - Under the pair, a 14px `neutral-700` line states the rule: "Al menor lo identificamos por el WhatsApp del tutor y su nombre, así dos hermanos con el mismo tutor no se pisan."

### The identifier for a minor is a composite key
A minor may not have a phone, and siblings share the tutor's number, so **WhatsApp alone cannot identify them**. With a tutor loaded, the student's identity becomes **tutor's WhatsApp + the student's first name (no surname)**:

```
identidad = alumno adulto  → dígitos(whatsapp propio)
            menor con tutor → dígitos(whatsapp del tutor) + '|' + minúsculas(nombre)
```

Two consequences, both deliberate:
- Two siblings under the same tutor **do not collide** (Bruno and Ana Barrientos, tutor 70 878 081, are two records).
- The **same** minor loaded twice **is caught** (Bruno again under 70 878 081 is a duplicate).

The detection is the mechanism the screen already had — lookup as you type, then the `accent-100` panel — pointed at the composite key. It fires as soon as the tutor's number reaches 6 digits **and** the name field is non-empty, and it lives **inside the tutor block**, below the fields that produce the key:

- Heading 14px/600 `accent-800` "Ese menor ya está cargado", then the name 17px/600, then the key that matched — "Tutor 70 878 081 · nombre Bruno" — then `Deuda actual` and `Cursos`, both 14px `neutral-700`.
- Actions, same as the WhatsApp panel: **"Usar este alumno"** (primary, flex 1, min-height 48px) and **"Es otra persona"** (secondary, dismisses for the current input).

### The tutor may already be a student
When the tutor's WhatsApp belongs to an existing student's **own** number, the screen offers to **link** rather than create a second person. Same `accent-100` panel, one line shorter:

- Heading "Ese WhatsApp ya es de un alumno", the name 17px/600, `Deuda actual: Bs. 250` 14px `neutral-700`.
- **"Vincular a esta persona"** (primary) fills the tutor's name and number from that record and marks the link; **"Es otra persona"** dismisses.
- While linked, an `accent-2-200` confirmation replaces the panel — radius 20px, padding 12px 14px, 20px `check` icon in `accent-2-800`, text 15px `accent-2-900` "Vinculado a Jhonny Cutipa, que ya está cargado como alumno.", plus a **Desvincular** ghost button. Typing over either tutor field breaks the link.

**Both panels block the save.** "Guardar alumno" stays disabled while any of the three duplicate panels (own WhatsApp, minor, tutor) is open.
- **"Guardar alumno"** primary, full width; enabled only when nombre and apellido are present, **the identity resolves** — 6+ digits of the student's own WhatsApp, **or** a tutor with 6+ digits plus a non-empty name — and no duplicate panel is pending. When the student has no number of their own, the record is saved with the tutor's.

### State B: student selected
`neutral-100` card: name 20px/700, `WhatsApp …` 15px `neutral-700`, a **"Cambiar"** ghost button top-right (clears the student *and* the course). Below, two equal tiles (`flex; gap: 8px`, each `neutral-100`… on the white card use `--color-neutral-100`, radius 18px, padding 10px 12px):
- **Deuda anterior** — 13px label, 18px/700 amount.
- **Ya inscripto en** — 13px label, 15px/600 course list joined with ` · `, or "Ningún curso todavía".

This pair is a hard requirement: the administrator must see prior debt and current enrolments before charging.

## Block 2 — Curso e inicio
- Locked until a student exists: 15px `neutral-700` "Elegí primero el alumno."
- **Course list** — same row treatment as the search results: name 17px/600, then `Línea · Días y hora · Profesor` 14px `neutral-700`, price right-aligned 16px/700.
- **Selected state** — `neutral-100` card: course name 19px/700, `Días y hora · Profesor` 15px `neutral-700`, "Cambiar" ghost button.
- **Modalidad (enrolment type).** Shown right after the course is chosen, above the date selector, when `modalidadesParciales` is on. Label "Modalidad", then a **2×2 segmented control** (the four labels don't fit one row at 390px): **Mensual completo** · **Una clase** · **Una semana** · **Medio mes**. `Mensual completo` is the default and keeps the current behaviour unchanged. The 2×2 is the design system's `.seg` with `flex-wrap: wrap`, options at `flex: 1 1 44%`, a `border-top` on the third and fourth options and no `border-left` on the third — so it reads as a grid inside the one rounded container.
- **Modality price.** Directly under the segmented, a label/value row: the modality name 14px `neutral-700` left, its price 18px/700 right (nowrap) — the same treatment the course list already gives a price. **Each modality has its own tariff, it is not a percentage off the monthly fee.** The prototype carries them per course, e.g. for a Bs. 250 course: `Una clase` Bs. 45, `Una semana` Bs. 90, `Medio mes` Bs. 140; for a Bs. 170 course: Bs. 35 / 65 / 100. In production these are course fields, not derived.
- **En qué días las toma (half-month distribution).** Only when the modality is **Medio mes** *and* the course meets on more than one weekday — **separate pill checkboxes**, one per class weekday of the course (**Lunes**, **Miércoles**, **Viernes**), all ticked by default, in a `repeat(auto-fit, minmax(94px, 1fr))` grid with `gap: 8px` (three fit one row on desktop, wrap on a phone). Deliberately **not** the `.seg` segmented container: a multi-select of three ticked options rendered as solid accent fills inside one container reads as a single orange mass and competes with the Modalidad segmented right above it. So the ticked state is the tinted pill — `accent-200` fill, `accent-400` border, `accent-900` text at 600, plus a 15px check glyph — and unticked is `neutral-100` on `divider` with `neutral-700` text. Solid `--color-accent` stays reserved for one-of-N segmenteds. Pills are 999px radius, `padding: 11px 10px`, 15px; hover on unticked is `neutral-200`; focus is the system's 2px accent ring. **The last remaining ticked day cannot be unticked** — its handler is a no-op rather than a disabled state, so the control never looks broken. The **class total is identical whatever is ticked** (see below); what the choice changes is on which weekdays those classes are taken and therefore over how many weeks they run.
- **Distribution summary.** One line 14px `neutral-700`, 6px under the checkboxes: "6 clases · 2 días por semana · se completan en 3 semanas" — total, weekly cadence, span. Weeks are `ceil(total ÷ días tildados)`. The student pays the same `Medio mes` tariff whatever the distribution. A single-weekday course has nothing to split, so neither the control nor the summary is shown. Changing modality or course clears the choice back to all days.
- **Start dates follow the ticked days.** Under *Medio mes*, the date selector lists the next 3 classes **of the ticked weekdays only** — offering "vie 21 ago" to a student who has untick Friday would contradict the distribution. Unticking a day resets the start date to the first option.
- **Start date.** The **same** date selector serves both cases — for the partial modalities it picks the class the period starts from. Its label switches to "Desde qué clase arranca" (from "Empieza a tomar clases"), then a **segmented control** with the **next 3 class dates** for that course, computed from the course's weekday pattern (`1=Mon … 7=Sun`) scanning forward from today; the first is preselected and prefixed `hoy ` when it falls today. Format `lun 24 ago`. Footnote 14px `neutral-700`, which depends on the modality:
  - *Mensual completo:* "La primera cuota se devenga desde esta fecha. Próximo vencimiento: un mes después."
  - *partial:* "Se cobra una sola vez, por el período elegido. No genera cuota mensual."
- **Period note (partial modalities only).** A second line in the same 14px `neutral-700` style, 6px under the first, naming the class days included: "Incluye las clases de lun 24, mié 26, lun 31 ago y mié 2 sep." — or "Incluye solo la clase de lun 24 ago." when there is one. The dates are computed, not typed, and **the note lists exactly the classes the modality counts** (see below). The list joins with commas and ` y ` before the last; the month name is printed once per month run, so a choice spanning two months reads "lun 24, lun 31 ago y lun 7 sep".

### Medio mes is a fixed class count set by the course, never a calendar window
A calendar window makes the same modality worth more or less depending on how the month falls, so **half a month is always 2 weeks' worth of the course's own weekly load** — and that total does **not** move with the weekday choice:

```
clases  = 2 × cantidad(días de clase semanales DEL CURSO)   // fijo por curso
días    = los días tildados (subconjunto de los del curso; por defecto, todos)
semanas = techo(clases ÷ cantidad(días))                      // lo único que varía
```

Scan forward from the chosen start date and keep the first `clases` dates matching `días`. Worked through:

| Curso | Elección | Clases | Se consume en |
| --- | --- | --- | --- |
| Lu-Mi (2/semana) | Los dos días | **4** — lun 24, mié 26, lun 31 ago, mié 2 sep | 2 semanas |
| Lu-Mi (2/semana) | Solo lunes | **4** — lun 24, lun 31 ago, lun 7 y lun 14 sep | 4 semanas |
| Lu-Mi-Vi (3/semana) | Los tres días | **6** | 2 semanas |
| Lu-Mi-Vi (3/semana) | Lunes y miércoles | **6** | 3 semanas |
| Lu-Mi-Vi (3/semana) | Solo viernes | **6** | 6 semanas |
| solo jueves (1/semana) | (sin control) | **2** | 2 semanas |

The count is a property of the **course**, not of the distribution: picking one weekday out of a two-day course does not halve what the student gets, it stretches the same 4 classes over 4 Mondays. `Una clase` and `Una semana` keep their calendar windows (1 and 7 days), which for a weekly pattern are already one repetition or less.

Segmented control: the design system's `.seg` / `.seg-opt` on native radios, forced to `display: flex` with `flex: 1` options, 15px, `padding: 12px 8px`, centred.

## Block 3 — Cobro de la primera cuota
- Locked until a course exists: "Elegí el curso para ver la cuota."
- **Meses a pagar (advance payment).** First thing in the block, and **only when the modality is `Mensual completo`** — a segmented control **1 · 2 · 3 · Más**, default `1` (which keeps the current behaviour unchanged). `Más` reveals a small numeric field ("¿Cuántos meses?", `max-width: 130px`, 20px/600, `inputMode="numeric"`). Switching to a partial modality hides the whole control and forces 1.
- **Fee line:** 15px `neutral-700` label left, amount right in Montserrat 26px. The label carries the case:
  - `Cuota del mes` — monthly, 1 month (unchanged)
  - `3 meses × Bs. 250` — monthly, more than one month; the amount shown is the **subtotal**
  - `A cobrar · una semana` — any partial modality; the amount is that modality's own tariff
- **Automatic advance discount.** When the months count has an entry in `tablaDescuentoMeses`, a line right under the subtotal in `accent-2-800` (the positive-value voice): label "Descuento por pago adelantado (10%)" 15px, value `− Bs. 75` 17px/700 right. Below it, above a 1px `divider` top border, **Total a pagar** 15px `neutral-700` with the result in Montserrat 26px — the same treatment as the subtotal. With no applicable discount neither line is shown and the subtotal *is* the total.
- **The two discounts are independent.** The automatic one is policy: it comes from the table, needs no input, and is applied *before* the shared step sees the figure. The manual one is a decision by whoever is taking the money, lives inside the shared step, needs a motive, and applies **on top of** it.
- **The rest of the block is the shared Cobro step**, mounted with `referencia` = the total after the advance discount, `referenciaLabel` = the same fee label, `politica: "descuento"`, `direccion: "cobro"`, `medios: "Efectivo, QR / transf., Otro"`, and `cuentaId` = course + modality + months (so changing any of them resets the step). It contributes the mode segmented, the amount field, the payment means, the manual discount with its obligatory motive, and the `Cobra hoy` / `Queda pendiente` totals. No subject header here — the student is already block 1, and the price is already stated above. The screen reads the step's payload for its footer and its confirmation.

## Sticky footer
Left: a status line, 15px `neutral-700` — "Sin alumno todavía" → "Falta el curso" → "Cobra hoy", or "Queda debiendo Bs. X" in the no-charge mode. Right: the amount being charged, Montserrat 22px. Below: **"Confirmar inscripción"** primary, full width, 18px, min-height 56px, disabled until student + course are set.

## Behaviour & validation
Numbers: strip non-digits from every amount input before parsing.

```
meses      = modalidad ≠ 'mensual' ? 1
           : mesesOpt ≠ 'libre'    ? mesesOpt
           : max(1, parsed(mesesTexto))

subtotal   = modalidad = 'mensual' ? precioMensual × meses
                                   : tarifaPropia(curso, modalidad)

pct        = modalidad = 'mensual' and meses > 1
             ? (tablaDescuentoMeses[meses] or 0)
             : 0
descAuto   = round(subtotal × pct / 100)
referencia = max(0, subtotal − descAuto)        // what the shared step receives

// inside the shared step:
descManual = parsed(descMonto)                  // needs a motive
total      = max(0, referencia − descManual)
cobra      = modo 'sin' ? 0 : modo 'entero' ? total : parsed(monto)
saldo      = max(0, total − cobra)
```

Notes on the rules:
- `tarifaPropia` is a **lookup, never a computation** off the monthly price. If a course has no tariff for a modality, fall back to its monthly price rather than inventing a fraction.
- The discount table is matched on the **exact** month count — 4 months with a table of `2, 3, 6` gets no discount. Do not interpolate.
- `descAuto` rounds to whole Bolivianos (`Math.round`).
- The manual discount subtracts from the already-discounted reference, and every figure clamps at zero.
- The footer's `Cobra hoy` / `Queda pendiente` read from `total`, so both discounts are already reflected there.
- Switching the modality resets the months to 1, the half-month weekday choice, and the charge mode to "Cuota entera"; switching the course resets modality, weekday choice, months and mode. Nothing else is cleared.
- The half-month weekday choice changes **which classes are included, never the price** — the `Medio mes` tariff is the same in both distributions.

Confirm, in order, surfacing the first failure inline (15px `accent-800` on `accent-200`, radius 18px):
1. no student → "Falta elegir o cargar el alumno."
2. no course → "Falta elegir el curso."
3. charging but no payment method → "Elegí el medio de pago."
4. partial mode with amount ≤ 0 → "Escribí el monto que entrega."
5. months set to "Más" with fewer than 2 months typed → "Escribí cuántos meses paga (2 o más)."
6. manual discount > 0 without a motive → "El descuento necesita un motivo."

On success: **reset the whole form**, scroll the area back to top, and show a success banner (`accent-2-200` fill, radius 22px, `check` icon, 15px `accent-2-900` text) with a **Cerrar** ghost button:

> Inscripción de Virginia Martínez en Salsa y Bachata Inicial, empieza el lun 24 ago. Cobrado Bs. 250 (efectivo).
> …or "Sin cobro por ahora." when nothing was charged.

The banner names the case in parentheses after the course when it isn't a plain single month: `(una semana)` for a partial modality, `(3 meses adelantados, 10% de descuento)` for an advance payment.

The reset-and-stay behaviour is deliberate: the administrator often enrols several people in a row.

## State
`q`, `alumno`, `formNuevo`, `nom`, `ape`, `wa`, `dupeIgnorado`, `tutorAbierto`, `tutorNom`, `tutorWa`, `curso`, `fechaIdx`, `modalidad` (`mensual|clase|semana|medio`), `medioDia` (`null` = consecutive, or a weekday 1–7), `mesesOpt` (`1|2|3|'libre'`), `mesesTexto`, `modo` (`completa|parcial|sin`), `monto`, `medio`, `notaMedio`, `descAbierto`, `descMonto`, `descMotivo`, `aviso`, `errorMsg`.

## Configurable
| Parameter | Type | Default | Effect |
| --- | --- | --- | --- |
| `modalidadesParciales` | bool | `true` | Shows the **Modalidad** segmented in block 2. **Off = the flow is exactly the previous one**: monthly only, no modality control, no period note, and the *Meses a pagar* control is always available. |
| `tablaDescuentoMeses` | months → % table | `2:5, 3:10, 6:15` | The advance-payment discount. **Not hard-coded**: in the prototype it is an editable string of `meses:porcentaje` pairs, parsed into a map (`2 → 5%`, `3 → 10%`, `6 → 15%`); anything unparseable is ignored and any month count absent from the table simply gets no discount. In production this is a school-level setting (a small table), not a constant — expose it wherever the other school parameters live. An empty table disables the automatic discount without touching the *Meses a pagar* control. |
| `permitirSinCobro` | bool | `true` | Shows the "No cobra hoy" option. |

The manual discount is no longer a flag on this screen — it belongs to the shared Cobro step and is available wherever that step is mounted.

---

# Screen 2 — Tomar asistencia

**File:** `Tomar asistencia.dc.html` · **Responsive: phone-first, column capped at 900px** · **User:** the teacher, standing in the studio between songs, possibly in low light. **This is the one screen whose phone behaviour matters most** — the desktop layout must never cost the phone anything.

## Purpose
Mark the whole class present/absent with one tap per student and save in one tap. Legibility and speed beat density.

## Layout
1. **Header** — same logo pill; right side `Natalia · profesora`.
2. **Class selector** (`padding: 8px 16px 12px`) — a full-width button, `--color-surface`, radius 26px, padding 14px 16px: class name Montserrat 24px, date line 17px `neutral-700` (e.g. `Hoy · lun 24 ago · 19:30`), `chevron-down` 24px `--color-accent` right. Tapping opens a `neutral-100` panel (radius 22px, padding 8px) listing **only the classes assigned to the signed-in teacher** — name 17px/600 + `fecha · N alumnos` 15px `neutral-700`, with a `check` on the current one. Switching class clears any marks in progress.
3. **Counter row** — `N` Montserrat 22px + "de N marcados" 16px `neutral-700`; right: **"Todos presentes"** secondary button, min-height 44px, 15px.
4. **List** — `flex: 1; overflow: auto`. **No fixed grid of checkboxes: a plain scrolling list that takes any number of students.** From 700px up it becomes two columns (`grid-template-columns: 1fr 1fr`, filling row-wise so the alphabetical order still reads left-to-right) and rows relax to 68px; below that it is the single-column phone list, untouched.
5. **Sticky footer** — legend + counts + save.

## Student row
Full-width button, `min-height: 74px`, radius 22px, padding 12px 14px, 8px gap, `display: flex; align-items: center; gap: 12px`. Three visual states:

| State | Fill | Border | Marker | Text |
| --- | --- | --- | --- | --- |
| Unmarked | `neutral-100` | 1px `divider` | 34px empty circle, 2px `neutral-400` outline | name 19px/600; below, 15px `neutral-700` "Sin faltas este mes" / "N faltas este mes" |
| Presente | `accent-2-200` | 1px `accent-2-300` | 34px circle `accent-2-600` + `check` in `--color-bg` | name 19px/600; "Presente" 15px `accent-2-800` |
| Ausente | `accent-200` | 1px `accent-300` | 34px circle `accent-700` + `x` in `--color-bg` | name 19px/600; 15px `accent-800`: "Ausente · corre el vencimiento", or "Ausente · sin reposición" when the student has no tolerance left |

Right side of an unmarked row, stacked and right-aligned, both **nowrap**: the tolerance pill and the debt line.

**Ordering: alphabetical by last name.** Sample data stores one `nombre` string; the prototype derives the surname as "everything after the first word" and sorts with `localeCompare(…, 'es')`. In production sort on a real `apellido` field.

## Tolerance warning
`faltasToleradas` is a **configurable parameter, not a fixed number** (prototype: integer 1–4, default 2).

```
restantes = faltasToleradas − faltasDelMes
restantes <= 0  → pill "Sin tolerancia"   (tag-accent)
restantes == 1  → pill "Última tolerada"  (tag-accent)
otherwise       → no pill
```

## Interaction
- **One tap** on a row: unmarked → **presente**; tapping again → **ausente**; again → presente (it toggles between the two marked states, it does not return to unmarked).
- **"Todos presentes"** marks every student present in one tap — the common case, after which the teacher only taps the few who are missing.
- Hint under the list, 15px `neutral-700`: "Un toque marca presente. Otro toque lo pasa a ausente."

## Sticky footer
Two legend chips (14px dot + count 17px/700 + label 15px `neutral-700`): `accent-2-600` "presentes", `accent-700` "ausentes". Right: "Lista completa" or "N sin marcar". Then **"Guardar asistencia"** primary, full width, 18px, min-height 58px, disabled while nothing is marked.

On save: clear the marks and show a success banner —

> Asistencia guardada · 12 presentes y 2 ausentes. Se generó 1 reposición por falta con tolerancia.
> (…or "Sin reposiciones nuevas.")

A make-up class (`reposición`) is generated for each absent student who still had tolerance left (`faltas < faltasToleradas`). Singular/plural must be handled ("1 presente" / "2 presentes", "1 reposición" / "2 reposiciones").

## Clases de prueba — in this list, not a screen of their own
A trial class sold for this course (block C of *Precios y paquetes*: course, number of students, price per student) puts its attendees **in this same roll**, appended after the regular students. They are attendees of this session; a separate screen would leave the teacher marking the same class twice.

Two shapes, both from how the trial was sold:

| Sold as | Rows | Marked |
| --- | --- | --- |
| Generic student with a count | **one** row, "Alumno de Prueba (3)" | as a unit — one tap marks all three |
| Named students | **one row per person**, "Camila Ferreira" | individually, exactly like a regular student |

A trial row carries a `tag-outline` **Prueba** pill in all three states, and its sub-line replaces the absence history with **"Clase de prueba · Bs. 30 por alumno"** — a trial student has no monthly record, so tolerance, make-ups and debt do not apply and those slots stay empty. Marked states read "Presentes · 3 alumnos" and "Ausentes · no vinieron a la prueba".

**Counts are people, not rows.** The header, the footer chips and "N sin marcar" all sum each row's headcount, so the generic row contributes 3: a 14-student class with a 3-person trial reads **17**. The class selector shows it too — "Hoy · lun 24 ago · 19:30 · 14 alumnos + 3 pruebas".

**Commission.** Trials marked present are added to the teacher's month with the same criterion as a regular class — the money was already collected at block C's price, and it enters the settlement. The save banner states it:

> Asistencia guardada · 17 presentes y 0 ausentes. Sin reposiciones nuevas. 3 clases de prueba por Bs. 90 suman a la comisión de esta clase.

Absent trial attendees generate nothing: no make-up, no refund logic on this screen.

## State
`claseIdx`, `selectorAbierto`, `marcas` (map `studentId → 'p' | 'a'`), `aviso`.

## Configurable
`faltasToleradas` (int 1–4, default 2) · `mostrarDeuda` (bool, default true).

---

# Screen 3 — Caja y resumen

**File:** `Caja y resumen.dc.html` · **Responsive: one column on a phone, up to three on a desktop** · **User:** the administrator, checking the day's financial health and logging loose cash movements.

## Layout
No device frame — this one is a real responsive page. `max-width: 1180px`, centred, `padding: 24px 18px 60px`.

1. **Header** — logo pill (26px logo) + `Natalia · admin`.
2. **Title** — h1 `clamp(30px, 5vw, 42px)` "Caja y resumen del mes"; subtitle 16px `neutral-700` "Lunes 24 de agosto · todo se calcula desde los cobros y pagos del sistema."
3. **Hero card** — `--color-surface`, radius 32px, padding `clamp(18px, 3vw, 28px)`; `display: flex; flex-wrap: wrap; gap: 22px; align-items: flex-end`.
4. **Movement panel** (conditional) — `neutral-100`, radius 32px.
5. **Card grid** — `display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); align-items: start`. Three cards: *Por cobrar y por pagar*, *Cómo se compone la caja*, *Agosto*, then *Últimos movimientos*.

## Hero card
- Kicker: 15px, `letter-spacing: .08em`, uppercase, `accent-700` — "SALDO EN CAJA".
- **Balance:** Montserrat `clamp(44px, 9vw, 72px)`, `line-height: 1.02`.
- Two **nowrap** neutral pills (15px, padding 7px 14px): `Efectivo Bs. 224`, `QR / banco Bs. 120`. Label and amount must never be split across lines — they are one string in one nowrap chip.
- Right column (`width: min(100%, 320px)`): **"Registrar movimiento"** primary button with a `plus` icon, 18px, min-height 56px. It opens the form **inline on this page** — never a separate screen or route.

## Movement form (short: motivo, monto, glosa, medio)
`neutral-100`, radius 32px, padding `clamp(18px, 3vw, 26px)`, entrance animation. Header: "Movimiento de caja" Montserrat 24px + **Cancelar** ghost button (clears the amount and glosa).

Fields in `display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); align-items: end` — so one column on a phone, up to four on a wide screen:
1. **¿Entra o sale?** — segmented: **Ingreso** / **Egreso**. Switching resets **Motivo** to that side's default.
2. **Motivo** — a `select` styled as the pill input, **options depend on the direction**:
   - *Ingreso:* Inscripción de alumno · Cuota mensual · Venta de paquete de clases · Clase particular · Alquiler de sala · Clase de prueba · Venta de productos · Otro ingreso (no afecta deudas)
   - *Egreso:* Comisión a profesor · Otro pago a profesor · Pago de gasto fijo · Pago a proveedor · Otro egreso (no afecta deudas)
3. **¿A quién se le cobra? / ¿A quién se le paga?** — a `select`, shown whenever the chosen motive has subjects. Its label follows the direction, and each option names the subject with its outstanding amount: `Laida Salinas · debe Bs. 450`. **This is the debtor or creditor the movement settles** — a cash movement does not reduce a category in the abstract, it reduces one person's or one supplier's balance. For receivables the options are the lines still open (a settled line disappears). For the `ajuste` buckets — teachers and suppliers — **every subject stays listed even at zero**, marked "· sin saldo", because paying an up-to-date teacher is a legitimate advance; the step then reads "Saldo a pagar Bs. 0" and the note explains the movement is booked as an anticipo. The placeholder option (`Elegí el deudor` / `Elegí el acreedor`) keeps nothing selected until the administrator picks. Changing direction or motive clears the pick.
4. **Glosa (detalle)** — free text, separate from the motivo, e.g. `ej. cuota de agosto de Virginia Martínez`.
5. **The shared Cobro step**, in a `neutral-200` card below the field grid — amount, means, discount/adjustment and totals all come from it.

### The shared step does the collecting
Once a subject is chosen, the money side of the form **is the shared Cobro step** — the same component screen 1 uses, called with this operation's parameters. That is what puts the creditor's name and the amount being settled on screen: mounting it with `sujeto` = the chosen line, `referencia` = that line's outstanding balance, `referenciaLabel` = "Saldo pendiente" or "Saldo a pagar", `direccion` = cobro/pago, and `politica` = the operation's own policy (below). Paying Nuñez Oscar's commission and charging Laida's fee therefore look and behave alike, and neither can be done without seeing what is owed.

With no subject — the "Otro" motives — the step collapses to amount + means, which is all a loose cash movement needs.

### Same policy as the operation it settles
A cash movement follows **the discount/adjustment policy of its operation type** — the one already defined on the corresponding spreadsheet — so taking money here is not a lighter act than taking it on the operation's own screen. Which controls appear depends on the motive's bucket, and they only appear once a subject is chosen:

| Buckets | Policy | Controls |
| --- | --- | --- |
| `cuotas`, `particulares`, `alquiler`, `pruebas`, `productos` | `politica: "descuento"`, as in PAGOS / PAGOSPARTICULARES / VENTASPROD | "Aplicar un descuento" with amount + obligatory motive — literally the same control screen 1 shows, because it is the same component. |
| `profesores`, `proveedores` | `politica: "ajuste"`, as in PAGOSPROF / PAGOSPROV | "Registrar un ajuste" with amount + obligatory motive; full or partial payment is the step's own `Pago total` / `Pago a cuenta` mode, not a separate dropdown. |
| `gastos` | `politica: "simple"` — COSTOS FIJOS records no discount | Mode, amount and means only. |
| no bucket ("Otro…") | none | Amount and means only. |

**A discount settles balance just like cash**, matching the spreadsheet, where a balance is `devengado − pagado − descuentos`:

```
pendiente(línea) = max(0, base − Σ (monto + descuento) de sus movimientos)
```

So Bs. 200 collected with Bs. 50 of discount closes a Bs. 250 balance, and the movement records both the discount and its motive. Validation adds: a discount with no motive → "El descuento necesita un motivo."; an `Ajuste extraordinario` with no motive → "El ajuste extraordinario necesita un motivo."

Below the fields, a live line in 15px `accent-700` naming the exact effect on that subject's balance, recomputed as the amount is typed:
> "Salinas Laida · Salsa y Bachata Inicial: Bs. 250 pendiente → queda Bs. 0 (saldo cerrado), con Bs. 50 de descuento."
> "Elegí el sujeto para descontar su saldo de cuotas de alumnos." — motive picked, subject not yet
> "No hay saldos abiertos en clases de prueba: el movimiento solo entra a la caja." — nothing left to settle under that motive
> "Este motivo no descuenta ninguna deuda: solo mueve la caja." — the two "Otro" motives

Validation, in order: amount ≤ 0 → "Escribí el monto del movimiento."; empty glosa → "Poné una glosa corta, para saber después de qué fue."; a motive with open balances and no subject → "Elegí a quién se le cobra." / "Elegí a quién se le paga." (error style as screen 1). On success the panel closes, the form resets to `Ingreso / Cuota mensual / sin sujeto / Efectivo`, the movement appears first in *Últimos movimientos*, every figure recomputes, and a banner reports the effect on that subject:
> "Ingreso de Bs. 200 + Bs. 50 de descuento (promo 2 cursos) · Cuota mensual · Salinas Laida · Salsa y Bachata Inicial · Efectivo. Salinas Laida · Salsa y Bachata Inicial: saldo cerrado."
> …or "Laida Salinas: saldo cerrado." when it settles, or "No afecta ninguna deuda." for an "Otro" motive.

## Motive → receivable/payable mapping (the important rule)
Every motive maps to a **bucket** of outstanding debt, or to `null` for the two "Otro" motives. **A movement whose motive corresponds to a sale of a service or product reduces the matching receivable; a payment reduces the matching payable.** The "Otro" motives move cash only and touch no debt.

Sample data in the prototype is the school's **real August 2026 spreadsheet**: nine open student balances totalling Bs. 2.000 (the dashboard's *Saldo Pendiente*), one open private-lesson package (Bs. 180), and the month's fixed costs as open payables (Bs. 4.765 — the *Total mensual equivalente*). Commissions, suppliers, trial classes and product sales are settled, so those buckets legitimately render as "sin saldos abiertos". Cash-side figures likewise: Bs. 1.360 collected from students, 500 from packages, 60 from trials, 4 from products, Bs. 520 paid to teachers, and no fixed costs paid yet.

| Bucket | Label | Fed by |
| --- | --- | --- |
| `cuotas` | Cuotas de alumnos | Inscripción, Cuota mensual |
| `particulares` | Paquetes y clases particulares | Venta de paquete, Clase particular |
| `alquiler` | Alquiler de sala | Alquiler de sala |
| `pruebas` | Clases de prueba | Clase de prueba |
| `productos` | Ventas de productos | Venta de productos |
| `profesores` | Comisiones a profesores | Comisión a profesor, Otro pago a profesor |
| `gastos` | Gastos fijos del mes | Pago de gasto fijo |
| `proveedores` | Proveedores | Pago a proveedor |

Each bucket is **not a single number — it is a list of open lines, one per subject** (**per enrolment** for cuotas — a student enrolled in two courses has two independent balances, so the subject reads "Salinas Laida · Bachata Conexión"; per package for particulares, per teacher for comisiones, per cost line for gastos fijos, per supplier for proveedores). A movement carries the id of the line it settles:

```
pendiente(línea)  = max(0, base − Σ montos de movimientos con ese itemId)   // oldest movement first
pendiente(bucket) = Σ pendiente(línea) de sus líneas
```

Clamping at zero matters: an overpayment must not turn into a negative balance. A movement with no subject (the "Otro" motives, or a motive whose lines are all settled) moves cash only and leaves every balance untouched.

## Card — Por cobrar y por pagar
Heading Montserrat 21px + 14px `neutral-700` "Cada cobro o pago que registrás descuenta de estas deudas." Then:
- **Por cobrar** total, Montserrat 26px `accent-2-800`, with one row per receivable bucket: 15px label, a 13px `neutral-700` detail line under it, and the amount 16px/700 right (nowrap), 1px `divider` under each. The detail names the single open subject when only one is left ("Bebidas del Sur"), otherwise counts them ("7 por cobrar"), or reads "sin saldos abiertos" when the bucket is settled.
- A **progress bar** — 12px tall, radius 999px, `neutral-300` track, `accent-2-600` fill — plus "N% cobrado de lo facturado del mes".
- **Por pagar** total, Montserrat 26px `accent-800`, with its three rows in the same treatment ("3 por pagar").

## Card — Cómo se compone la caja
Shows how the balance is derived, one signed row each (label 16px + detail 14px `neutral-700` + amount 18px/700), then **Saldo** in Montserrat 26px:
- **Cobros a alumnos** — "cuotas, particulares, pruebas y productos" — positive
- **Pagos a profesores** — "comisiones liquidadas" — negative
- **Costos fijos pagados** — "luz, agua, internet, sueldos" — negative
- **Movimientos manuales** — "N cargados a mano" — signed net

Signed amounts use `+ Bs. 1.924` / `− Bs. 520` (U+2212 minus, not a hyphen); a zero carries no sign.

## Card — Agosto
"Agosto" Montserrat 21px + 14px `neutral-700` "Ingresos y egresos del mes en curso". **Ingresos** figure Montserrat 32px `accent-2-800` over a 14px bar (`accent-2-600` on `neutral-300`); **Egresos** the same in `accent-800` / `accent-600`. Both bars are scaled against `max(ingresos, egresos)`. Then **Resultado** (signed, Montserrat 26px) above a `divider`, with a 14px note: "El mes cierra en positivo hasta hoy." / "Los egresos del mes superan lo cobrado hasta hoy."

## Card — Últimos movimientos
Rows on `neutral-100`, radius 20px, padding 12px 14px, newest first: concepto (glosa) 16px/600, then **motivo · sujeto** 14px `accent-700` (the subject is appended when there is one, e.g. "Cuota mensual · Laida Salinas"), then `fecha · medio` 14px `neutral-700`, extended with the policy record when there is one — `· desc. Bs. 50 (promo 2 cursos)` or `· Pago a cuenta (julio pendiente)`; signed amount right, 18px/700, `accent-2-800` for income and `accent-800` for expense.

## Derivation of the balance
```
ingresos = cobros del sistema (cuotas + particulares + pruebas + productos)
         + Σ movimientos manuales de tipo ingreso
egresos  = pagos a profesores + costos fijos pagados
         + Σ movimientos manuales de tipo egreso
saldo    = ingresos − egresos
banco    = Σ movimientos manuales por QR/banco (signed)
efectivo = saldo − banco
```
Cash and margin do not agree, by design: the balance counts only money that moved, while the school's monthly margin accrues the Bs. 4.765 of fixed costs whether or not they were paid. Those accrued costs surface under *Por pagar*, which is where the administrator sees what is still owed.

The efectivo/banco split is a prototype simplification (system-side collections are assumed cash). In production, split by the payment method actually recorded on each collection and payment.

## State
`movimientos[]` (each: `tipo`, `motivo`, `itemId`, `sujeto`, `monto`, `concepto`, `medio`, `fecha`), `panel`, `tipo`, `motivo`, `itemId`, `concepto`, `cobro` (the shared step's last payload), `errorMsg`, `aviso`.

## Configurable
`mostrarComposicion` (bool, default true) — shows the "Cómo se compone la caja" card.

---

# Screen 4 — Login

**File:** `Login.dc.html` · **Responsive: 360px phone to desktop, card capped at 420px** · **Users:** Natalia on the desktop computer and the teachers on their phones, so it has to read equally well at both ends.

## Purpose
Get into the app. Nothing else. **No sign-up and no password recovery** — out of scope by explicit decision; a teacher who is locked out asks the administration to reset the password (the error panel says so after N attempts).

## Layout
One centred column — no app shell, no sticky footer, no device frame; it is a plain page.

- **Page:** `min-height: 100dvh`, `display: grid; place-items: center`, `padding: clamp(24px, 7vw, 56px) 18px`, ground `--color-bg`. The card is vertically centred at every height, so on a desktop browser it sits in the middle of the window and on a phone it sits just under the notch.
- **Column:** `width: 100%; max-width: 420px`, `display: flex; flex-direction: column; gap: 18px`.
1. **Logo**, centred: cream pill (`--tropi-chip`, radius 999px, padding 9px 20px) with the logo image **34px tall** — larger than the 22–24px header pill of the other screens, because here it is the only branding on the page.
2. **Card:** `--color-surface`, radius **32px**, padding `clamp(20px, 5vw, 28px)`, `gap: 16px` — the outer-card radius of screen 3's movement form, not the 26px of the blocks in screen 1.
3. **Prototype hint** under the card, 14px `neutral-700`, centred (see *Configurable*).

## Card content — signed out
- **Title** h1, `--font-heading`, `clamp(26px, 6vw, 30px)`, `line-height: 1.15` — "Iniciar sesión".
- **Subtitle** 15px `neutral-700`, 6px under it — "Entrá con el correo de la escuela."
- **Correo** — label 14px, 6px gap; `.input`, pill, `neutral-100` fill, 17px, `min-height: 52px`, `type="email"`, `inputMode="email"`, `autoComplete="username"`, `spellCheck="false"`, placeholder `ej. natalia@tropicana.bo`.
- **Contraseña** — same field treatment, `autoComplete="current-password"`, placeholder "Tu contraseña", plus `padding-right: 54px` to clear the toggle.
  - **Show/hide toggle:** a 44×44 transparent round button, absolutely positioned `right: 5px; top: 50%; transform: translateY(-50%)` inside a `position: relative` wrapper. Icon 22px, Lucide `eye` / `eye-off`, `stroke: var(--color-accent)`, stroke-width 2.75. It swaps the input's `type` between `password` and `text`, and its `aria-label` between "Mostrar la contraseña" and "Ocultar la contraseña". **44px is the floor** — the toggle is the smallest tap target on the screen.
- **Primary action** — `.btn.btn-primary.btn-block`, 18px, `min-height: 58px`, label "Iniciar sesión". While the check is running the label becomes **"Entrando…"** and the button is `disabled` (the design system drops it to 45% opacity).
- **Enter submits** from either field.

## Card content — signed in
Replaces the whole form (it does not sit above it):
- Success banner, identical to the other screens' banner: `accent-2-200` fill, radius 22px, padding 14px 16px, 22px `check` icon in `accent-2-800`, text 16px `accent-2-900` — "Sesión iniciada · Natalia Salek · admin."
- **"Salir"** secondary button, full width, `neutral-100` fill, 16px, `min-height: 50px`.

In production this state does not exist: a successful login navigates to the app. It is here so the prototype can show the outcome and be reset during review.

## Two error treatments

This screen deliberately uses **both** of the product's existing error patterns, for two different kinds of failure:

| Failure | Treatment | Copy |
| --- | --- | --- |
| **Wrong credentials** (the server said no) | The `accent-100` **panel** — radius 20px, padding 14px, a 22px `alert-circle` icon in `accent-800`, heading 14px/600 `accent-800`, body 15px `accent-900`. **The same treatment as the duplicate-WhatsApp panel in screen 1.** | Heading "Correo o contraseña incorrectos" / body "Volvé a escribir la contraseña." |
| **Missing or malformed input** (we can tell without asking the server) | The `accent-200` **inline strip** — radius 18px, padding 12px 14px, 15px `accent-800`, no icon. The same strip screens 1 and 3 use for validation. | "Escribí tu correo." / "Ese correo está incompleto. Revisalo." / "Escribí tu contraseña." |

The panel sits **above the fields**, between subtitle and form, because it refers to both of them. The strip sits **below the fields, above the button**, next to the action it blocks. Both animate in with the product's single entrance (`opacity 0 → 1`, `translateY(6px) → 0`, 200–250ms ease-out).

**After `intentosParaAviso` failed attempts** the panel grows a third line, 14px `neutral-700`: "Van 3 intentos. Pedile a la administración que te reinicie la contraseña." This line is the only compensation for having no password-recovery flow — if recovery is ever built, it replaces this line.

## Behaviour & validation
Validation runs in order and shows the **first** failure only:
1. empty email → strip "Escribí tu correo."
2. email failing `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` → strip "Ese correo está incompleto. Revisalo."
3. empty password → strip "Escribí tu contraseña."
4. otherwise → the credential check runs.

Rules:
- The email is **trimmed and lower-cased** before comparing. The password is not touched.
- Typing in either field clears the strip immediately; the credentials panel stays until the next attempt (it is a fact about the last attempt, not about the current input).
- On failure: **the password field is cleared and the email is kept** — the error is almost always in the password. The attempt counter increments.
- On success: the counter resets to zero.
- The check is asynchronous (700ms in the prototype) so the "Entrando…" state is real. Double-clicking the button cannot fire it twice.
- No lockout, no captcha, no "remember me". If the school needs a lockout, it is a backend rule and it should surface in this same panel.

**Sample credentials** (prototype only, replaced by real authentication): `natalia@tropicana.bo` (Natalia Salek, admin) and `carla@tropicana.bo` (Carla Méndez, profesora), both with the password `tropicana`. The role in the session determines which screen the app lands on — admin to *Caja y resumen* or *Inscribir y cobrar*, profesora to *Tomar asistencia*. **That routing is not part of this screen** and is not prototyped.

## State
`email`, `clave`, `verClave`, `cargando`, `errorCred` (bool), `errorMsg` (string or null), `intentos`, `sesion` (null or the user).

## Configurable
| Parameter | Type | Default | Effect |
| --- | --- | --- | --- |
| `mostrarClaveDemo` | bool | `true` | Shows the hint line under the card with the sample credentials. **Review scaffolding — off in anything resembling production.** |
| `intentosParaAviso` | int 0–5 | `3` | Failed attempts before the panel adds the "pedile a la administración" line. `0` disables the line. |

## What the backend has to supply
- Authentication by **email + password**, returning the user's `nombre` and `rol` (`admin` | `profesora`) — the role decides the landing screen.
- One generic failure response for wrong email and wrong password alike. **Do not distinguish** "that email does not exist" from "wrong password" in the copy.

---

# Screen 5 — App Shell

**File:** `App Shell.dc.html` · **Responsive: one breakpoint at 900px** · **Users:** the three administration profiles (admin, gerente, asistente) mostly on a desktop, the teacher on her phone.

## Purpose
The frame every other screen is mounted inside: how you get from one screen to another, who is logged in, and how you log out. **It carries no content of its own.** Until now each screen drew its own header (logo + "Natalia · admin"); that header belongs here.

## Two shapes, one system
The role decides the navigation shape, not the device:

| Role | Destinations | Desktop (≥900px) | Phone (<900px) |
| --- | --- | --- | --- |
| admin · gerente · asistente | 7 groups, 19 destinations | persistent 264px sidebar | top bar + hamburger drawer |
| profesora | 2 destinations | two pill tabs in the top bar | **bottom tab bar** |

**Why a bottom bar for the teacher:** two destinations do not justify a menu, and she navigates one-handed, mid-class, phone in the same hand. The bar puts both destinations under the thumb with no opening gesture. On a desktop the same two destinations become pill tabs in the top bar — a bottom bar on a 1440px window would be absurd.

## Breakpoint
**900px**, evaluated in JS (`window.innerWidth`, re-measured on `resize`) rather than in CSS, because the collapse is structural: the sidebar and the drawer are the **same element** moved between two positions (`.aside-fija` / `.aside-drawer`), so the navigation list exists once, not twice. These two utility classes are the only styling in this design that is not inline.

## Admin — desktop
Row, full height.

**Sidebar** — `width: 264px`, `flex: none`, `height: 100dvh`, `position: sticky; top: 0`, `--color-surface`, 1px `divider` right border. Three stacked regions:
1. **Logo**, `padding: 16px 14px 10px` — the cream pill (`--tropi-chip`, radius 999px, padding 5px 13px) with the logo 24px tall. Same pill as the old per-screen header.
2. **Nav**, `flex: 1; overflow: auto`, `padding: 4px 10px 10px`, `gap: 3px`.
3. **User**, `padding: 10px 12px 14px`, 1px `divider` top border: a `neutral-100` card (radius 20px, padding 10px 12px) with a 36px `accent-200` circle holding the initials (Montserrat 15px, `accent-900`), the name 15px/600 and the role 13px `neutral-700`; under it **"Cerrar sesión"**, centred, 14px, which links to `Login.dc.html`.

**Content** — `flex: 1`, `height: 100dvh`, its own `overflow: auto`, `padding: clamp(16px, 3vw, 32px)`, inner column capped at 1180px. **No top bar on desktop:** the group name renders as a 14px `neutral-700` breadcrumb and the destination as the h1, both of which belong to the mounted screen.

## Admin — phone
Column, full height.

- **Top bar** — `padding: 8px 12px`, `--color-surface`, 1px `divider` bottom border: a 44×44 hamburger (Lucide `menu`, 24px, `stroke: var(--color-accent)`), the logo pill (logo 22px), and the 36px initials circle pushed right. No page title — the screen owns it.
- **Drawer** — `position: fixed`, full height, `width: min(300px, 86vw)`, `z-index: 20`, `border-radius: 0 28px 28px 0` (round on the edge that faces the content, square against the screen edge), same three regions as the sidebar with a 44×44 `x` button next to the logo. Enters with `translateX(-14px)` + opacity, 200ms ease-out.
- **Backdrop** — `position: fixed; inset: 0`, `rgba(12, 10, 9, .62)`, `z-index: 10`, fades in over 200ms, closes the drawer on tap.
- Choosing any destination **closes the drawer**.

## The navigation tree
Seven groups, each with an icon (Lucide, 20px, stroke-width 2.75) and its sub-items. **Caja y Finanzas uses `coins`, not `wallet`:** at 20px a wallet is the same rounded rectangle as the `credit-card` of the group above it, and in a sidebar whose only per-group differentiator is the glyph, two identical rectangles are worse than a less literal metaphor. The same swap applies to the teacher's second tab. The three built screens carry a **7px `accent-2-600` dot** — "this one is designed" (see `marcarListas`).

| Group | Icon | Sub-items |
| --- | --- | --- |
| Alumnos | `users` | Buscar alumno · Alta de alumno · Perfil del alumno |
| Inscripciones y Cobros | `credit-card` | **Inscribir y cobrar** ● · **Vender servicio** ● · Cobros del día · Deudas por alumno |
| Profesores | `graduation-cap` | **Profesores y cursos** ● · **Tomar asistencia** ● · **Confirmar sesión** ● · Liquidaciones |
| Caja y Finanzas | `coins` | **Caja y resumen** ● · Movimientos · Por cobrar y por pagar |
| Inventario | `package` | Productos · Stock y ventas |
| Administración | `sliders` | Cursos y tarifas · **Precios y paquetes** ● · Parámetros de la escuela · Usuarios y roles |
| Reportes | `bar-chart` | Resumen mensual · Ingresos por curso |

**The sub-items are a proposal, not a settled map** — the seven groups came from the brief, the 19 destinations inside them did not. Confirm or correct them before anyone builds the routes.

**Accordion: one group open at a time.** Opening a group closes the previous one, so all seven headers stay visible without scrolling on a desktop. Clicking a header only expands or collapses — it never navigates; navigation is always a sub-item.

## States
| Element | Inactive | Hover | Active |
| --- | --- | --- | --- |
| Group header | text `neutral-800` 16px/600, icon `neutral-600`, transparent | fill `neutral-100` | *contains* the active item: text `accent-800` 16px/**700**, icon `--color-accent`. No fill — the fill belongs to the item. |
| Sub-item | text `neutral-700` 15px, transparent | fill `neutral-100` | fill `accent-200`, text `accent-900` 15px/**700** |
| Tab (profesora) | text `neutral-700`, icon `neutral-600` | fill `neutral-100` | fill `accent-200` pill, text `accent-900` 13px/700, icon `accent-800` |

Group header `min-height: 48px`, radius 18px, padding 9px 12px. Sub-item `min-height: 44px`, radius 16px, `padding: 8px 12px 8px 42px` — the 42px left indent aligns the label with the group label above it (12 padding + 20 icon + 10 gap). Chevron 18px, `chevron-down` closed / `chevron-up` open. Focus is the product's `:focus-visible` accent ring.

Only the active item is filled, so at a glance there is exactly one terracotta shape in the sidebar. That is the page indicator.

## Profesora
- **Top bar** — `padding: 12px 16px`: logo pill, then "Carla Méndez · profesora" 13px `neutral-700` and **Salir** (13px link to `Login.dc.html`) pushed right.
- **Bottom tab bar (phone)** — `padding: 8px 12px 14px`, `--color-surface`, 1px `divider` top border. Two tabs, `flex: 1`, `min-height: 62px`, radius 999px, icon 24px over a 13px label, `gap: 3px`: **Mis clases** (`calendar`) and **Mi liquidación** (`coins`). Labels are shortened on the phone; the h1 above carries the full destination name.
- **Pill tabs (desktop)** — the two destinations as `min-height: 46px` pills, radius 999px, padding 8px 18px, 16px, `flex: none` and nowrap, in a row under the top bar with the full labels.
- The phone layout keeps the app-shell pattern of screens 1–2: `100dvh` column on a `neutral-300` ground, capped at 900px, content scrolling between the fixed top bar and the tab bar.

## How a screen mounts inside the shell
The shell owns the frame; the screen owns its content. Concretely, for the three existing screens:

1. **Delete the per-screen header** — the row with the logo pill and "Natalia · admin" at the top of `Inscribir y cobrar`, `Tomar asistencia` and `Caja y resumen`. The shell provides it: logo in the sidebar/top bar, user in the sidebar/drawer.
2. **Keep the screen's own title block** (h1 + subtitle) — it is content, and on desktop it sits under the shell's breadcrumb.
3. **Keep each screen's sticky footer.** The primary action belongs to the screen, not to the shell; it sticks to the bottom of the content region, not of the window.
4. **The screen's scroll area becomes the content region's scroll area** — the shell scrolls the content, never the sidebar and the content together.
5. **Logging out is the shell's job**, not a control any screen draws.

In the prototype the content region holds a placeholder card naming the destination, plus a link to the `.dc.html` of the screens that already exist. That card **is** the mount point.

## State
`activo` (destination id), `abierto` (expanded group id, or null), `drawer` (bool), `tab` (`clases|liquidacion`), `ancho` (measured window width).

## Configurable
| Parameter | Type | Default | Effect |
| --- | --- | --- | --- |
| `rol` | enum `admin` | `gerente` | `asistente` | `profesora` | `admin` | Chooses the navigation shape and the user in the chip. The three administration profiles share the same tree today — **pending decision** on what each one may see. |
| `forzarMovil` | bool | `false` | Forces the phone structure on a wide window, to review the drawer and the tab bar without resizing. |
| `marcarListas` | bool | `true` | Shows the `accent-2-600` dot on destinations that already have a designed screen. Review aid — off in production. |

## What the backend has to supply
- The logged-in user's `nombre` and `rol`, from the login response.
- Which destinations the role may see, once that policy is decided.

---

# Screen 6 — Precios y paquetes

**File:** `Precios y paquetes.dc.html` · **Responsive: one column on a phone, tables scroll horizontally; content capped at 1180px** · **User:** the gerente, at a desktop. Reached from the shell at **Administración → Precios y paquetes**.

## Purpose
Every price the school charges is loaded here. The governing rule for the whole screen: **if a value is not in one of these five tables, the system cannot charge it.** The screen is a settings surface, not a transactional one: it has no sticky total and no confirm-and-reset; it has a save/discard bar.

## Structure — five tabs, one screen, not five destinations
The five blocks are **tabs inside a single screen**, not five sidebar sub-items. Reason: block D (particulares) resolves its room cost out of block E (alquiler de sala), and blocks A and C are both per-course tables the gerente compares side by side. Five separate destinations would turn one editing session into five navigations and hide the dependency. The sidebar therefore gains exactly **one** item under *Administración*.

Tab bar: the design system's `.seg` on native radios, `flex-wrap: wrap`, options `flex: 1 1 auto`, 15px, `padding: 12px 14px`. Labels: **Inscripción parcial · Meses adelantados · Clase de prueba · Clases particulares · Alquiler de sala**. Solid `--color-accent` marks the active tab (one-of-N, so the solid fill is correct here).

## Page frame
`min-height: 100vh` on `--color-bg`, content `max-width: 1180px`, `padding: 26px 22px 90px` (the bottom padding clears the fixed action bar). Kicker "Administración" 14px `neutral-600`; h1 Montserrat 800 38px; lead 14px `neutral-700` capped at 70ch.

Each block sits in a `.pp-card`: `--color-surface`, radius 26px, padding 20px 22px. Block heading Montserrat 800 24px, then a 14px `neutral-700` explanation capped at ~72ch.

## The table pattern (shared by all five)
```
.pp-tbl        border-collapse: separate; border-spacing: 0; width: 100%
th             13px/600, neutral-600, uppercase, letter-spacing .02em, padding 0 10px 8px
td             15px, padding 9px 10px, border-top 1px solid var(--color-divider)
th/td.num      text-align: right
tr.off td      opacity: .5              (deactivated row)
first column   min-width: 210px          (course/package names must not wrap to 3 lines)
last column    min-width: 156px          (action + reason)
```
- **Editable cells are real inputs, always visible** — no click-to-edit, no pencil affordance. The gerente edits a whole column in one pass; a hidden edit mode would double the clicks. `.pp-num`: 104px wide, min-height 42px, 16px, right-aligned, `neutral-100` fill. `.pp-txt`: same but left-aligned and auto-width, for names and `<select>`s.
- **Every numeric input strips non-digits on change** (`replace(/[^0-9]/g, '')`); an emptied field stores `null`, not `0` — the difference between "free" and "not loaded" is the whole point of block A.
- Wide tables get `overflow-x: auto` on their wrapper, not a shrunken font.

## CRUD — the same rule in all five tables
A row can be **deleted for real only if no operation has used it**. Once it has been sold at that price, the row stays and the history keeps its price.

| Uses | Uso column | Action button | Reason line (12px `neutral-700`, next to the button) |
| --- | --- | --- | --- |
| 0 | "Sin uso" | **Eliminar** | — |
| ≥1, active | "14 operaciones" | **Desactivar** | "No se puede eliminar: ya se vendió a este precio." |
| ≥1, inactive | "14 operaciones" | **Activar** | "Inactiva: no se ofrece en ventas nuevas." |

The reason is **always visible next to the disabled option**, never a tooltip or a toast after a failed click — the gerente has to know why before reaching for the button. Deactivated rows render at `opacity: .5` and are excluded from new sales; nothing already sold changes. Rows are added with **Agregar tramo / Agregar paquete / Agregar paquete de horas** (secondary button under the table), which appends an empty row ready to type into. In blocks A and C, where the row is a course and courses are not created here, "Eliminar" clears the row's tariffs instead of removing the course.

## Fixed action bar
`position: fixed; left/right/bottom: 0`, `--color-surface`, 1px `divider` top border, padding 12px 22px, inner content capped at 1180px. Left: a 15px `neutral-700` state line — "Sin cambios pendientes." / "3 cambios sin guardar." (singular/plural). Right: **Descartar** ghost + **Guardar cambios** primary. After saving, the state line reads "Guardado. Los precios nuevos rigen desde ahora; lo ya vendido conserva el precio de su venta." — the versioning promise stated where the action happens.

## Block A — Inscripción parcial por curso
One row per course. Columns: **Curso** (name 15px/600 + `Línea · Días y hora` 13px `neutral-600`) · **Mensual** (read-only, `neutral-700` — context for judging the partial prices) · **Una clase** · **Una semana** · **Medio mes** · **Estado** · action.

**A missing tariff is marked, not hidden.** An empty cell gets `.pp-num.falta`: `accent-100` fill and `accent-400` border, with a `—` placeholder. Any row with at least one empty modality also shows the tag **"Cae al mensual"** (`.tag-accent`) in *Estado*; a complete row shows a quiet 14px `neutral-600` "Completa". That is the actual runtime behaviour, stated in the table: a course with no tariff for the chosen modality charges the full monthly fee.

Sample data carries seven courses; *Heels* has all three empty and *Salsa Intensivo* has tariffs but no trial price, so both marked states are visible in the prototype.

## Block B — Descuento por meses adelantados
The existing `tablaDescuentoMeses`: editable **Meses → %Descuento** pairs, one table for the whole school, with add and delete. Card capped at 560px — two number columns need no more. Lookup rule, unchanged: **the largest tier that does not exceed the months paid**. Prototype tiers: 2→5%, 3→8%, 6→12%, 12→18%.

## Block C — Clase de prueba por curso
One row per course, **price per student**, card capped at 700px. Explicitly per course, not one school-wide value: "una prueba de Heels no vale lo que una de Zumba". Empty cells use the same `.falta` marking as block A.

## Block D — Paquetes de clases particulares
Catalogue by dance style. Columns: **Paquete** (free text, e.g. "1 hora", "Paquete 4 horas") · **Estilo** (`<select>` over the style list) · **Horas** · **Precio al alumno** · Uso · action.

Two things the copy states outright, because both are easy to get wrong in implementation:
- **The price is the package's, not per person.** The same hours cost the same whether one student or a couple takes them. There is no per-student multiplier anywhere in this block.
- **The room cost is not a field here.** It is not loaded per package; it is looked up in block E. The sentence links to the E tab.

## Block E — Tarifas de alquiler de sala
The central table, and the one the other blocks read.

### E.0 — The single-source-of-truth panel
Above everything else in the tab, an `accent-2-200` panel (radius 22px, padding 16px 18px, 22px `layers` icon in `accent-2-800`, text 15px/1.55 `accent-2-900`) states the reuse rule: the table is consulted from both sides — a third party renting directly, and a particular being sold — and in the second case the system does not ask for a room cost, it looks it up by *categoría × tamaño × horas* and deducts it in the teacher's monthly settlement. Changing a price here changes both. This panel is not decoration: it is the reason the table is not duplicated inside block D.

### E.1 — Group sizes are parameters
A row of three cards (`neutral-100`, 1px `divider`, radius 18px, min-width 180px): **Individual**, **Pareja**, **Grupo**, each with an editable "Hasta ⟦n⟧ personas". Defaults 1 / 2 / 16. The maximum is data, not a constant — the column headers in E.2 read from it ("Pareja · hasta 2"), so raising Grupo to 20 relabels the matrix.

### E.2 — The matrix
Three dimensions, resolved as **one switch plus one grid**: the four buyer categories are a segmented control (`.seg`, solid accent on the active one), and the grid below is **hour packages down × group sizes across**. Under the segmented, a 14px `neutral-700` line explains the selected category — the *Profesor Activo* note names the settlement use and states that it pays less than an external teacher for the same size and package.

Rows are the hour packages, with the hour count itself editable (`74px` input + "hora/horas" label). Cells are prices. Prototype values, Bs., rows 1 / 2 / 4 / 8 h:

| Categoría | Individual | Pareja | Grupo |
| --- | --- | --- | --- |
| Alumno | 40 · 75 · 140 · 260 | 55 · 105 · 195 · 360 | 90 · 170 · 320 · 600 |
| Profesor Activo | 30 · 55 · 100 · 190 | 40 · 75 · 140 · 260 | 70 · 130 · 240 · 450 |
| Profesor Externo | 50 · 95 · 180 · 340 | 65 · 125 · 235 · 440 | 110 · 210 · 400 · 750 |
| Tercero | 60 · 115 · 215 · 400 | 80 · 150 · 285 · 530 | 130 · 250 · 475 · 890 |

Storage shape: `precios[categoria][tamaño][paqueteDeHoras]`. The hour packages are E's own rows, **not** a foreign key to block D — D's packages may use hours E has no row for, and that has to be visible rather than silently defaulted (see E.3). Adding an hour package adds a row across all four categories.

### E.3 — The lookup, shown live
A card at the bottom of the tab, **Cómo lo resuelve una particular**: pick a sold package, the assigned teacher's category (Activo / Externo) and how many students took it; the panel prints the resolved coordinates and the amount.
```
tamaño = el primer tamaño cuyo máximo alcanza a los alumnos   (1 → Individual, 2 → Pareja, 5 → Grupo)
costo  = precios[categoría][tamaño][horas del paquete vendido]
```
Result panel (`neutral-100`, 1px `divider`, radius 20px): route line 13px `neutral-700` — "Alquiler de sala → Profesor Activo × Pareja (hasta 2) × 4 h" — then the label and the amount in Montserrat 800 28px `accent-2-800`, then a 14px note stating both sides of the transaction: "El alumno paga Bs. 440 por el paquete (2 alumnos, mismo precio). Al profesor se le descuenta Bs. 140 de sala."

**The miss is a designed state, not an error.** If E has no row for the package's hours, or that cell is empty, the amount shows `—` in `accent-700` and the note reads "Falta el paquete de N horas en esta tabla, o el precio de esa celda está vacío. Sin tarifa, la particular no se puede liquidar." Production must refuse to settle rather than assume a value.

## State
`tab` (`a|b|c|d|e`), `cat` (active category in E), `cursos` (A + C), `desc` (B), `paquetes` (D), `tamanos` / `horas` / `precios` (E), `off` (map `bloque:filaId → true` for deactivated rows), `cambios` (unsaved count), `guardado` (confirmation string or null), and the three simulator fields `simPaquete` / `simCat` / `simAlumnos`.

## Configurable
| Parameter | Type | Default | Effect |
| --- | --- | --- | --- |
| `moneda` | text | `Bs.` | Currency prefix on every displayed amount. |
| `mostrarSimulador` | bool | `true` | Shows the E.3 lookup card. Off for a print-out of the tables alone. |

## What the backend has to supply
- **Per-course tariffs** for the three partial modalities and the trial class, each nullable — `null` means "not loaded" and must fall back to the monthly fee (partial) or block the sale (trial), never to `0`.
- **The advance-payment discount tiers** as data, with the "largest tier not exceeding the months paid" lookup server-side.
- **Private-lesson packages**: name, style, hours, price. Price is per package.
- **The room-rate matrix** keyed `categoría × tamaño × horas`, plus the editable person-maximum per size. It is the single source of the room cost for **both** direct rentals and the room deduction on a teacher's settlement — one table, two readers.
- **A usage count per row** (how many operations reference it), which is what decides deletable vs. deactivatable. Deactivating must not alter historical operations: every sale keeps the price it was sold at, so prices need effective-dating or a price snapshot on each operation.

---

# Screen 7 — Vender servicio

**File:** `Vender servicio.dc.html` · **450×940 mobile-first, capped at 680px** · **User:** the administración desk. Reached from the shell at **Inscripciones y Cobros → Vender servicio**.

## Purpose
The two services that are not a monthly enrolment: a **private lesson** package and a **room rental**. One screen, because both are "pick a buyer, pick a package, take the money", and both price out of the same two tables in *Precios y paquetes*.

Structure is the same three progressive blocks as *Inscribir y cobrar* — numbered accent circles, `--color-surface` cards at radius 26px, later blocks showing a one-line reason while they wait ("Elegí primero el alumno y el profesor."), a sticky footer with the running amount and the confirm button.

## Block 1 — Tipo y comprador
A two-option `.seg` at the top: **Clase particular** / **Alquiler de sala**. Switching it clears the whole form — the two paths share no fields worth keeping, and a half-carried buyer is worse than retyping.

### Clase particular
1. **Alumno titular** — the same searcher as *Inscribir y cobrar*: one field over name or WhatsApp, results from 2 characters, up to 4 rows, each showing the WhatsApp and a `Debe Bs. N` tag when the student owes. Picking one collapses the search into a summary card with **Cambiar**.
2. **+ Agregar acompañante** — a ghost button under the titular, with the rule stated beneath it: *"Opcional. Con acompañante el paquete pasa a tamaño Pareja; el precio del paquete no cambia por persona."* It opens a second, visually nested searcher (`neutral-100` card, own **Quitar**). The companion is never required.
3. **Profesor que dicta** — a list, not a `<select>`: each row is the name, what they teach, and a tag with the category they enter table E with (**Profesor Activo** in `tag-accent-2`, **Profesor Externo** in `tag-neutral`). The selected row takes an `accent-2-200` fill and `accent-2-400` border. The category is on screen because it is what sets the room cost two blocks down.

### Alquiler de sala
1. **Categoría del comprador** — a 2×2 wrapped `.seg`: **Alumno · Profesor Activo · Profesor Externo · Tercero**, with the selected category's explanation in 14px `neutral-700` below it (the *Profesor Activo* note states it pays less than an external for the same size and package).
2. Then, by category: **Alumno** searches the student roll; **Profesor Activo / Externo** searches the teacher roll **filtered to that category** (searching "Mariela" under *Profesor Activo* correctly finds nothing); **Tercero** replaces the searcher with a free **Nombre del comprador** field and the note *"Un tercero no entra al padrón: queda como nombre en el movimiento de caja."*

### Alta de alumno nuevo — one form, two targets
Both student searchers offer **Alumno nuevo**. There is **one** alta form, rendered once, whose heading says who it is for ("Alumno nuevo" / "Alumno nuevo · acompañante"). Nombre, Apellido, WhatsApp, and the **same duplicate panel** as *Inscribir y cobrar*: typing a WhatsApp already on file shows an `accent-100` panel — "Ese WhatsApp ya está cargado", the existing name, its current debt, and **Usar este alumno** / **Es otra persona**. Saving is blocked while an unresolved duplicate is on screen.

The minor/tutor composite key and the tutor-is-a-student link are **not** repeated here: full alta lives in *Inscribir y cobrar*, and this screen only needs enough to sell a package to someone who walked in. If a minor with a tutor turns up here, the desk should enrol them there first. **Confirm this is acceptable** — the alternative is lifting the whole alta into a shared block.

## Block 2 — Paquete
A list of rows, price on the right, exactly like the course list in *Inscribir y cobrar*: **the price is visible before choosing**, never behind the selection.

- **Clase particular** reads block D. Each row: package name, `Estilo · N horas`, price. Above the list, the size is shown as a **read-only** line — "Tamaño · Pareja · titular y acompañante". It is not asked again; it is derived from whether a companion was added, which is the whole reason the companion is in block 1.
- **Alquiler de sala** reads block E. Because a rental's group size is not derivable from anything in block 1, it *is* asked here: a three-option `.seg` **Individual · 1 / Pareja · 2 / Grupo · 16** (labels carry the person maximum from block E.1), and under it the hour packages priced at `precios[categoría][tamaño][horas]`. A cell with no price shows **"Sin tarifa"** instead of a number.

Picking a package collapses the list into a summary card with **Cambiar** and the price in Montserrat 800 26px. If the resolved price is 0 the screen says "Sin tarifa cargada" and block 3 stays shut.

## Block 3 — Cobro
The shared `Cobro.dc.html`, mounted with `referencia` = the package price, `referencia-label` = "Precio del paquete", `politica="descuento"`. `permitirSinCobro` defaults to **false** here (unlike enrolment): a service is not delivered on credit by default.

### The room-cost line — the effect made visible before the money moves
For a private lesson, under the payment step, an `accent-2-200` panel with the `layers` icon:

> **Costo de sala para Oscar Nuñez: Bs. 140, se descuenta de su liquidación mensual.**
> Alquiler de sala → Profesor Activo × Pareja × 4 h

The second line is the resolved coordinates, so the desk can check the lookup rather than trust it. This is a **read of block E, not a field**: nothing on this screen sets the room cost.

```
categoría = la del profesor elegido        (pact | pext)
tamaño    = acompañante ? 'par' : 'ind'
horas     = las horas del paquete vendido
costo     = precios[categoría][tamaño][horas]
```

**Miss state.** If table E has no row for those hours, or that cell is empty, the panel turns `accent-100` with a warning icon: the sale can still be charged, but the teacher's room package is created **without a price** and cannot be settled until the tariff is loaded. Production must not substitute 0.

## What confirming does
The screen shows a green confirmation naming every record it created, because two of the three are invisible:

> Venta registrada · Paquete 4 horas para Virginia Martínez. Se creó el paquete de 4 horas del alumno. Se creó el paquete de sala de Oscar Nuñez por las mismas 4 horas a Bs. 140, que se descuenta de su liquidación del mes.

For a rental it is the single movement: package, buyer, size, amount charged.

## Validations
| Rule | Message |
| --- | --- |
| Buyer identified | "Elegí el alumno titular." / "Identificá al comprador." |
| Teacher chosen (particular only) | "Elegí el profesor que dicta." |
| Package chosen | "Elegí el paquete." |
| Package has a price | "Ese paquete no tiene precio cargado en Precios y paquetes." |
| Payment step valid | "Completá el cobro: monto, medio y motivo del descuento si hay." |
The blocking reason sits in the footer beside the amount at all times, so the disabled confirm button always has its reason on screen. The full sentence also appears in an `accent-200` strip if the button is pressed anyway.

## Configurable
| Parameter | Type | Default | Effect |
| --- | --- | --- | --- |
| `permitirSinCobro` | bool | `false` | Adds the "No cobra hoy" option to the payment step. Off by default for services. |

## What the backend has to supply
- **Student roll** (search over name and WhatsApp) and **teacher roll** with each teacher's **table-E category** (`pact` / `pext`) — the category is data on the teacher, not a choice at sale time.
- **Block D packages** filtered to what is sellable, and **block E** as the room-rate matrix plus the per-size person maximums.
- On confirm, one transaction creating: the **student's hour package**, the **teacher's room package** for the same hours with the price resolved from E (nullable, blocking settlement if absent), and the **cash movement**. The resolved room price must be **stored on the package**, not re-read later — a later tariff edit must not change what was already sold.

---

# Screen 8 — Confirmar sesión

**File:** `Confirmar sesión.dc.html` · **450×940, capped at 520px, sticky action bar** · **User:** whoever is at the studio — the teacher on a phone or the desk.

## Purpose
The attendance equivalent for a private-lesson package. *Tomar asistencia* marks a roll of students one by one; here **the session is the unit**: it happened or it did not, and a couple is one unit, not two marks. So the screen has exactly one button.

## Layout
1. **Package selector** — the same collapsing header button as *Tomar asistencia*: kicker "Clase particular", the package and style in Montserrat 23-28px, and a sub-line "Virginia Martínez y Rolando Salvatierra · 3 horas restantes". Tapping it opens a `neutral-100` list of the open packages, each showing students, teacher and hours left, with a check on the current one.
2. **Package card** — students (titular 22px/700, companion 19px/600 in `neutral-800` right under it, no separate label — they are one unit), teacher and their category in 15px `neutral-700`, and a `tag-accent-2` **Pareja** / **Individual** on the right. Below, two `neutral-100` stat tiles: **Horas restantes** ("3 de 4 horas", the number in Montserrat 30px) and **Sesiones dictadas**.
3. **Duración de esta sesión** — a `.seg` of **0,5 horas / 1 hora / 2 horas**, filtered to what the package can still cover (a package with 0,5 h left offers only 0,5). Default 1 hour. Under it, the rule in plain words: *"Un solo botón para la pareja: la sesión se dicta o no se dicta, no se marca presente a cada uno."*
4. **Preview of the three effects**, above the fold, before pressing anything:
```
Descuenta del paquete del alumno              1 hora
Descuenta del paquete de sala de Oscar Nuñez  1 hora · Bs. 35
Acredita comisión a Oscar Nuñez               Bs. 66
```
5. **Sesión dictada** — one primary button, 60px, in a sticky bar with the consequence under it: "Al confirmar quedan 2 horas en el paquete."

## After confirming
An `accent-2-200` panel: the headline ("Sesión de 1 hora registrada. Quedan 2 horas en el paquete.") over the same three lines as the preview, now as a receipt with the new remainder. The stat tiles update in place. When the package hits zero the duration card is replaced by an `accent-100` **Paquete agotado** card pointing at *Vender servicio* for a new one — the button is not left enabled to fail.

## Arithmetic
```
horas restantes = total − usadas
sala            = salaHora × horas de la sesión     // salaHora guardado en la venta
comisión        = (precio del paquete ÷ total de horas) × horas × comisiónPct
```
The room price per hour is **read from the package, not from table E** at this moment: the venta already resolved and stored it, so a tariff edited afterwards cannot rewrite a session already dictated. Sample: a Bs. 440 / 4 h package at 60% credits Bs. 66 for a one-hour session and deducts Bs. 35 of room.

## What the backend has to supply
- **Open packages** with: students, teacher, style, total hours, hours used, sessions dictated, package price, **stored room price per hour**, and commission percentage.
- On confirm, one transaction: decrement the student package, decrement the teacher's room package by the same hours, and post the session's commission to that teacher's month. Half-hour granularity — hours are not integers.
- The commission percentage is per teacher (or per contract), not global: the sample carries 60% and 55%.

---

# Screen 9 — Profesores y asignaciones

**Files:** `Profesores.dc.html` (the screen) + `Profesor.dc.html` (the shared entity component) · **One column at every width; content capped at 1180px** · **User:** the gerente or the asistente, at a desktop. Reached from the shell at **Profesores → Profesores y cursos**.

## Purpose
The roster of teachers, and the percentages each one earns per course. Two things carry weight beyond data entry: the **type** (Activo / Externo) sets the room tariff that teacher pays, and the **percentages of an assignment freeze the moment it is confirmed**.

Two tabs, one screen (`.seg`, solid accent on the active one): **Listado** and **Asignación a curso**. Same reason as *Precios y paquetes*: the assignment reads the roster, and a teacher is often created and assigned in the same sitting.

## `Profesor.dc.html` — the shared entity component
Search, create, edit and retire a teacher, in **one component mounted identically everywhere a teacher participates** — the same contract as the shared `Cobro` step. It is a fragment, not a page: the host supplies the card. Improve the flow here once and every screen changes.

**Props**
| Prop | Type | What it does |
| --- | --- | --- |
| `padron` | `Profesor[]` | The roll to search. Data lives in the host, never in the component. |
| `usuarios` | `Cuenta[]` | Login accounts, for the optional link. |
| `valor` | `Profesor \| null` | Set it to open that teacher's ficha; `null` returns to search. |
| `especialidades` | text | Comma list of dance styles offered as chips. |
| `permitirBaja` | bool | Shows the delete/deactivate block in edit mode. |
| `abrirAlElegir` | bool | `true`: picking a result opens the ficha. `false`: it only selects — what a picker context wants. |
| `onSelect` / `onGuardar` / `onBaja` / `onCancelar` | callbacks | `onBaja` receives `{id, accion: 'eliminar' \| 'desactivar', dependencias}`. |

**Two states.** *Buscar*: one field over name or WhatsApp (results from 2 characters, max 5, each row name + `WhatsApp · especialidades` + a type tag), "Ningún profesor con ese dato" when empty, and **Profesor nuevo** below. *Ficha*: the form, headed by the teacher's name or "Profesor nuevo", with **Cancelar** top-right.

**The form.** Nombre and Apellido in **separate fields** side by side; WhatsApp; especialidades; tipo; account link; retire block; save.

- **Especialidades** use the design system's new `.chips` — a multi-select of pills on native checkboxes, each with the `.chip-tick` glyph. Under them, a live line: "Dicta Salsa, Bachata." or, while empty, "Al menos una: es lo que filtra los cursos y paquetes que se le pueden asignar."
- **Tipo** is a two-option `.seg` — **Activo** / **Externo** — with an `accent-2-200` panel under it (`layers` icon) spelling out the consequence, because the consequence is the whole point of the field: Activo pays the *Profesor Activo* room tariff, the lowest in the table; Externo pays the *Profesor Externo* one, higher for the same size and package. The panel names *Precios y paquetes → Alquiler de sala* so the reader can go check it.
- **Duplicate WhatsApp** gets the same `accent-100` panel as every other entity in the product: "Ese WhatsApp ya es de un profesor", the existing name and type, then **Editar ese profesor** / **Es otra persona**. Saving is blocked while it is unresolved.

## The optional login account
A `neutral-100` block headed **Cuenta de acceso** with the word **Opcional** right under it — the optionality is stated, not implied by an empty field.

- **Linked:** a 34px `accent-2-600` avatar circle with a `user` glyph, the account name and email, **Desvincular** top-right, and the reason it matters: "Con cuenta, el profesor toma su propia asistencia y ve su liquidación."
- **Not linked:** a sentence and a **Vincular una cuenta** button. The sentence adapts to the type — for an Externo it reads "Un externo que solo alquila la sala normalmente no necesita una", which is the common case rather than an omission.
- **Choosing:** a list of accounts **not already linked to another teacher** — the relation is one-to-one, enforced by the list rather than by an error. With none free: "No hay cuentas sin vincular. El vínculo es uno a uno: creá la cuenta en Administración → Usuarios y roles." The escape is **Dejar sin cuenta**, phrased as a decision, not a cancel.

## Delete or deactivate — the product-wide rule
In edit mode, one block whose colour, title, reason and button all come from whether the teacher has dependent history (`asignado a curso`, `comisiones devengadas`, `liquidaciones emitidas`, `paquetes de sala`):

| History | Block | Title | Button | Reason |
| --- | --- | --- | --- | --- |
| None | `neutral-100` | "Eliminar profesor" | **Eliminar** | "Sin historial dependiente: se elimina de verdad, no queda registro." |
| Any | `accent-100` | "No se puede eliminar" | **Desactivar** | "Tiene historial dependiente. Desactivarlo lo saca de las asignaciones nuevas y conserva todo lo ya registrado." |

With history, the dependencies are listed as `tag-neutral` pills — the reason is **specific**, not a generic refusal. The reason sits beside the button in both cases; it is never a tooltip or a message after a failed click.

## Tab 1 — Listado
**One column, not two.** The shared component sits on top in a card capped at **560px** — narrow, flush left, with air to its right, which is the design system's own direction — and the roster runs the full 1180px below it. A side-by-side layout was tried and dropped: the roster's declared column minimums total ~895px, so beside a 420px panel it never fits inside the page's 1180px, and the first things clipped were the action buttons and the `.cell-reason` line — the two cells the listing exists for. At full width the table needs no horizontal scroll at all.

Note for anyone reusing `.pr-card` in a grid: grid items default to `min-width: auto`, so a card holding a wide table blows out its own track and the inner `overflow-x: auto` never engages. `.pr-card` carries `min-width: 0` for that reason.

**The roster** is the design system's new `.table.table-edit`: Profesor (name 600 + WhatsApp 13px `neutral-600`) · Especialidades · Tipo (`tag-accent-2` Activo / `tag-neutral` Externo) · Cuenta (email or "Sin cuenta") · Historial · actions. Actions are **Editar** and **Eliminar / Desactivar / Activar**, with the `.cell-reason` line under them. A deactivated teacher's row takes `tr.is-off` (50% opacity) and its action flips to **Activar**.

Dependency labels are **short in the cell** ("cursos · comisiones · liquidaciones") and **long in the ficha** ("asignado a curso · comisiones devengadas · …"): in a narrow column the long form breaks to one word per line.

**Editar** loads that teacher into the shared component on the right; the panel heading switches from "Buscar o cargar" to "Editar profesor". Every save, delete or deactivate produces an `accent-2-200` banner naming what happened — including *why* for a deactivation: "…No aparece para asignaciones nuevas; su historial queda intacto."

## Tab 2 — Asignación a curso
Three progressive blocks, numbered accent circles, same grammar as *Inscribir y cobrar*.

**1 · Curso.** A list of courses, each with its current titular as a tag — `tag-neutral` with the name, or `tag-accent` **"Sin titular"**. Choosing collapses to a summary with **Cambiar** and adds the course's style.

**2 · Profesor titular.** The eligible teachers only:
```
activos (no desactivados) ∧ tipo === 'activo' ∧ (sin especialidad ∨ especialidad ∋ estilo del curso)
```
An **Externo is filtered out of the list, not offered and then rejected** — a course titular has to be Activo, and the note says so: "Solo profesores Activos con especialidad en Salsa. Un externo no puede ser titular — solo alquila la sala — y un profesor desactivado no aparece acá." The selected row takes the `accent-2-200` fill used for selection throughout the product.

**3 · Comisiones de esta asignación.** Two number fields, deliberately large (110px wide, 22px/700, right-aligned, with a 24px `%` beside each) because they are the two numbers the whole screen exists for:

| Field | Meaning as stated on screen |
| --- | --- |
| **% sobre los ingresos del curso** | "De todo lo que el curso cobre: cuotas, modalidades parciales y clases de prueba." |
| **% por alumno referido** | "Adicional, sobre lo que pague cada alumno que este profesor trajo." |

### Making the freeze visible
An `accent-100` panel with a **padlock** icon — the one place in the product that uses it — sits between the fields and the confirm button, in reading order, so it cannot be passed without being seen:

> **Al confirmar, estos dos porcentajes quedan fijos para esta asignación.**
> Toda liquidación futura de este curso usa el valor congelado hoy, no el que esté vigente ese mes. Para cobrar otro porcentaje hay que cerrar esta asignación y crear una nueva — el histórico de lo ya devengado no cambia.

**Replacing a titular** adds a second `accent-200` warning naming the outgoing assignment with its own frozen numbers and date: "Este curso ya tiene titular: Oscar Nuñez, con 40% y 8% desde 3 feb 2026. Confirmar cierra esa asignación; lo ya devengado con esos porcentajes no se recalcula."

The footer of the block carries the running summary ("Natalia Salek · Salsa Intensivo · 45% + 10% referido") beside **Confirmar asignación**, disabled until the assignment is valid. Confirming shows the banner and states the freeze again as fact: "…Esos dos números quedaron fijos para esta asignación."

### Asignaciones vigentes
A `.table.table-edit` below: Curso · Titular · % ingresos · % referido · Fijado (the date) · action. The percentages are **rendered as text, not inputs** — the one table in the product that deliberately does *not* use editable cells, because these values are frozen by design. The lead says it: "Los porcentajes de cada fila son los que se congelaron al confirmarla. No se editan: se cierra la asignación y se crea otra." The action follows the same rule as everything else: **Eliminar** with "Sin comisiones devengadas todavía", or **Cerrar** with "Ya devengó comisiones: se cierra, no se elimina."

## Validations
| Rule | Message |
| --- | --- |
| Nombre and Apellido | "Nombre y apellido son obligatorios." |
| WhatsApp present | "El WhatsApp identifica al profesor: cargalo." |
| Duplicate resolved | "Resolvé el WhatsApp repetido antes de guardar." |
| At least one especialidad | "Elegí al menos una especialidad." |
| Titular is Activo | "El titular de un curso tiene que ser un profesor Activo. Un externo solo alquila la sala." (defensive — the list already excludes them) |
| % ingresos 1–100 | "El % sobre los ingresos del curso tiene que estar entre 1 y 100." |
| % referido 0–100 | "El % por alumno referido tiene que estar entre 0 y 100." |

Percentage inputs strip non-digits and cap at 3 characters.

## Configurable
| Parameter | Type | Default | Effect |
| --- | --- | --- | --- |
| `especialidades` | text | `Salsa,Bachata,Zumba,Urbano,Heels` | The style chips offered in the ficha, and what filters eligible titulares. |

## What the backend has to supply
- **Teacher roll:** nombre, apellido, WhatsApp (the identifier), especialidades, tipo (`activo` \| `externo`), `usuarioId` (nullable, unique — one-to-one), `activo` flag.
- **A dependency summary per teacher** — which of `cursos` / `comisiones` / `liquidaciones` / `sala` exist. It is what decides deletable vs. deactivatable, and it is shown, so it must be specific rather than a boolean.
- **Login accounts** with their `profesorId` (nullable), so the link list can exclude accounts already taken.
- **Assignments as immutable rows:** `cursoId`, `profesorId`, `pctIngresos`, `pctReferido`, `desde`, `hasta` (null while current). **Settlements must read the percentages off the assignment that covered the period, never off the teacher or the current assignment.** Confirming a new titular closes the previous row with `hasta`; it never updates it in place.
- Whether an assignment has accrued commission, which decides delete vs. close.

---

# Additions to the Organic design system

Two patterns were composed locally, needed twice, and have now been **lifted into the design system** at `_ds/organic-186d334f-848b-405d-95ba-b805f2b70bf6/styles.css`, each with its own reference page. Screen 9 takes both from the system rather than recomposing them.

> **Upstream note.** These were written into the design system copy bound to this project. They still have to be merged into the design-system source project itself (`styles.css`, `readme.md` component table, and the two new pages under `components/`) so other projects inherit them.

## `.table-edit` — editable table cells (`components/table-edit.html`)
The pattern first composed in *Precios y paquetes*: a settings table whose cells are live inputs.

```html
<table class="table table-edit">
  <tr class="is-off">                       <!-- kept for history, withdrawn from new use -->
    <td class="num"><input class="input cell-input is-num is-empty" placeholder="—"></td>
    <td>
      <button class="btn btn-ghost">Desactivar</button>
      <div class="cell-reason">No se puede eliminar: ya se vendió a este precio.</div>
    </td>
  </tr>
</table>
```
| Class | What it carries |
| --- | --- |
| `.table-edit` | Keeps `.table`'s type; swaps the bottom rule for a top rule per row, drops the row hover (the **cell** is the target, not the row), and right-aligns `.num`. |
| `.cell-input` | `.input` sized for a cell: 42px min-height, 16px, `neutral-100` fill. **Always live** — no click-to-edit, no pencil: a settings table is edited a column at a time. |
| `.is-num` | 104px wide, right-aligned. |
| `.is-empty` | `accent-100` fill on an `accent-400` border: the value is **not loaded**, which is not zero. |
| `tr.is-off` | 50% opacity — a row kept for its history but withdrawn from new use. |
| `.cell-reason` | 12px, 22ch, beside the action: why an action is unavailable. Never a tooltip. |

**Pending migration:** *Precios y paquetes* still carries the original local classes (`.pp-tbl`, `.pp-num`, `.pp-txt`, `.falta`, `.off`). The mapping is one-to-one — `.pp-tbl` → `table table-edit`, `.pp-num` → `input cell-input is-num`, `.pp-txt` → `input cell-input`, `.falta` → `is-empty`, `.off` → `is-off` — with only the per-table column widths staying local. Left for a separate pass rather than bundled into this one, so the change is reviewable on its own.

## `.chips` — a multi-select of pills (`components/chips.html`)
First composed for the half-month weekday split in *Inscribir y cobrar*, now used for especialidades.

```html
<div class="chips">
  <label class="chip">
    <input type="checkbox">
    <svg class="chip-tick" …>…</svg>
    <span>Salsa</span>
  </label>
</div>
```
**Why it is not `.seg`.** `.seg` is one-of-N and fills the active option with solid `--color-accent`; several ticked options rendered that way read as a single mass and fight any segmented above them. So a ticked chip is the tinted pill (`accent-200` on `accent-400`, `accent-900` text at 600) and **solid accent stays reserved for one-of-N**. Chips size to their label and wrap; they are not forced to equal widths. `.chip-tick` is optional and appears only when ticked.

---

# Directriz para Etapa 1 — componentes de entidad compartidos y CRUD con eliminación guardada

Esto **no es un pedido de diseño**: es la regla de construcción a entregar a Code cuando arranque la Etapa 1. Aplica a las pantallas que Code construya directo (Alumnos, Cursos, Costos Fijos, Proveedores, Productos y las que sigan) igual que a las diseñadas acá.

## 1 · Un componente compartido por entidad
Para cada entidad — alumno, profesor, curso, costo fijo, proveedor, producto, y cualquier otra — **la creación, la búsqueda y la edición viven en un único componente compartido**, reutilizado idéntico en todas las pantallas donde esa entidad participa. Mismo contrato que el paso `Cobro` y que `Profesor`:

- El componente **no tiene los datos**: el padrón entra por prop desde la pantalla que lo monta, y el componente avisa hacia afuera (`onSelect`, `onGuardar`, `onBaja`, `onCancelar`).
- La pantalla aporta la superficie (la card, el título, el layout); el componente aporta el flujo.
- Cualquier mejora al flujo de una entidad se hace **en ese único componente**. La coherencia entre pantallas queda garantizada por construcción, no por revisión.

Los dos que ya existen y sirven de molde: `Cobro.dc.html` (la decisión de cuánta plata se mueve) y `Profesor.dc.html` (buscar / alta / edición / baja de un profesor).

## 2 · CRUD completo, con eliminación real cuando corresponde
Toda entidad soporta **crear, editar y eliminar** — no solo desactivar. La regla de eliminación es la misma para todas:

```
sin registros dependientes  → se elimina de verdad
con historial               → no se elimina: se desactiva, conservando el historial
```
Cuenta como historial cualquier registro dependiente: pagos, inscripciones, asistencias, liquidaciones, movimientos de caja, ventas, asignaciones, paquetes.

Y en los dos casos, **la interfaz explica por qué**, con el motivo al lado de la acción — no en un tooltip, no como aviso después de un clic fallido, y nombrando los dependientes concretos en vez de un "no se puede" genérico. Una fila desactivada se muestra atenuada y su acción pasa a **Activar**. El patrón visual ya está resuelto: `tr.is-off` + `.cell-reason` del sistema (ver arriba), y el bloque de baja de `Profesor.dc.html` como referencia de la versión en ficha.

## 3 · Caso específico: el componente de Alumno
El componente compartido de alumno tiene que incluir, en un solo lugar, todo lo que hoy está resuelto en *Inscribir y cobrar*:

1. **Búsqueda con detección de duplicados por WhatsApp** — panel `accent-100` con la persona existente, su deuda y sus cursos, y las dos salidas **Usar este alumno** / **Es otra persona**.
2. **Bloque de tutor revelado si la persona es menor de edad**, con el umbral como **parámetro configurable**, no un número fijo en el código.
3. **Identificador compuesto para menores**: WhatsApp del tutor + nombre (sin apellido) del menor. Dos hermanos con el mismo tutor conviven; cargar dos veces al mismo menor se detecta.
4. **El tutor puede ser un alumno ya existente**: si su WhatsApp pertenece a un alumno registrado, ofrecer **vincular a esa persona** en vez de crear un registro nuevo — el mismo panel de "ya existe", aplicado también a la carga de tutor.

Las reglas y la copy exacta de los cuatro puntos están en la sección de *Inscribir y cobrar* de este README. Al extraerlas al componente compartido, esa pantalla pasa a montarlo en vez de tener su propia copia — y *Vender servicio*, que hoy trae solo el duplicado por WhatsApp, hereda los cuatro sin recomponer nada.

---

# Interactions & behaviour — common rules

- **The shell owns navigation; screens own content.** Since screen 5 exists, no screen draws its own logo, user chip or log-out. Everything below is about what happens *inside* the content region.
- **Everything happens in place.** No navigation between steps, no modal routes: blocks unlock as data is filled, panels open inline, and success is reported by a banner on the same screen.
- **Progressive disclosure over disabled fields:** a locked block shows a short instruction ("Elegí primero el alumno."), not greyed-out controls.
- **One primary action per screen**, in a sticky footer on the phone screens, always full-width and ≥56px tall.
- **Errors are inline and specific**, placed next to the action that will be blocked; they clear as soon as the offending field changes.
- **Success banners are dismissible** and never block the next entry.
- **Focus:** `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px }` — never the browser default.
- **Hover/pressed** come from the accent ramp (one step past base). On the dark ground use `accent-400` for pressed states.
- **Responsive:** every screen works from 360px to a desktop browser. Screens 1–2 are app shells — a `100dvh` flex column with an internal scroll area and a sticky footer, centred and capped in width, so the action stays reachable at any height; screen 3 is a normal page whose multi-column areas use `auto-fit` + `minmax`. Type that carries the screen (page titles, the cash balance) scales with `clamp()`; everything else keeps its phone size, since the phone is the harder case.
- **Currency, dates, pluralisation and all copy are Spanish (Bolivia)** — dates render as `lun 24 ago`, weekday abbreviations `dom lun mar mié jue vie sáb`.

# Data the screens need from the backend

- **Students:** id, nombre, apellido, whatsapp (unique), deuda actual, enrolled course names, optional tutor (name + whatsapp).
- **Courses:** id, nombre, línea/nivel, weekday pattern, hora, profesor, precio mensual, **plus one own tariff per partial modality** (una clase, una semana, medio mes). The prototype carries seven, including one three-day course (*Salsa Intensivo*, Lu-Mi-Vi, Bs. 330) so the half-month distribution can be exercised at 3, 2 and 1 days a week.
- **Classes:** id, course, teacher (for the teacher's own class list), datetime, enrolled students with monthly absence counts.
- **Enrolment + payment:** student, course, **modality**, **half-month distribution (the set of ticked weekdays)**, start date, **months paid in advance**, subtotal, **automatic advance discount (% and amount)**, optional manual discount + motive, total, amount charged, payment method, resulting balance. A partial modality is a one-off charge and generates no monthly due; an advance payment covers N monthly dues from the start date.
- **Attendance:** class, per-student present/absent, generated make-up classes.
- **Cash:** system-side collections and payments by category, **outstanding receivables/payables as open lines per subject** (student, teacher, bill, supplier) grouped into buckets, manual movements (tipo, motivo, **subject/line settled**, monto, **descuento + motivo** or **tipo de movimiento + motivo** per the operation's policy, glosa, medio, fecha).
- **Parameters:** `faltasToleradas`, `tablaDescuentoMeses`, plus the feature flags listed per screen.

# Assets
- `assets/tropicana-logo.png` — the school's logo (1051×655, brown wordmark + orange sun on white). Supplied by the user. On the dark ground it sits on a cream pill (`--tropi-chip`, radius 999px) — do **not** rely on `mix-blend-mode`. Prefer a transparent-background master (SVG or PNG) if the school has one.
- **Icons:** Lucide, stroke-width 2.75. No custom icons.
- **Fonts:** Montserrat (600/700/800) and Figtree (400/600/700).
- No photography is used.

# Screenshots

`screenshots/` holds reference captures of the running prototypes, in the dark theme with the final typography. They are cropped to the preview pane, so a phone screen is shown in two or three overlapping captures rather than one tall image. **Filenames follow `<screen>-<step>-<state>.png`:**

| File | State it documents |
| --- | --- |
| `1-inscribir-01-inicio.png` | Screen 1, empty: header, title, block 1 with the search field and "Alumno nuevo", block 2 locked |
| `1-inscribir-02-busqueda.png` | Search for "vir" → one result row with the `Debe Bs. 200` pill |
| `1-inscribir-03-alumno-elegido.png` | Student selected: name, WhatsApp, "Cambiar", and the *Deuda anterior* / *Ya inscripto en* tiles |
| `1-inscribir-04-curso-y-fechas.png` | Course selected with the three next-class dates, and the sticky footer showing `Cobra hoy · Bs. 250` |
| `2-asistencia-01-sin-marcar.png` | Screen 2, nothing marked: class selector, `0 de 14 marcados`, rows sorted by surname with the tolerance pills |
| `2-asistencia-02-todos-presentes.png` | After "Todos presentes": every row in the sage present state |
| `2-asistencia-03-con-ausentes.png` | Mixed: two present, two absent (terracotta), one of them "sin reposición" |
| `3-caja-01-saldo.png` | Screen 3 on a desktop width: hero balance, the two medium pills, the primary action, and the first two cards |
| `3-caja-02-movimiento.png` | The inline movement form open, with motivo, glosa, medio and the live "Descuenta de…" line |
| `3-caja-03-deudas-y-composicion.png` | *Por cobrar y por pagar* with the collection progress bar, next to *Cómo se compone la caja* |
| `3-caja-04-mes-y-movimientos.png` | *Agosto* with the two bars and the result, next to *Últimos movimientos* |
| `4-login-01-inicio.png` | Screen 4, empty: logo pill, title, both fields, primary action |
| `4-login-02-error-credenciales.png` | After a wrong password: the `accent-100` panel above the fields, email kept, password cleared |
| `4-login-03-clave-visible.png` | Password revealed — `eye-off` icon on the toggle |
| `4-login-04-sesion.png` | Signed in: the success banner replaces the form, with "Salir" |
| `1-inscribir-05-menor-clave-compuesta.png` | The minor duplicate panel: "Ese menor ya está cargado", with the key that matched |
| `1-inscribir-06-tutor-es-alumno.png` | The tutor's WhatsApp belongs to a student — offer to link |
| `1-inscribir-07-tutor-vinculado.png` | Linked: the `accent-2` confirmation with **Desvincular**, and "Guardar alumno" enabled |
| `1-inscribir-08-medio-mes.png` | *Medio mes*, "Todos los días · 2 semanas", period note listing the four classes |
*Pendiente:* una captura del reparto por casillas en un curso de tres días (Lu-Mi-Vi con Viernes destildado). El comportamiento está descrito arriba y verificado en el prototipo.
| `9-profesores-01-padron.png` | El padrón: tipo, cuenta, historial y el motivo al lado de cada acción |
| `9-profesores-02-ficha-tipo.png` | La ficha: especialidades como chips y el tipo con su consecuencia de tarifa |
| `9-profesores-03-ficha-cuenta-y-baja.png` | El vínculo opcional con una cuenta, y el bloque de eliminar/desactivar |
| `9-profesores-04-titulares.png` | Titulares elegibles: solo Activos con la especialidad del curso |
| `9-profesores-05-comisiones-fijas.png` | Los dos porcentajes y el panel con candado que dice que se congelan |
| `9-profesores-06-asignaciones-vigentes.png` | Asignaciones vigentes con sus porcentajes congelados y su fecha |
| `7-vender-01-titular.png` | Vender servicio: tipo, y el buscador del alumno titular |
| `7-vender-02-acompanante.png` | El buscador de acompañante, anidado bajo el titular |
| `7-vender-03-pareja.png` | Titular y acompañante cargados |
| `7-vender-04-paquetes-particular.png` | Bloque 2: paquetes de particular, con el tamaño ya resuelto |
| `7-vender-05-cobro-y-sala.png` | Bloque 3: cobro y la línea de costo de sala con sus coordenadas |
| `7-vender-06-alquiler-categorias.png` | Alquiler: las cuatro categorías de comprador |
| `7-vender-07-alquiler-paquetes.png` | Alquiler: tamaño de grupo y paquetes de horas priceados desde E |
| `8-sesion-01-paquete.png` | Confirmar sesión: paquete, horas restantes, duración |
| `8-sesion-02-confirmada.png` | Sesión confirmada: los tres efectos como recibo |
| `8-sesion-03-agotado.png` | El paquete llegando a cero |
| `2-asistencia-05-prueba-en-lista.png` | La fila "Alumno de Prueba (3)" al final del mismo roll |
| `2-asistencia-06-prueba-ausente.png` | La prueba marcada ausente como unidad; contadores en personas |
| `2-asistencia-07-guardado-con-prueba.png` | Banner de guardado con la comisión de las pruebas |
| `6-precios-01-inscripcion-parcial.png` | Block A: per-course tariffs, *Heels* marked "Cae al mensual" |
| `6-precios-02-meses-adelantados.png` | Block B: the advance-discount tiers, with **Desactivar** and its reason |
| `6-precios-03-clase-de-prueba.png` | Block C: trial price per course |
| `6-precios-04-particulares.png` | Block D: package catalogue, "el precio es del paquete, no por persona" |
| `6-precios-05-sala-fuente-unica.png` | Block E top: the single-source-of-truth panel and the group-size parameters |
| `6-precios-06-sala-matriz.png` | Block E: the matrix for *Profesor Activo*, hours × group size |
| `6-precios-07-sala-simulador.png` | Block E.3: the live lookup a private lesson performs |
| `5-shell-01-admin-escritorio.png` | Shell, admin on desktop: 264px sidebar, active item filled, user chip |
| `5-shell-02-admin-grupo-abierto.png` | Another group expanded — accordion, one open at a time |
| `5-shell-03-admin-celular.png` | Admin on a phone: top bar with hamburger, logo and initials |
| `5-shell-04-admin-drawer.png` | The drawer open over the backdrop |
| `5-shell-05-profesora-celular.png` | Profesora on a phone: two-tab bottom bar, *Mis clases* active |
| `5-shell-06-profesora-liquidacion.png` | The second tab active |
| `5-shell-07-profesora-escritorio.png` | Profesora on desktop: the same two destinations as pill tabs |

Note: what the captures show is the **content**; the phone bezel around screens 1–2 is review scaffolding and is not part of the design.

# Files in this bundle
| File | What it is |
| --- | --- |
| `Inscribir y cobrar.dc.html` | Screen 1 — enrol + first payment |
| `Tomar asistencia.dc.html` | Screen 2 — attendance |
| `Caja y resumen.dc.html` | Screen 3 — cash and month summary |
| `Login.dc.html` | Screen 4 — login |
| `App Shell.dc.html` | Screen 5 — navigation shell, both roles |
| `support.js` | Runtime that renders the `.dc.html` prototypes. Not part of the design. |
| `Cobro.dc.html` | The shared cobro/pago step both screens mount |
| `assets/tropicana-logo.png` | Logo |
| `screenshots/` | Reference captures of each screen and state (see above) |
| `_ds/organic-186d334f-848b-405d-95ba-b805f2b70bf6/` | The Organic design system: `styles.css` (light token sheet + component classes the prototypes build on), its component bundle, and its own `readme.md`. Each screen overrides the color and font tokens — **the dark values and Montserrat headings in this README win.** |

Resize any of them: the layouts are real, not mockups at a fixed width. To view a prototype, open its `.dc.html` in a browser (keep the folder structure so `support.js`, `_ds/…/styles.css` and `assets/` resolve).
