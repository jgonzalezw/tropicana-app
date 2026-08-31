# Registro de decisiones — Tropicana

Bitácora de decisiones de diseño y de reglas de negocio. **El chat no es memoria: este archivo sí.**
Cada vez que se define, cambia o se descarta algo, se anota acá con fecha, antes de seguir.

- **Última actualización:** 29 ago 2026 (App Shell + correcciones de inscripción)
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

**N1b — La identidad de un menor es WhatsApp del tutor + nombre (sin apellido).** Un menor puede no tener celular y los hermanos comparten el del tutor. Con tutor cargado, el celular propio del alumno pasa a ser opcional. Dos hermanos con el mismo tutor no chocan; el mismo menor cargado dos veces se detecta. Mismo mecanismo de duplicados que ya existía, apuntado a la clave compuesta.

**N1c — Si el WhatsApp del tutor ya es de un alumno, se vincula, no se duplica.** Panel "ya existe" con "Vincular a esta persona" / "Es otra persona". Escribir sobre cualquiera de los dos campos del tutor rompe el vínculo.

**N2 — Nombre y apellido son campos separados.** Nunca un único campo de nombre completo.

**N3 — Antes de cobrar hay que ver la deuda previa y las inscripciones actuales.** Requisito duro: al elegir un alumno aparecen las dos fichas *Deuda anterior* y *Ya inscripto en*.

**N47 — Los dos patrones compuestos a mano suben a Organic.** `.table-edit` (celda de tabla editable) y `.chips` (multi-select de pills) se habían compuesto dos veces cada uno. Ahora viven en el sistema con su página de referencia, y las pantallas nuevas los toman de ahí. Falta mergearlos al proyecto del design system: están escritos en la copia bound a este proyecto.

**N48 — Profesor es un componente de entidad compartido, no parte de la pantalla.** Mismo contrato que `Cobro`: los datos entran por prop, el componente avisa hacia afuera con `onSelect` / `onGuardar` / `onBaja`, y la pantalla aporta la superficie. Mejorar el flujo de un profesor se hace en un solo archivo.

**N49 — El tipo Activo/Externo lleva su consecuencia escrita al lado.** El campo no significa nada por sí solo: lo que importa es que fija la tarifa de sala que ese profesor paga. El panel `accent-2` lo dice y nombra la tabla donde mirarla.

**N50 — El vínculo con una cuenta de login es opcional y lo dice.** La palabra "Opcional" está en el bloque, no implícita en un campo vacío, y la lista de cuentas excluye las ya vinculadas: la relación uno a uno se hace cumplir desde la lista, no con un error. Para un externo la copy cambia — "normalmente no necesita una" — porque es el caso común, no una omisión.

**N51 — Un externo no aparece en la lista de titulares.** Un titular de curso tiene que ser Activo. Ofrecerlo y después rechazarlo al confirmar es peor que no ofrecerlo; la nota explica la ausencia.

**N52 — El congelamiento de los porcentajes se muestra antes del botón, con candado.** El panel `accent-100` está entre los campos y el confirmar, en orden de lectura, así no se puede pasar sin verlo. Reemplazar un titular agrega el aviso con los porcentajes y la fecha de la asignación que se cierra.

**N53 — La tabla de asignaciones vigentes no usa celdas editables, a propósito.** Es la única tabla del producto que muestra números como texto: son fijos por diseño. Se cierra la asignación y se crea otra.

**N44 — La copy revisada en pantalla baja al paquete, no al revés.** Los `.dc.html` de `docs/design/` son la fuente de verdad del texto: lo que se corrige mirando la pantalla se sincroniza al paquete, y Code lo toma al construir en vez de reescribirlo del lado del código.

**N45 — El panel de error de Login no repite la instrucción.** El encabezado ya dice "Correo o contraseña incorrectos"; el cuerpo pasa a "Volvé a escribir la contraseña.", una sola acción.

**N46 — La bajada de Precios y paquetes no habla del código.** "Si un valor no está en estas cinco tablas, el sistema no lo puede cobrar" dice la misma regla desde la consecuencia, que es lo que le importa al gerente.

**N35 — Los dos servicios comparten una pantalla, y el tipo la reinicia entera.** Particular y alquiler son el mismo movimiento (comprador, paquete, cobro) y precian de las mismas dos tablas. Cambiar el tipo limpia todo: los dos caminos no comparten campos que valga la pena conservar, y un comprador a medio cargar es peor que volver a tipear.

**N36 — El acompañante es lo único que define el tamaño de una particular, y no se vuelve a preguntar.** En el bloque 2 el tamaño se muestra como línea de lectura ("Pareja · titular y acompañante"), no como control. Preguntarlo dos veces habilita que las dos respuestas se contradigan.

**N37 — El alquiler sí pregunta el tamaño, porque no se puede derivar.** Es la única diferencia entre los dos caminos en el bloque 2, y las etiquetas del segmentado llevan el máximo de personas que define el bloque E.1.

**N38 — La lista de profesores muestra la categoría con la que cada uno entra a la tabla E.** No es decoración: es lo que fija el costo de sala dos bloques más abajo. Por eso es una lista de filas y no un desplegable.

