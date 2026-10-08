@AGENTS.md
@docs/RETOMAR.md

## Método — equivalencias (kit de skills de usuario)
Las skills del método se usan en este repo con estos nombres. **El proyecto manda:** si un paso de una skill choca con una regla de `docs/REGLAS.md`, vale la regla.

| Método | En Tropicana |
|---|---|
| `docs/RETOMAR.md` | `docs/RETOMAR.md` (igual que el método) |
| Hito H-nn | Nomenclatura propia (C3 H7), rama `h7-…` |
| Decisión D-nn | `docs/DECISIONES.md` (D23, D28…) |
| Incidentes | `docs/INCIDENTES.md` |
| `docs/ENTORNOS.md` | `docs/ENTORNOS_CLAUDE.md` |
| Control de migración | `scripts/control_migracion.sql` |
| Proyecto dev / producción | tropicana-dev = `hyhijzuomqpylcmrzdvw` / producción = `pnvhpbxjbdmbktpwebtx` |
| Pase a producción | Igual que siempre: reglas de proceso de REGLAS + guardia de `.claude/hooks`. Las skills no lo reemplazan |

### Principios
- Simplicidad e impacto mínimo: el cambio más simple que resuelve; tocar solo lo necesario.
- Causa raíz, no parches. Medir antes de afirmar.
- Si algo se desvía del plan: parar y replanificar.
- Documentos grandes (ESTADO, DECISIONES): leerlos con subagente (`/explorar`), no enteros.
- Autonomía en dev: errores, logs y CI rojo se resuelven sin pedirle a Javier que investigue. Producción, nunca sin su OK.
- Cuando Javier corrige algo: si puede repetirse, regla con su "costó…" o, mejor, un control.

## Reglas — índice
El texto completo **manda** y está en `docs/reglas/` (`docs/REGLAS.md` es el mapa). **Leé el archivo del área antes de tocarla.** Si algo se contradice con el código, manda la regla. Antes de afirmar que algo «no está implementado», leé el flujo completo: buscar y no encontrar no es prueba.

### Nombres que no se confunden (glosario → `docs/reglas/glosario.md`)
- Membresía = tabla `membresias`; la llave es **siempre** `membresia_id`. Nunca `inscripcion_id`, `inscripciones` ni `inscripcion_cursos`.
- Los cursos de una membresía están en `membresia_cursos`. `membresias.curso_id` **no** es «el curso»: es un resabio mono-curso.
- Fin de ciclo = `membresias.fecha_fin` (se calcula, `finDeCicloReal`) ≠ plazo de pago `cuotas.vencimiento` ≠ cierre de cuentas (`comisiones_devengadas.tipo='cierre'`) ≠ renovación bonificada.
- Agotarse (`cicloAgotado`) ≠ cerrarse (`estado='completada'`: agotada **y** cobrada).
- Persona u organización = `contactos`. `alumnos` y `profesores` son roles por `contacto_id`; ninguna tabla nueva guarda nombre ni WhatsApp propio. Prospecto = contacto sin rol (es válido).
- Referencias (canal de captación) ≠ Referido (`contacto_relaciones` tipo `referido_por`).
- `consentimientos` es de solo agregar; el vigente sale de la vista `consentimientos_vigentes`.
- Corrimiento, bono, prueba, conversión, cuota, matriz de mínimos, plan de servicio, reserva, sala externa, período vencido, extensión, horario hábil: ver el glosario.

### Negocio → `docs/reglas/negocio.md` (leelo antes de tocar membresías, ventas, asistencia, liquidación, reservas o alquiler)
1. Una membresía se completa agotada **y** cobrada.
2. El padrón usa el consumo real (`cicloAgotado`), nunca `estado`.
3. Qué agota cada venta: N clases, paquete, ilimitado, horas, taller.
4. Una suspensión corre el fin de ciclo (se calcula); una falta no.
5. Una membresía devengada no cambia fechas en silencio; una liquidada no se reabre.
6. Bono de tolerancia, por curso (D35): solo con falta con licencia y ninguna sin licencia en ese curso; tope del plan por curso; vence en la renovación bonificada de su curso.
7. Toda venta crea su cuota.
8. Comisión sobre lo cobrado, con el criterio del plan (5 criterios), a período vencido. Formas de pago solo en particulares. Cierre de cuentas al retirarse.
9. Precio del plan: el sistema propone por tramos y la persona decide. En la prueba, suma de cursos.
10. Multi-curso a prorrata: calendario menos suspendidas (ilimitados: asistidas). Peso = clase suelta. Una línea por profesor y curso; cobra quien dictó.
11. La prueba es una membresía preliminar de un plan regular. Al convertir se acredita solo la parte de quien se inscribe.
12. Snapshot de precios y porcentajes.
13. Sin hardcode: catálogo o parámetro.
14. Por rol o permiso, nunca por persona.
15. Las listas de personas van por apellido (`compararPorApellido`).
16. Las clases solo mueven contadores. Lo pagado se compensa con `ajuste`, salvo en el criterio 2.
17. Hay que registrar las sesiones para liquidar, solo en multi-curso. Bloquea esa membresía, no el período.
18. Una clase sin alumnos no existe para nadie.
19. El motivo de la suspensión dice a quién se atribuye. El profesor no cobra lo que no dictó.
20. Una clase con asistencia la dictó alguien: el suplente cobra por tarifa; (a) se le descuenta al titular / (b) queda para Tropicana.
21. Toda contraparte nueva va por `contacto_id`. El titular pasa a alumno al comprar (no en alquiler).
22. Todo se vende por plan; hay cinco tipos de servicio.
23. Cada slot es una reserva independiente. Los 7 estados y su efecto en el saldo; Solicitada ocupa 24 h.
24. La categoría de alquiler la propone el sistema; se edita según `alquiler_categoria_modo`.

