# Handoff: Tropicana — Alquiler de sala

## Overview
Three screens that implement room rental (*alquiler de sala*) for **Tropicana**, a dance school in Bolivia, according to the v2 definitions (25/09) and prompts H7 (01/10):

1. **Vender alquiler de sala** (new, the main one): a contact rents room hours under a rental plan. Price is resolved from a table; each time slot is an independent booking; payment uses the shared Cobro step.
2. **Plan de alquiler**: editor for the *Alquiler* plan type inside *Planes*.
3. **Precios y paquetes v2**: the *Alquiler de sala* tab, with editable labels for person tiers and client categories (keys locked).

It **replaces the "Alquiler de sala" half of `Vender servicio`** (30 Aug handoff). The private-class half of `Vender servicio` stays as is. A rental pays nothing to a teacher and discounts nothing from a liquidation.

All copy is **Spanish (Bolivia)**, voseo ("Elegí", "Cargalo"). Currency `Bs. ` + `es-BO` separators (`Bs. 1.360`).

## About the Design Files
The files in this bundle are **design references created in HTML**, prototypes showing intended look and behaviour, **not production code to copy directly**. They are "Design Components" (`.dc.html`): a template with `{{ }}` holes plus a small logic class, run by `support.js`. Open any `.dc.html` in a browser to see it working. The task is to **recreate these designs in the target codebase's existing environment** (the Tropicana app's framework, components and data layer), using its established patterns. The logic classes are a readable spec of the rules, not code to port line by line.

All data is **hard-coded sample data** (contacts, plans, rooms, class schedule, prices). In production it comes from the backend.

## Fidelity
**High-fidelity.** Colors, type, spacing, radii, states and copy are final. Recreate pixel-perfectly with the codebase's own components where they exist. Fonts load from Google Fonts in the prototype; use the app's font pipeline.

---

# Screen 1 — Vender alquiler de sala
**File:** `Vender alquiler de sala.dc.html` · **Responsive: 360px phone to desktop, column capped at 680px** · same shell as *Inscribir y cobrar* / *Vender servicio*.

## Layout
Column, `height: 100dvh`, `--color-bg`, centred on `neutral-300`:
1. **Header** (`padding: 18px 18px 6px`): cream logo pill (`--tropi-chip`, radius 999px, padding 5px 13px, logo 24px tall) + `Natalia · admin` right, 13px `neutral-700`.
2. **Title** (`padding: 4px 18px 14px`): h1 "Vender alquiler de sala", Montserrat 800 `clamp(29px,4vw,36px)`; subtitle 15px `neutral-700` "Un contacto alquila horas de sala por plan, con su cobro."
3. **Scroll area** (`flex:1; overflow:auto; padding: 0 clamp(14px,2vw,18px) 26px`): five block cards, 12px gap.
4. **Sticky footer** (`--color-surface`, top 1px divider, `padding: 12px 16px 16px`): status line left (15px; `accent-700` while something is missing, `neutral-700` when ready) + total right (Montserrat 22px), then **Vender** primary block button (18px, min-height 56px), disabled until everything is complete.

**Block card:** `--color-surface`, radius 26px, padding 16px. Header row: 30px circle badge (`--color-accent` fill, `--color-bg` numeral, Montserrat 15px) + block name Montserrat 18px, nowrap. A locked block shows one 15px `neutral-700` line saying what to complete first. Blocks unlock in order.

**Shared patterns:**
- List row button: `neutral-100`, 1px divider border, radius 20px, padding 12px 14px, name 17px/600, meta 14px `neutral-700`, optional tag right.
- Selected-item card: `neutral-100`, radius 22px, padding 14px, with a **Cambiar** ghost button.
- Selected tile (hours, weekdays): `accent-2-200` fill + `accent-2-400` border; unselected `neutral-100` + divider.
- Info panel: `accent-2-200` fill, radius 20–22px, text `accent-2-900`, icon `accent-2-800`.
- Warning/blocking panel: `accent-100` fill, radius 18–22px, text `accent-900`/`accent-800`, triangle icon `accent-700`.
- Inputs: `.input`, 17px, min-height 52px, fill `neutral-200`, pill radius. Segmented: `.seg` with `flex: 1 1 40%` options, wrapping.

## Block 1 — Titular (a contact, never a student)
Four scenarios: **A** existing contact · **B** new person · **C** new organization · **D** possible duplicate.