**N39 — El costo de sala se muestra antes de cobrar, con las coordenadas resueltas.** Panel `accent-2` con la frase en lenguaje llano más la ruta "Alquiler de sala → Profesor Activo × Pareja × 4 h", para que el administrador pueda verificar la búsqueda en vez de confiar en ella. Si falta la celda, el panel pasa a `accent-100`: la venta se cobra, pero el paquete de sala queda sin precio y no se liquida. Nunca cero silencioso.

**N40 — El precio de sala se guarda en el paquete al venderlo, no se relee después.** Editar la tabla E mañana no puede cambiar lo ya vendido ni una sesión ya dictada.

**N41 — Confirmar sesión tiene un solo botón, porque la unidad es la sesión.** La pareja se dicta o no se dicta; marcar presente a cada uno por separado no significa nada en una particular. Los tres efectos invisibles (paquete del alumno, paquete de sala, comisión) se muestran como previa antes de apretar y como recibo después.

**N42 — Las clases de prueba van en el mismo roll de asistencia, no en otra pantalla.** Son asistentes de esa sesión; separarlas obligaba al profesor a marcar la misma clase dos veces. La forma de la fila sale de cómo se vendió: genérico con cantidad, una fila que vale por su cantidad; alumnos identificados, una fila cada uno.

**N43 — Con pruebas en la lista, los contadores cuentan personas, no filas.** La fila genérica de 3 vale 3 en el encabezado, en las chips del pie y en "sin marcar". Contar filas mostraría 15 donde hay 17 personas.

**N29 — Las cinco tablas de precios son pestañas de una pantalla, no cinco destinos del menú.** El bloque D lee su costo de sala del bloque E, y A y C son dos tablas por curso que el gerente compara. Cinco destinos convertían una sesión de edición en cinco navegaciones y escondían la dependencia. El menú suma un solo ítem.

**N30 — Las celdas de precio son inputs siempre visibles, sin modo edición.** El gerente edita una columna entera de una pasada; un modo edición duplicaría los clics.

**N31 — Una tarifa vacía se marca, no se esconde.** Celda con relleno `accent-100` y borde `accent-400` más el tag "Cae al mensual" en la fila. Vacío significa "no cargado", nunca cero: es lo que decide si el curso cobra el mensual completo.

**N32 — Se elimina solo la fila sin uso; la usada se desactiva, y el motivo se muestra al lado del botón.** No un tooltip ni un aviso después de un clic fallido: el gerente tiene que saber por qué antes de intentarlo. Lo ya vendido conserva su precio.

**N33 — La matriz de sala resuelve sus tres dimensiones como un segmentado de categoría más una grilla horas × tamaño.** Una grilla de tres dimensiones no se lee; una de dos con un conmutador arriba, sí. Los máximos de personas de cada tamaño son parámetros editables y retitulan las columnas.

**N34 — El costo de sala de una clase particular es una búsqueda contra la tabla E, no un campo del paquete.** Un panel `accent-2-200` lo declara y un simulador lo demuestra: elegís un paquete vendido y muestra la celda exacta y el monto que se descuenta en la liquidación. Si falta la celda, el resultado es un estado diseñado ("—" y el motivo), no un cero silencioso.

**N4e — Las casillas de días son pills separadas con relleno tenue, no un segmentado con accent sólido.** Tres días tildados dentro de un `.seg` se leían como una sola mancha naranja y competían con el control de Modalidad justo arriba. El accent sólido queda reservado para los controles de una sola opción; el multi-select usa `accent-200` con tilde. Sin tokens nuevos.

**N4d — El reparto de medio mes es un subconjunto de días, no una opción única.** Casillas por día de clase del curso, todas tildadas por defecto, con el último día tildado no destildable. Habilita el caso intermedio que el radio no cubría: curso Lu-Mi-Vi tildando Lu y Mi son las mismas 6 clases en 3 semanas. Una línea de resumen bajo el control dice total, cadencia y span, y las fechas de inicio se limitan a los días tildados.

**N4c — El total de medio mes lo fija el curso, no la selección de días.** Corrige N4b, que descontaba clases al elegir un solo día. `clases = 2 × días semanales del curso`, siempre. La selección de días no cambia el total: cambia en cuántas semanas se consume (`semanas = clases ÷ días elegidos`). Curso Lu-Mi = 4 clases: con ambos días, 2 semanas; solo lunes, 4 lunes. La etiqueta de cada opción lleva su span ("Solo lunes · 4 semanas") para que la diferencia se lea antes de elegir.

**N4b (superada por N4c) — Medio mes son 2 repeticiones del patrón semanal, nunca una ventana de calendario.** Todos los días del curso → 2 × días semanales (Lu-Mi = 4 clases; Lu-Mi-Vi = 6; un solo día semanal = 2). Un día elegido de un curso con varios → siempre 2 clases. El precio no cambia con la distribución.

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

**N19 — Login no tiene registro ni recuperación de contraseña.** Fuera de alcance por decisión explícita. La compensación es una línea en el panel de error, después de N intentos: "Pedile a la administración que te reinicie la contraseña." Si algún día se construye recuperación, reemplaza esa línea.

