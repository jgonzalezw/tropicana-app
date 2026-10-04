<!-- Historia de docs/DECISIONES.md: texto literal (recorte del 2026-10-04). Filas CERRADAS del backlog, el encuadre del 2026-09-25 y una aclaración vieja. -->

## 1. Decisiones postergadas (backlog) — encuadre histórico


> **Estado al 2026-09-25.** D1 y D2 ya están **cerradas** (D1 el 2026-09-24,
> D2 el 2026-09-23). De la cola del Paso 5: **C1 ✅**, **C2 ✅** (producción
> 2026-09-17), **C3-0a ✅** (contactos, producción 2026-09-24), **C5 a medias**
> (lado cursos regulares en producción desde el 2026-09-16; falta el lado
> reservas, R1). **C3 se redefinió el 2026-09-25**: el relevamiento del
> 23/09 quedó reemplazado por las **definiciones v2**, cerradas con Natalia
> el 25/09 —
> `docs/relevamientos/2026-09-25-C3-definiciones-v2.md`—, y el plan de C3 pasó
> a nueve hitos (H1–H9, en `docs/relevamientos/2026-09-25-C3-plan-construccion.md`),
> sin construir todavía, esperando el OK de Javier. El
> texto de abajo es el encuadre del 2026-09-12 que sigue gobernando el orden
> C1→C5; el v2 no lo cambia, lo llena de contenido.
>
> **Prioridad vigente (Javier, 2026-09-12).** *"D1 y D2 esperan."* (Las dos ya se cerraron.) Lo que manda
> es lo que Natalia necesita: **gestión de clases particulares** (rebanada 2D) y
> **validar/reservar la disponibilidad de la sala** (Paso 5). Las dos van juntas
> —vender una hora sin validar la sala es vender dos veces la misma hora—, así
> que atenderlo implica **adelantar el Paso 5**, entero o en una versión mínima.
> **D5, D6 y D7 ya están decididas** (2026-09-12) y salieron del backlog: ver
> §1.b. D6 además ya está construida y en producción.
>
> **Las tres respuestas están dadas (2026-09-12). Ninguna queda abierta:**
> 1. ~~D20 — ¿una sala o varias?~~ **RESPONDIDA**: una hoy, varias después; se
>    modela para N y se muestra para 1 (ver §1.b).
> 2. ~~**Alcance**~~ **RESPONDIDA**: **validación mínima de choque primero**, y
>    la agenda visual después sobre la misma base. Javier agregó el encuadre que
>    la gobierna: son **dos ejes** —la venta de paquetes de horas con sus
>    contadores, y un motor de calendario de sala— y *"podemos partir por el eje
>    de las ventas y contadores… y algún mecanismo de confirmación de sesiones
>    que luego lo integramos al eje visual"*. **La agenda visual no es opcional
>    ni lejana**: *"es una herramienta fundamental para Natalia por su vista.
>    Debe ir, ya es hoy un problema para ella."*
> 3. ~~**Diseño**~~ **RESPONDIDA**: **código v1 y Design refina**. Y se descubrió
>    que la pregunta era más chica de lo que parecía: *Vender servicio* y
>    *Confirmar sesión* **ya tienen diseño aprobado** en `docs/design/` desde el
>    30 ago 2026. Lo único sin mockup es la agenda de sala.
>
> **Lo que el diseño de agosto NO cubre, y hay que construir igual:** reservar
> una sesión **a futuro** (elegir fecha y hora al vender). *Confirmar sesión*
> solo registra que una sesión **ya ocurrió**. Es la pieza que une los dos ejes.
>
> Lo que ya está listo para apoyarse: `src/lib/horarios.ts` tiene `seSolapan`
> con el criterio de choque ya fijado (intervalo medio abierto: una clase que
> termina 20:00 y otra que empieza 20:00 **no** chocan), y `src/lib/sala.ts` +
> la migración **0035** ya resuelven el costo de sala y la ocupación.