**Search** (state: no titular, no form open)
- Field "Contacto · nombre o WhatsApp", placeholder "ej. Virginia · 7105 · Colegio". Search from 2 chars on name or WhatsApp digits; max 4 results.
- Result row: name, meta `Persona|Organización · +591 7105 4962`, **role tag** right: `Alumno` (tag-accent-2), `Profesor` (tag-accent), `Solo contacto` (tag-neutral). Picking one asks for **no data**; the role explains block 3's category.
- No results: "Nadie con «q». Si es nuevo, cargalo como contacto nuevo."
- **One button: "Contacto nuevo"** (secondary block, + icon). Person vs organization is chosen **inside** the form.
- Footnote 14px: "Si ya es alumno, profesor o alquiló antes, aparece arriba con su rol y no se le pide ningún dato. Alquilar no lo convierte en alumno ni lo suma al padrón."
- **Buscando:** two 62px skeleton rows + "Buscando contactos…". **Error de lectura:** `accent-100` panel "No pudimos buscar contactos" / "Esto no quiere decir que no exista. Reintentá antes de crear uno nuevo, para no duplicarlo." + **Reintentar**. Never shown as "no results"; the create button is hidden while in error.

**Alta mínima** (`neutral-100` panel, radius 22px, padding 14px, 12px gap)
- Header: "Alta mínima" 13px + context 16px/700 (`Tercero · persona` / `Tercero · organización`) + **Cancelar**.
- Selector **Persona / Organización** (switchable at any time; values are kept). Typed query pre-fills name/razón social (or WhatsApp if numeric).
- Fields follow the **matriz de mínimos** (Administración → Catálogos), each context `obl | opc | oculto`. Labels append " · opcional" for optional. Today:

| Field | Tercero · persona | Tercero · organización |
| --- | --- | --- |
| Nombre | obl | — |
| Apellido | opc | — |
| Razón social | — | obl |
| WhatsApp | obl | obl |
| Redes sociales | opc | opc |
| Consentimiento de contacto | opc | opc |
| Documento | oculto | obl (NIT) |
| Email, Teléfono alternativo, Cómo nos conoció | oculto | oculto |
| Fecha de nacimiento, Sexo | oculto | — (persons only) |

  **All fields are designed, including hidden ones**: the review flag `verOcultos` renders hidden ones with a tag-outline "Oculto por la matriz". In production, render whatever the matrix activates.
- **WhatsApp** normalization: 8 digits → prepend `+591`; starting with `+` → kept (8–15 digits); `591`+8 → `+591…`; else invalid. Hint under field: empty → "Bolivia: 8 dígitos, se antepone +591. Extranjero: escribí + y el código de país."; valid → "Se guarda como +591 7105 4962" + **"Abrir chat ↗"** link (wa.me); invalid → `accent-700` "Formato no válido: 8 dígitos, o + y código de país." Display format `+591 XXXX XXXX`.
- **Duplicate WhatsApp** (scenario D): `accent-100` panel "Ese WhatsApp ya está cargado", name, meta (tipo · rol · WhatsApp), **Usar este contacto** / **Es otro contacto**.
- **Persona de contacto** (organization only, optional): bordered box (1px divider, radius 18px). Copy: "Otro contacto (persona) unido a la organización con la relación «trabaja en». Si la cargás, el WhatsApp de la venta le llega a ella." Search persons, or **Persona nueva** (nombre + WhatsApp, same normalization). Selected: row with tag "trabaja en" + Quitar.
- **Documento** (bordered box): tag-accent with lock "Dato privado" + note "Solo lo ven los roles con permiso de datos privados." (+ for orgs: "Para una organización es el NIT, con el que se factura."). Fields: Tipo (list: Cédula de identidad, CI extranjero, Pasaporte, NIT; default NIT for orgs), Número, Complemento · opcional (CI only), Expedido (CI only: 9 departments), País emisor (Pasaporte / CI extranjero). Validation: CI 5–10 digits, NIT 5–15 digits, Pasaporte alphanumeric 5–15, CI extranjero free. **Duplicate document**: panel "Ese documento ya es de otro contacto" + "No puede haber dos contactos con el mismo documento." with **Usar este contacto** / **Corregir el número** (no "es otro").
- **Redes sociales**: rows of [network icon] [select Instagram/Facebook/TikTok/WhatsApp] [usuario] **Abrir ↗** · Quitar; "+ Agregar red".
- **Consentimiento de contacto** (bordered box): policy card (`neutral-200`, radius 16px) "Política de contacto · versión 3 · finalidad contacto" + text + "Leela o leésela al cliente antes de marcar."; segmented **Otorga / No contactar**; then "Medio por el que se otorgó" (list). Note: it's recorded as a fact with date, medium and policy version; never edited or deleted. "No registrar ahora" ghost when optional. Review flag `consentObligatorio` simulates the matrix requiring it. *The policy text is a draft.*
- **Facturación**: always shown, dashed `neutral-400` border, tag "Todavía no disponible", two disabled inputs, note that the matrix includes it but there is nowhere to store it yet.
- Footer: status line ("Falta el nombre, el WhatsApp y el NIT." / "Listo para guardar.") + **Guardar contacto**, disabled until the matrix's required fields are valid and no duplicate is pending. On save the new contact (role *Solo contacto*) becomes the titular.