**N20 — El error de credenciales no distingue correo inexistente de contraseña equivocada.** Un solo mensaje genérico para los dos casos.

**N21 — Al fallar el login se limpia la contraseña y se conserva el correo.** El error casi siempre está en la clave.

**N23 — El shell es dueño de la navegación, el usuario y el cierre de sesión.** Ninguna pantalla dibuja su propio logo ni "Natalia · admin". Las pantallas conservan su título, su contenido y su footer sticky.

**N24 — El corte a celular es 900px, y se evalúa en JS.** El colapso es estructural: la barra lateral y el drawer son el mismo elemento en dos posiciones, para que la lista de navegación exista una sola vez.

**N25 — Acordeón: un solo grupo de navegación abierto por vez.** Los siete grupos tienen que seguir leyéndose de un vistazo. El header de grupo nunca navega; navega el sub-ítem.

**N26 — Un solo relleno terracota en la barra lateral: el ítem activo.** Es el indicador de página. El grupo que lo contiene se marca solo con color e itálica de peso, sin relleno.

**N28 — Caja y Finanzas usa el ícono de monedas, no de billetera.** A 20px una billetera es el mismo rectángulo redondeado que la tarjeta de Inscripciones y Cobros, y en una barra lateral donde el ícono es lo único que distingue a cada grupo, dos rectángulos iguales son peores que una metáfora menos literal.

**N27 — Para la profesora, barra inferior de 2 pestañas en celular y pastillas arriba en escritorio.** Dos destinos no justifican un menú, y navega con el pulgar en plena clase.

**N22 — El rol devuelto por el login decide la pantalla de destino** (admin → Caja o Inscribir; profesora → Asistencia). Ese ruteo no es parte de la pantalla de Login y no está prototipado.

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
| `mostrarClaveDemo` | Login | `true` (andamiaje de revisión) |
| `intentosParaAviso` | Login | `3` (0 = sin aviso) |
| `rol` | App Shell | `admin` (admin/gerente/asistente/profesora) |
| `forzarMovil` | App Shell | `false` |
| `marcarListas` | App Shell | `true` (andamiaje de revisión) |

---

## 8. Pendientes y huecos conocidos

- El split efectivo/banco de la pantalla de caja es una simplificación del prototipo (se asume que los cobros del sistema son efectivo). En producción se parte por el medio de pago realmente registrado en cada cobro y pago.
- Falta el master del logo con fondo transparente.
- Permisos por perfil de administración (admin / gerente / asistente) sin definir.
- Los sub-ítems de navegación son una propuesta; hay que confirmarlos antes de construir rutas.
- Fuentes: en el prototipo vienen de Google Fonts; en producción hay que auto-hospedarlas o usar el pipeline de la app.

---

## 9. Historial de cambios

Todavía no hay entradas. De acá en adelante, cada ronda de revisión se anota abajo con fecha, pantalla y qué cambió — y si algo obliga a apartarse de Organic, se agrega también a la sección 1.

### 29 ago 2026 (2) — App Shell + correcciones de inscripción
**App Shell** (`App Shell.dc.html`): barra lateral de 264px en escritorio con 7 grupos y 19 destinos, drawer con hamburguesa por debajo de 900px, barra inferior de 2 pestañas para la profesora, chip de usuario y cierre de sesión que linkea a Login. Reglas N23–N27, tres parámetros nuevos, siete capturas.

**Inscribir y cobrar:** identidad compuesta del menor (N1b), vínculo del tutor con un alumno existente (N1c), y medio mes recalculado como 2 repeticiones del patrón semanal (N4b). La opción "15 días seguidos" pasó a "2 semanas completas".

**Sin desviaciones nuevas de Organic.** Dos apartados menores registrados: dos clases utilitarias en `<style>` para que la barra lateral y el drawer sean el mismo elemento, y un backdrop `rgba(12,10,9,.62)` que no está en las rampas porque Organic no define token de backdrop.

**A revisar:** los tres perfiles de administración ven hoy los siete grupos completos. Falta definir permisos por perfil. Los 19 sub-ítems son una propuesta, no un mapa cerrado.

### 29 ago 2026 — se agrega Login
Pantalla nueva `Login.dc.html`: logo centrado, correo, contraseña con mostrar/ocultar, acción primaria, error de credenciales en panel `accent-100` y validación de campos en franja `accent-200`. Sin desviaciones nuevas de Organic — reusa tokens, rampas, radios y tipografía existentes. Se agregan las reglas N19–N22 y dos parámetros configurables. Cuatro capturas nuevas (`4-login-*`).

**A revisar:** el panel `accent-100` ahora cubre dos casos en el producto — aviso informativo (WhatsApp duplicado) y error de credenciales. Fue un pedido explícito; si se quiere separar, hay que decidir un tratamiento propio para uno de los dos.

### 29 ago 2026 — línea base
Se crea este registro. No es una ronda de cambios: es el estado vigente de las tres pantallas (`Inscribir y cobrar`, `Tomar asistencia`, `Caja y resumen`) más el paso compartido `Cobro`, tal como quedaron en el paquete de handoff.