| # | Decisión | Estado | Por qué se postergó | Disparador: cuándo hacerla |
| --- | --- | --- | --- | --- |
| D1 | ~~**Unificar el nombre de la membresía en lo YA EXISTENTE.**~~ **CERRADA el 2026-09-24.** Renombrado `inscripcion_id` → `membresia_id` en `asistencias`, `cuotas`, `pagos`, `corrimientos_ciclo` e `inscripcion_cursos`, y la tabla `inscripciones` → `membresias` (migración 0047), en dev y en producción. | **Cerrada** | — | — |
| D2 | ~~**Sacar el repo de OneDrive**~~ **CERRADA DEFINITIVAMENTE el 2026-09-23.** La mudanza se hizo el 2026-09-16 (miércoles, ~18:54): el repo vive en `D:\dev\tropicana-app`, clonado limpio; el `.env.local` quedó a salvo en un gestor de contraseñas (confirmado por Javier al arrancar el Paso 2D). El stash de la carpeta vieja se inspeccionó el 2026-09-18: estaba vacío (mismo contenido que su commit base), no había nada que rescatar. **La carpeta vieja de OneDrive ya fue eliminada** (Javier, 2026-09-23) — no queda ningún paso manual pendiente. La carpeta de handoff de Design **no se tocó** (`scripts/sync-design.mjs` sigue apuntando a la suya, que es otra carpeta). Procedimiento en `docs/MUDANZA_REPO.md`. | **Cerrada** | — | — |
| D3 | ~~**Renombrar `ClienteVentas.tsx`**~~ **CERRADA el 2026-09-24**, junto con D1: `MostradorVenta.tsx`, en dev y en producción. | **Cerrada** | — | — |
| D8 | **CERRADA — construida y en producción desde el 2026-09-16** (migración 0035 + pantalla *Precios y paquetes*, con las cinco pestañas). La única pregunta que quedó abierta (si Cursos conserva sus columnas de tarifa) ya es trabajo anotado: `ROADMAP.md` **R11**. Texto original: **Pantalla "Precios y Paquetes" como punto único de los precios base.** Javier (2026-09-11): los tramos de precio por cantidad de clases —hoy definidos en la pantalla de Cursos— van a una pantalla propia, diseñada con Design, con una pestaña por bloque (entre ellas, valores de clase de prueba y tramos de precio por cantidad de clases). **De esos tramos** sale el valor unitario de cada clase para el precio referencial. Regla que la gobierna: **el precio pleno es por 4 semanas del calendario normal del curso** — 8 clases si el curso es de dos por semana. La pantalla unifica en un solo punto todas las definiciones de precio base de la aplicación, y desde ahí se cotiza y se adopta el precio de cursos, planes y ofertas especiales. | **Cerrada** (en producción desde el 2026-09-16). Historia: Javier la activó el 2026-09-12 (*"ese debe ser el centro donde se definen los precios base de todos los servicios"*, *"quiero aplicar esa pantalla como un paso"*) y se construyó como hito propio, con las cinco pestañas. | Se postergó por miedo a una migración de datos que **no existe**: medido el 2026-09-12, los precios ya viven en sus propias tablas (`curso_tarifas` para las parciales y la prueba, `descuentos_adelanto` para meses adelantados, `cursos.precio_mensual`, y `tarifas_particular` / `sala_tarifas` desde la 0035). D8 es una **pantalla que los junta, no un movimiento de datos**. | — (lo que quedaba abierto es `ROADMAP.md` R11). |
| D12 | ~~**Los estilos/especialidades tienen que ser catálogo, no parámetro.**~~ **CERRADA el 2026-09-24** (migración 0048, C3-0a.1), en dev: tabla `estilos` (clave, como `sala_tamanos`) + `profesor_estilos`; `cursos.estilo`, `tarifas_particular.estilo` y `paquetes_particular.estilo` pasan de texto libre a FK. Pantalla nueva en Catálogos → Estilos (agregar, renombrar, activar). `cursos.linea` y `profesores.especialidades` quedan marcados OBSOLETA (su borrado queda para una migración futura: la 0049 terminó siendo `sexo` en la matriz). **En producción desde el 2026-09-24** (ver §4). | **Cerrada** | — | — |
| D19 | ~~**Al reemplazante no se le deja la plata para cobrar por caja.**~~ **RESUELTA el 2026-09-18** (migración 0046, R4): el reemplazante tiene su propia línea en "Por pagar", pagable apenas se registra la clase, y el descuento al titular se ve en su línea sin esperar a la liquidación. Ver §1.b. | **Resuelta** | — | — |
| D30 | ~~**Membresía que no puede completarse porque el profesor se fue.**~~ **CERRADA el 2026-10-01** (dev): al desasignar se puede liquidar el **cierre de cuentas** (avance al corte como pago a cuenta, regla 8, excepción; migración 0062, `tipo='cierre'`) y toda asignación nueva pide su fecha de inicio. Las membresías quedan pendientes hasta que un profesor las complete. Falta el lado particulares (etapa 2). | **Cerrada (dev)** | — | — |

**El ejemplo que estaba acá era falso, y conviene decirlo:** se afirmaba que
"Salsa y Bachata Inicial tiene su primera sesión el 31/08 y el conteo le
atribuye 8 clases de agosto". Medido el 2026-09-12 contra dev: el **31/08 es su
fecha de creación en el sistema**; su primera sesión y su primera asignación son
del **03/08**. Ese curso sí corría en agosto. El agujero que la vigencia cierra
es real —el calendario no tenía principio— pero no se demostraba con ese caso.
*(Regla de calidad 3: antes de dar por hecho un diagnóstico, mirar el dato.)*