**Titular read-only card** (`neutral-100`, radius 22px): role tag + tipo tag-outline, name 20px/700, **Cambiar** + **Ver ficha ↗** link. Grid `repeat(auto-fit,minmax(170px,1fr))`, label 13px `neutral-700` over value 16px:
- **WhatsApp**: icon + number as a link to the chat (wa.me) ↗.
- **Redes sociales**: icon + @user ↗ per network, linking to the profile; "—" if none.
- **Persona de contacto · trabaja en** (orgs with one): name + WhatsApp link.
- **Consentimiento**: "Otorgado · En persona · 12 ago 2026 · política v3" or "Sin registrar".
- "No contactar" → number shown **without link** + `accent-100` panel "X pidió no ser contactado: el WhatsApp no se ofrece y no se le manda ningún aviso de esta operación." Invalid format → no link + panel explaining and pointing to the ficha.

> **Standard contact pattern (N70):** on any screen that shows a contact, the WhatsApp is a link that opens the chat in the device app (wa.me) and each social network opens its profile, each with its icon and ↗. Apply it app-wide.

## Block 2 — Plan de alquiler
List of plans of type Alquiler (row: name + "Agenda fija|Flexible · vigencia N días · Sala 1, Sala 2 o externa"). Note: "El plan no tiene precio fijo: sale de la tabla de alquiler de Precios y paquetes." Selected → card with Cambiar. **No plans:** `accent-100` panel "No hay planes de alquiler" + "Todo alquiler se vende por plan. Crealo en Planes → Nuevo plan → tipo Alquiler, con su vigencia, modalidad y salas." (link).

## Block 3 — Categoría, personas y horas
- **Categoría aplicada — automatic, not editable (N71).** `accent-2-200` panel with shield-check icon: label 17px/700, reason 15px, note 13px "La determina la política de categorías: alumno, profesor de Tropicana o externo; si no cumple ninguna, tercero. No se elige a mano y queda guardada con la venta." Policy, evaluated in order (N = gracia, today 7 days):
  1. **Alumno**: active membership in a regular or private course, or closed ≤ N days ago.
  2. **Profesor de Tropicana**: active assigned courses or active sold private classes, or closed ≤ N days ago.
  3. **Profesor externo**: registered as teacher, does not meet 2.
  4. **Tercero**: everyone else.
  Example reasons: "Es alumno: tiene la membresía de Salsa Intermedio activa." · "Fue alumno: su membresía de Bachata cerró hace 3 días; rige la gracia de 7 días." · "Profesor externo: está cargado como profesor, pero no tiene cursos ni particulares activos (lo último cerró hace 45 días)." · "Tercero: no es alumno ni profesor de Tropicana."
- **Cantidad de personas**: stepper − / count (24px/700) / + (52px pill buttons) + tag-accent-2 "Tramo Pareja · hasta 2". Tier = first tier whose max ≥ count (Individual 1, Pareja 2, Grupo 16; labels editable in Precios y paquetes).
- **Horas · paquetes de la tabla**: tiles `repeat(auto-fit,minmax(130px,1fr))`, "4 h" 17px/700 + price 14px or "Sin precio". Only table packages (today 1, 2, 4, 8). Never a free number.
- **Resolved price** (`neutral-100` card): route 14px "Alquiler de sala → Alumno × Pareja × 4 h = Bs. 250" + "Precio del alquiler" + price Montserrat 26px.
- **Missing price**: `accent-100` panel "La celda Tercero × Grupo × 8 h está vacía. Cargala para poder vender." (or "N personas no entran en ningún tramo…") + route + link "Cargar en Precios y paquetes → Alquiler". Selling stays disabled.

