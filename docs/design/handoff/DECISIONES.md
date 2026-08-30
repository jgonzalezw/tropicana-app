# Registro de decisiones — Tropicana

Bitácora de decisiones de diseño y de reglas de negocio. **El chat no es memoria: este archivo sí.**
Cada vez que se define, cambia o se descarta algo, se anota acá con fecha, antes de seguir.

- **Última actualización:** 29 ago 2026
- **Estado:** reconstruido a partir del README de handoff y del código de los prototipos. No hay historial de conversación anterior a esta fecha; lo que sigue es el estado **vigente**, no un diff.
- **Fuente de verdad detallada:** `design_handoff_tropicana/README.md` (501 líneas, especificación completa). Este archivo es el índice de decisiones, no su reemplazo.

---

## 1. Desviaciones respecto del sistema de diseño Organic

Organic está vinculado al proyecto como estilo obligatorio. Estas cuatro decisiones se apartan de él a propósito y **conviene revisarlas**, porque si mañana alguien aplica Organic tal cual, las pantallas se rompen visualmente.

| # | Regla de Organic | Qué hacemos en Tropicana | Motivo registrado |
| --- | --- | --- | --- |
| D1 | Ground crema `#f5ead8`, texto `#201e1d` | **Ground oscuro.** Ramp neutral invertido: `100 #302a25` → `900 #f4ebdd`. Accent y accent-2 también invertidos. | La pantalla de asistencia se usa parada en el salón, con poca luz. El fondo oscuro es requisito de uso, no gusto. |
| D2 | Caprasimo es la única voz display | **Montserrat** (600/700/800) para títulos y cifras; Figtree para cuerpo | Caprasimo no rinde en cifras de dinero ni en tamaños de interfaz densos. |
| D3 | Elevación con `--shadow-sm/md/lg` | **Sin sombras.** Separación por escalones de superficie: `bg` → `surface` → `neutral-100` | Las sombras de Organic están calibradas para fondo claro; sobre oscuro no se leen. |
| D4 | Fotografía con `.washed` | **No se usa fotografía** | Ninguna pantalla la necesita. |

**Sí se respeta de Organic:** radios sobre-redondeados (contenedores 26–32px, paneles 20–22px, botones/inputs/chips 999px), Lucide a `stroke-width: 2.75`, accent-2 sage como segunda voz real (no como highlight), foco de teclado `2px solid var(--color-accent)` con `outline-offset: 2px`, estados hover/pressed tomados del ramp (`accent-400` para pressed sobre oscuro).

**Logo:** el master es PNG con fondo blanco (1051×655). Sobre el fondo oscuro va sobre una pastilla crema (`--tropi-chip` `#f4ebdd`, radio 999px). Decisión explícita: **no** usar `mix-blend-mode`. Pendiente: pedir a la escuela un master con fondo transparente (SVG).

---

## 2. Decisiones de arquitectura

**A1 — `Cobro` es un paso compartido, no código repetido.**
Cobrar plata es siempre la misma decisión: *este es el saldo, cuánto se mueve, por qué medio, con qué descuento o ajuste, y qué queda*. Vive en un solo componente (`Cobro.dc.html`) que las pantallas montan con sus parámetros. Se tomó esta decisión **porque las pantallas se habían desincronizado** al implementar el cobro por separado en cada una.

Props: `sujeto`, `detalle`, `referencia`, `referenciaLabel`, `politica` (`descuento|ajuste|simple`), `direccion` (`cobro|pago`), `medios`, `permitirSinCobro`, `cuentaId`, `onChange`.
El paso solo tiene la decisión; la persistencia, los mensajes de validación y el resumen son del que lo monta.

**A2 — Todo pasa en la misma pantalla.**
Sin navegación entre pasos, sin rutas modales. Los bloques se desbloquean al llenarse, los paneles abren en línea, el éxito se avisa con un banner en la misma pantalla.