### Proceso → `docs/reglas/proceso.md`
1. Pase a producción: OK explícito de Javier, cada vez (el hook lo exige).
2. Se trabaja en dev hasta que Javier pida el pase.
3. Pantalla nueva sin mockup: avisar antes de construir. `docs/design/` no se edita a mano.
4. Piezas reutilizables, una por entidad.
5. Cambio de datos en producción: respaldo + antes/después. El rollback se prueba fila por fila.
6. Nunca pegar cadenas de conexión ni contraseñas.
7. `docs/ESTADO.md` se actualiza con cada hito.
8. Una decisión se respeta hasta que otra, anotada en DECISIONES, la cambie.
9. La sesión sabe dónde corre. El cierre trae el comando git exacto (+ `npm run dev:limpio`). Cada cierre de hito actualiza `docs/RETOMAR.md`.
10. Toda decisión postergada lleva su disparador. Todo plan abre mostrando el backlog que toca.
11. Toda pantalla nueva incluye su permiso por rol.
12. Un aviso a una persona se manda por WhatsApp en un clic (`AvisoWhatsapp`, `abrirWhatsapp`) y se puede copiar.

### Calidad → `docs/reglas/calidad.md`
1. Un fallo no se disfraza de ausencia: `exigir()`.
2. Si se lee una columna nueva, correr `notify pgrst, 'reload schema'`.
3. Medir el dato antes de diagnosticar.
4. Si un cambio no aparece: `npm run dev:limpio` antes de sospechar del código.
5. Una capacidad no disponible se explica; no desaparece.
6. Un valor con alternativas se elige de una lista que sirve el dato y valida el servidor.
7. Todo parámetro o catálogo que lea el código nace en una migración.
8. Toda pantalla se arma con `<Pagina>`, nunca con `mx-auto`.
9. Botón de guardar deshabilitado si falta algo, con una sola función de validación compartida.
- Controles: `scripts/control_migracion.sql`.

## Decisiones — índice
Cómo se usan, el backlog completo y el orden del pase (§3: leelo antes de un pase o de un refresh dev↔prod) están en `docs/DECISIONES.md`. Las vigentes completas, en `docs/decisiones/vigentes.md`; las cerradas, en `docs/archivo/DECISIONES-historia.md`.

**Vigentes:** orden C1→C5 (disponibilidad antes que la venta) · motivo de sala por lista + glosa; horario = patrón + excepciones; vacío = cerrado · una sala hoy, modelo para N · la sala se bloquea sin venta · la duración va en el curso y el fin se calcula · todo campo nuevo es `membresia_id` · vigencia del curso; lo retroactivo es excepción · `tiempos_incremento_min` = dónde empieza; `duracion_minima_curso_min` = duración de reservas · Gerente/Asistente configurables · visibilidad propio/todo por (rol, módulo) · las clases mueven contadores y lo pagado se compensa · la deuda con el profesor es su cuenta; el suplente va en línea propia · orden de C3-0 y matriz en formularios · H5 liquidación de particulares (+ corrección de alcance del 30/09) · C3 definiciones v2 · ventas y contactos con el mismo comportamiento · fechas de inicio dentro de la vigencia · estandarización de /sala (Hito B) · la gestión no saca de /sala (nunca abrir una pestaña nueva) · el modo enfoque atenúa el shell.
**Violadas una vez:** fin de ciclo · corrimiento vs. vencimiento · fallo ≠ ausencia · un concepto, un nombre · el padrón no mira el estado · `asistencia_semanas_retro`=2 · quién dictó no se supone · cobra quien dictó · la config nace en migración · una fecha con plata no se asigna sola · alternativas en una lista.

**Backlog abierto (disparador):**
- D4 acceso al detalle uniforme — con Design o en la 3.ª pantalla.
- D5 motivo del cobro, lado alquiler — H7.
- D9 tarjeta de confirmación — junto con D4.
- D11 acompañantes de una prueba grupal — primer caso real.
- D13 agregar a un catálogo sin salir — junto con D4.
- D22 comisión por referido — cuando se empiecen a pagar referidos.
- D23 documento obligatorio — falta la decisión de negocio.
- D24 multi-escuela — una segunda sede.
- D25 WhatsApp compartido — un caso que la regla de orden no resuelva.
- D26 verificar WhatsApp — volumen de números mal cargados, o C3-0b.
- D27 el suplente carga su asistencia — decidido «no» por ahora.
- D28 anular una venta cobrada — caso real con la cuota saldada.
- D29 simular la pre-liquidación — **activada 2026-10-07, va con I-005**.
- D31 el profesor gestiona sus alquileres — si sube la prioridad.
- D32 la grilla de sala como entrada de la venta (C4) — mockup de C4; todo paso de agenda nuevo recibe el slot.
- D33 asistencia al inscribir con fecha pasada — primer caso real.