## Block 4 — Sala y horario
- **Sala**: segmented with the plan's rooms + "Sala externa" if the plan allows it; otherwise a note pointing to *Planes → Permite sala externa*.
- **Sala externa**: field "Nombre de la sala externa" (required, placeholder "ej. Salón Los Pinos") + "Fuera de Tropicana: no se valida ocupación y no lleva costo de sala."
- **Agenda fija**: weekday chips L M X J V S D (46px circles, multi-select), then Desde / Hora de inicio / Duración. Generates the whole calendar until the hours are used up (last slot may be shorter).
- **Flexible**: Fecha / Hora de inicio / Duración; only the first booking. Note "Plan flexible: se reserva solo la primera; las otras 3 h se reservan después."
- Start times every 30 min within 08:00–22:00; durations in multiples of 30 min (system minimum). All from lists.
- **Reservas list** ("4 reservas · Sala 1" + "Una reserva por horario"): row date / time range / tag `Libre` (accent-2) · `Choque` (accent) · `Sin validar` (neutral, external). A clash row turns `accent-100` with the reason under it: "Choca con Clase Salsa Intermedio (19:00–20:30)", "Choca con Reserva de Mariela Ávila (10:00–12:00)", "Bloqueo: mantenimiento de piso todo el día", "Fuera del horario base (08:00–22:00)". Any clash blocks the sale.
- **Validity**: if the last booking falls after the plan's validity, `accent-100` panel with both dates; blocks the sale.

## Block 5 — Cobro
The shared **Cobro** step (`Cobro.dc.html`): `referencia` = resolved price, "Precio del alquiler", `politica: descuento`, `direccion: cobro`, medios "Efectivo, QR / transf., Otro". If a balance remains, **Fecha de compromiso del saldo** (list: +7, +14, +30 days), required. *Recommendation:* move this field into Cobro for every sale.

## Sticky footer status (first missing item wins)
Falta el titular → Falta el plan de alquiler → Más de 16 personas: no hay tramo cargado → Faltan las horas → Falta el precio en Precios y paquetes → Falta la sala → Falta el nombre de la sala externa → Faltan los días de la semana → Hay N horarios con choque → Las fechas pasan la vigencia del plan → Falta completar el cobro → Falta la fecha de compromiso del saldo. When ready: "Plan · Titular".

## Confirmation card (replaces the form after Vender)
Check badge + "Alquiler vendido" (Montserrat 20px); titular 22px/700 + tipo · WhatsApp; grid: Plan, Categoría, Personas ("2 · Pareja"), Horas, Vigencia ("60 días, hasta …"); reservas list; room line (+ pending hours for flexible); Total / Pagó hoy / Saldo (· compromiso date).
- **Enviar por WhatsApp** (primary, wa.me with prefilled summary) to the titular, or to the organization's contact person. Under it: "Se envía a Carla Rojas, que trabaja en Colegio San Andrés · +591 7991 1230".
- Invalid WhatsApp → button **disabled** + panel saying why. "No contactar" → **no button**, panel with the reason.
- **Copiar** (secondary) always available as fallback ("Copiado" after click). **Nueva venta** ghost resets.

## Screen states (prop `estado`)
`datos` · `cargando` (3 skeleton cards + "Leyendo planes, precios y agenda de salas…") · `error` (`accent-100` "No pudimos leer los datos de alquiler", explains it does not mean there are no plans, Reintentar) · `sinPlanes` (block 2 panel) · `sinPermiso` ("Tu usuario no puede vender alquileres", needs permission *Vender servicios*).

## What it does NOT have
No teacher, no commission, no room package discounted from anyone, no manually chosen category, no loose rate without a plan, no fixed 1/2/4/8 durations, no style, no tutor, no captación channel for terceros. Full contact editing lives in the contact's ficha (link "Ver ficha").

## State (prototype)
Titular: `q`, `contacto`, `alta`, `altaTipo` (per|org), `aNom`, `aApe`, `aRazon`, `aWa`, `ignorarDupeWa`, `docTipo`, `docNum`, `docComp`, `docExp`, `docPais`, `redes[]`, `consent` (''|si|no), `consMedio`, `pc`, `pcNuevo`, `pcNom`, `pcWa`, hidden fields. Sale: `planId`, `personas`, `horas`, `salaId` (id|EXT), `nombreExt`, `dias[]`, `fechaOff`, `hora` (min), `dur` (min), `cobro` (Cobro payload: total, saldo, valido…), `compromiso`, `hecho` (confirmation snapshot). Category is derived, never stored in UI state; persist the applied category with the sale.