**A3 — Divulgación progresiva antes que campos deshabilitados.**
Un bloque bloqueado muestra una instrucción corta ("Elegí primero el alumno."), no controles grises.

**A4 — Una sola acción primaria por pantalla**, en footer sticky en las pantallas de teléfono, ancho completo, mínimo 56px de alto.

**A5 — Los prototipos son referencia de diseño, no código de producción.** Los datos son de muestra, tomados de la planilla real de la escuela (agosto 2026).

---

## 3. Reglas de negocio fijadas

**N1 — WhatsApp es el identificador único del alumno.** Al llegar a 6 dígitos se busca duplicado; si hay coincidencia se muestra el alumno existente con su deuda y sus cursos, y dos salidas: "Usar este alumno" / "Es otra persona". Mientras el panel esté abierto, "Guardar alumno" queda deshabilitado.

**N2 — Nombre y apellido son campos separados.** Nunca un único campo de nombre completo.

**N3 — Antes de cobrar hay que ver la deuda previa y las inscripciones actuales.** Requisito duro: al elegir un alumno aparecen las dos fichas *Deuda anterior* y *Ya inscripto en*.

**N4 — Cada modalidad tiene su propia tarifa; no es un porcentaje de la cuota mensual.** `tarifaPropia` es una **búsqueda, nunca un cálculo**. Si un curso no tiene tarifa para una modalidad, se cae a la cuota mensual, no se inventa una fracción. Ejemplo cargado: curso de Bs. 250 → una clase 45, una semana 90, medio mes 140.

**N5 — Medio mes: la distribución cambia qué clases entran, nunca el precio.** "15 días seguidos" (default) o un día de la semana concreto. Solo se muestra si el curso tiene más de un día semanal.

**N6 — Pago adelantado solo en modalidad Mensual completo.** Control 1 · 2 · 3 · Más, default 1.

**N7 — Los dos descuentos son independientes.**
El automático es política: sale de `tablaDescuentoMeses`, no pide input, y se aplica **antes** de que el paso compartido vea la cifra. El manual es una decisión de quien cobra, vive dentro del paso compartido, **exige motivo**, y se aplica **encima** del anterior.

**N8 — La tabla de descuento se cruza por cantidad exacta de meses.** 4 meses con tabla `2, 3, 6` no lleva descuento. **No se interpola.** `descAuto` redondea a bolivianos enteros. Es un parámetro de escuela, no una constante en código.

**N9 — Toda cifra hace clamp en cero.** Un pago de más nunca genera saldo negativo.

**N10 — Asistencia: un toque marca presente, otro lo pasa a ausente, y nunca vuelve a "sin marcar".** "Todos presentes" es el caso común; después la profesora toca solo a los que faltan.

**N11 — Orden alfabético por apellido** (`localeCompare(…, 'es')`). En el prototipo el apellido se deriva como "todo lo que sigue a la primera palabra"; en producción es un campo.

**N12 — `faltasToleradas` es un parámetro configurable, no un número fijo** (prototipo: entero 1–4, default 2). `restantes <= 0` → pill "Sin tolerancia"; `restantes == 1` → "Última tolerada".

**N13 — Se genera reposición** para cada alumno ausente que todavía tenía tolerancia (`faltas < faltasToleradas`).

**N14 — Cada motivo de caja mapea a un bucket de deuda, o a `null`.** Un movimiento cuyo motivo corresponde a una venta de servicio o producto **descuenta la cuenta por cobrar** que le corresponde; un pago descuenta la cuenta por pagar. Los dos motivos "Otro" mueven caja y no tocan ninguna deuda.

**N15 — Un bucket no es un número: es una lista de líneas abiertas, una por sujeto.** Por **inscripción** en cuotas (un alumno en dos cursos tiene dos saldos independientes), por paquete en particulares, por profesor en comisiones, por línea de costo en gastos fijos, por proveedor. Cada movimiento lleva el id de la línea que liquida.

