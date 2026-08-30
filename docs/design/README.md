# Handoff: Tropicana — Inscripción, Asistencia y Caja

## Overview
Three screens for **Tropicana**, a dance school in Bolivia, covering the school administrator's and the teacher's daily jobs:

1. **Inscribir y cobrar** (mobile) — enrol a student in a course and take the first payment in a single flow: a full month, a partial modality (one class, one week, half a month) at its own tariff, or several months in advance with the automatic discount.
2. **Tomar asistencia** (mobile) — a teacher takes attendance for one class, standing in the studio.
3. **Caja y resumen** (mobile + desktop) — cash balance, month summary, and manual cash movements.

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
- **WhatsApp**, full width, `inputMode="tel"`. Its label carries the rule inline: "WhatsApp · identifica al alumno" with the qualifier in `accent-700`. **WhatsApp is the unique identifier for a student.**
- **Duplicate check.** As soon as the digits reach 6, look the number up. On a hit show a panel (`accent-100` fill, radius 20px, padding 14px): heading 14px/600 `accent-800` "Ese WhatsApp ya está cargado", the existing student's name 17px/600, then `Deuda actual: Bs. 250` and `Cursos: …` (or "ninguno activo") at 14px `neutral-700`. Two actions: **"Usar este alumno"** (primary, flex 1, min-height 48px) selects the existing record; **"Es otra persona"** (secondary) dismisses the check for the current input. While the panel is open, "Guardar alumno" stays disabled.
- **Tutor (optional).** Ghost button toggles between "Es menor: agregar tutor" and "Quitar tutor"; open state reveals **Tutor** (name) and **WhatsApp tutor** side by side. Closing clears both.
- **"Guardar alumno"** primary, full width; enabled only when nombre, apellido and 6+ WhatsApp digits are present and no duplicate is pending.

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
- **Qué clases toma (half-month distribution).** Only when the modality is **Medio mes** *and* the course meets on more than one weekday — a second 2×2 segmented, above the date selector: **15 días seguidos** (the default, half the month's classes running consecutively from the start date) plus one option per class weekday of the course, **Solo lunes**, **Solo miércoles**, … The student pays the same `Medio mes` tariff either way; what changes is how the classes are distributed. Picking a weekday takes that weekday's classes across the whole month from the start date (a 2×/week course has ~8 classes a month, so one weekday is half of them). A single-weekday course has nothing to split, so the control is not shown. Changing modality or course clears the choice back to `15 días seguidos`.
- **Start date.** The **same** date selector serves both cases — for the partial modalities it picks the class the period starts from. Its label switches to "Desde qué clase arranca" (from "Empieza a tomar clases"), then a **segmented control** with the **next 3 class dates** for that course, computed from the course's weekday pattern (`1=Mon … 7=Sun`) scanning forward from today; the first is preselected and prefixed `hoy ` when it falls today. Format `lun 24 ago`. Footnote 14px `neutral-700`, which depends on the modality:
  - *Mensual completo:* "La primera cuota se devenga desde esta fecha. Próximo vencimiento: un mes después."
  - *partial:* "Se cobra una sola vez, por el período elegido. No genera cuota mensual."
- **Period note (partial modalities only).** A second line in the same 14px `neutral-700` style, 6px under the first, naming the class days that fall inside the chosen period: "Incluye las clases de lun 24 y mié 26 ago." — or "Incluye solo la clase de lun 24 ago." when there is one. The dates are computed, not typed: from the chosen start date, scan forward over the modality's window (`Una clase` = that day, `Una semana` = 7 days, `Medio mes` = 15 days, or 30 days when a single weekday was chosen) and keep the days matching the course's weekday pattern — or just the chosen weekday. The list joins with commas and ` y ` before the last; the month name is printed once per month run, so a choice spanning two months reads "lun 24, lun 31 ago y lun 7 sep".

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

# Interactions & behaviour — common rules

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
- **Courses:** id, nombre, línea/nivel, weekday pattern, hora, profesor, precio mensual, **plus one own tariff per partial modality** (una clase, una semana, medio mes).
- **Classes:** id, course, teacher (for the teacher's own class list), datetime, enrolled students with monthly absence counts.
- **Enrolment + payment:** student, course, **modality**, **half-month distribution (consecutive or a chosen weekday)**, start date, **months paid in advance**, subtotal, **automatic advance discount (% and amount)**, optional manual discount + motive, total, amount charged, payment method, resulting balance. A partial modality is a one-off charge and generates no monthly due; an advance payment covers N monthly dues from the start date.
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

Note: what the captures show is the **content**; the phone bezel around screens 1–2 is review scaffolding and is not part of the design.

# Files in this bundle
| File | What it is |
| --- | --- |
| `Inscribir y cobrar.dc.html` | Screen 1 — enrol + first payment |
| `Tomar asistencia.dc.html` | Screen 2 — attendance |
| `Caja y resumen.dc.html` | Screen 3 — cash and month summary |
| `support.js` | Runtime that renders the `.dc.html` prototypes. Not part of the design. |
| `Cobro.dc.html` | The shared cobro/pago step both screens mount |
| `assets/tropicana-logo.png` | Logo |
| `screenshots/` | Reference captures of each screen and state (see above) |
| `_ds/organic-186d334f-848b-405d-95ba-b805f2b70bf6/` | The Organic design system: `styles.css` (light token sheet + component classes the prototypes build on), its component bundle, and its own `readme.md`. Each screen overrides the color and font tokens — **the dark values and Montserrat headings in this README win.** |

Resize any of them: the layouts are real, not mockups at a fixed width. To view a prototype, open its `.dc.html` in a browser (keep the folder structure so `support.js`, `_ds/…/styles.css` and `assets/` resolve).