## What the backend has to supply
Contacts search (name/WhatsApp) with role, type, normalized WhatsApp, redes, consent vigente, no-contactar flag, related organization; the data the category policy needs (memberships with status/closing date, teacher courses/private classes with status/closing date) or the computed category + reason; the matrix of minimums per context; rental plans; rooms; the rental price table (category × tier × hours); occupancy (classes, bookings, blocks, base hours) for clash validation; a single read that returns data or an explicit error, never empty lists on failure. On sale: create the rental, one booking per slot, the cash movement, and store the applied category.

## Configurable (review scaffolding only)
`estado`, `estadoBusqueda` (normal|buscando|error), `verOcultos`, `consentObligatorio`, `permitirSinCobro`.

---

# Screen 2 — Plan de alquiler
**File:** `Plan de alquiler.dc.html` · desktop admin page, column max 760px, left-aligned, `padding: 26px 22px 120px`.

- Kicker "Administración · Planes" 14px `neutral-600`; h1 "Nuevo plan de alquiler" Montserrat 800 `clamp(30px,4vw,38px)`; intro 14px with link to Precios y paquetes ("El precio no va acá…").
- Cards (`surface`, radius 26px, padding 20px 22px, 14px gap):
  1. **Nombre del plan** + **Vigencia en días** (grid `minmax(220px,1fr)`); note "Cuenta desde la primera reserva. Al vencer, las horas no usadas se pierden."
  2. **Modalidad de reserva**: segmented Agenda fija / Flexible + explanation of each.
  3. **Salas**: Todas las salas / Solo algunas → room pills (multi-select, 48px). Then **Permite sala externa** switch (58×34px pill, `--color-accent` on, `neutral-300` off, `role="switch"`) with its explanation.
  4. **Extensión**: A precio de lista / Con recargo → "Recargo" % field.
  5. Info panel (`neutral-100`): "Este tipo de plan no lleva" estilo, profesor, forma de pago al profesor, criterio de liquidación ni precio.
- Fixed footer bar: status ("Falta el nombre del plan." / "Listo para guardar." / "Plan guardado…") + Cancelar ghost + **Guardar plan** disabled until valid (name, vigencia > 0, at least one room if "Solo algunas", recargo > 0 if "Con recargo").
- States: `estado` = datos | cargando | error.

---

# Screen 3 — Precios y paquetes v2 (Alquiler de sala tab)
**File:** `Precios y paquetes v2.dc.html` (opens on this tab). Other tabs unchanged from v1 except **Meses adelantados** (card 720px, scrollable table, inputs with "meses"/"%" units, left-aligned).
- Banner (`accent-2-200`): "Fuente única del precio de alquiler. Vender alquiler de sala busca el precio acá, por categoría del cliente × tramo de personas × horas. El plan de alquiler no tiene precio propio, y un alquiler no le paga ni le descuenta nada a un profesor. Una celda vacía bloquea la venta de esa combinación."
- **Tramos de personas** card: grid `minmax(220px,1fr)`; each tier tile: Nombre (editable), Hasta N personas (editable), locked key tag (lock icon, "Clave ind").
- **Categorías de cliente** card: per category, Nombre (editable) + locked key tag ("Clave profesor_tropicana") + "Regla del sistema" text. Note: keys and rules are not editable; the system determines the category with them; the seller does not choose it. Footnote: "N, la gracia después de cerrar, hoy es 7 días."
- **Tarifas de alquiler de sala** table (category segmented × tiers × hour packages) as before. The "Cómo lo resuelve una particular" simulator is removed (contradicts v2).
- Segmented tabs: `white-space: nowrap` on options.

---

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

Additional icons in these screens (Lucide, stroke 2.75): `message-circle` (WhatsApp, `accent-2-700`), `instagram`, `facebook`, `music-2` (TikTok stand-in; use the brand glyph set the app already has), `lock`, `shield-check`, `info`, `triangle-alert`.

## Assets
`assets/tropicana-logo.png` (logo in the header pill). No other images.

## Files
- `Vender alquiler de sala.dc.html`: Screen 1
- `Plan de alquiler.dc.html`: Screen 2
- `Precios y paquetes v2.dc.html`: Screen 3
- `Cobro.dc.html`: shared payment step imported by Screen 1
- `support.js`, `_ds/…`: runtime and design-system stylesheet so the prototypes open offline
- `DECISIONES.md`: decision log; rules N59–N71 apply to these screens

## Open points
- Fecha de compromiso is outside the shared Cobro step; recommended to move it in.
- One contact person belongs to one organization in the prototype; confirm whether a person can work at several.
- Consent policy text is a draft.
- Sample rooms, schedules and prices.