**N16 — Un descuento liquida saldo igual que el efectivo**, como en la planilla: `pendiente = max(0, base − Σ(monto + descuento))`. Bs. 200 con Bs. 50 de descuento cierran un saldo de Bs. 250.

**N17 — El movimiento de caja hereda la política de su tipo de operación**, la que ya está definida en la planilla correspondiente: `descuento` para cuotas/particulares/alquiler/pruebas/productos, `ajuste` para profesores/proveedores, `simple` para gastos fijos, nada para los "Otro". Cobrar desde caja no es un acto más liviano que cobrar desde la pantalla de la operación.

**N18 — Caja y margen no coinciden, a propósito.** El saldo cuenta solo plata que se movió; el margen del mes devenga los Bs. 4.765 de costos fijos estén pagados o no. Esos costos aparecen en *Por pagar*.

---

## 4. Copy y formato

- Todo el copy es **español de Bolivia**. No traducir ni "neutralizar".
- Moneda: **Boliviano**, siempre prefijo `Bs. ` con separador de miles `es-BO` → `Bs. 1.360`.
- Fechas: `lun 24 ago`. Abreviaturas de día: `dom lun mar mié jue vie sáb`.
- Montos con signo: `+ Bs. 1.924` / `− Bs. 520` con **menos tipográfico U+2212**, no guion. El cero no lleva signo.
- Plurales resueltos a mano: "1 presente" / "2 presentes", "1 reposición" / "2 reposiciones".

## 5. Mínimos de accesibilidad y tamaño

- Ningún texto interactivo por debajo de **15px**.
- Ningún objetivo táctil por debajo de **44px**.
- Inputs `min-height: 50–52px`; botones primarios `56–58px`; filas de asistencia `74px`.
- Errores en línea, junto a la acción que bloquean, y se limpian al cambiar el campo culpable.
- Foco de teclado siempre visible y tematizado; nunca el azul del navegador.
- Responsive real de 360px a escritorio. Pantallas 1–2 son shells de app (`100dvh`, scroll interno, footer sticky); pantalla 3 es página normal con `auto-fit` + `minmax`.

## 6. Movimiento

Una sola animación de entrada: `opacity: 0; translateY(6px)` → `opacity: 1`, **200–250ms ease-out**, en banners y paneles que aparecen en su lugar. Nada más.

---

## 7. Parámetros configurables (no constantes en código)

| Parámetro | Pantalla | Default |
| --- | --- | --- |
| `modalidadesParciales` | Inscribir y cobrar | `true` |
| `tablaDescuentoMeses` | Inscribir y cobrar | `2:5, 3:10, 6:15` |
| `permitirSinCobro` | Inscribir y cobrar | `true` |
| `faltasToleradas` | Tomar asistencia | `2` (rango 1–4) |
| `mostrarDeuda` | Tomar asistencia | `true` |
| `mostrarComposicion` | Caja y resumen | `true` |

---

## 8. Pendientes y huecos conocidos

- **Login: no existe.** Nunca se empezó.
- El split efectivo/banco de la pantalla de caja es una simplificación del prototipo (se asume que los cobros del sistema son efectivo). En producción se parte por el medio de pago realmente registrado en cada cobro y pago.
- Falta el master del logo con fondo transparente.
- Fuentes: en el prototipo vienen de Google Fonts; en producción hay que auto-hospedarlas o usar el pipeline de la app.

---

## 9. Historial de cambios

Todavía no hay entradas. De acá en adelante, cada ronda de revisión se anota abajo con fecha, pantalla y qué cambió — y si algo obliga a apartarse de Organic, se agrega también a la sección 1.

### 29 ago 2026 — línea base
Se crea este registro. No es una ronda de cambios: es el estado vigente de las tres pantallas (`Inscribir y cobrar`, `Tomar asistencia`, `Caja y resumen`) más el paso compartido `Cobro`, tal como quedaron en el paquete de handoff.
