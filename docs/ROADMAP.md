# Tropicana — ROADMAP

Mejoras funcionales, deudas y pendientes que **no son del hito en curso**, para
poder priorizarlas después. Práctica permanente pedida por Javier el 2026-09-12:
*"Cuando aparezca algo nuevo que no es del hito en curso, no lo pierdas ni lo
metas a la fuerza: anotalo en el ROADMAP."*

**Se actualiza en cada cierre de hito, junto con `ESTADO.md`, y se hace push** —
así la sesión local y la de la nube no se desincronizan.

### Cómo se reparte con los otros dos documentos

Los tres existen para cosas distintas, y mezclarlos es lo que ya costó caro:

| Documento | Qué guarda |
| --- | --- |
| `REGLAS.md` | Las reglas invariables. Si el código las contradice, manda el documento. |
| `DECISIONES.md` | **Decisiones**: las tomadas, y las postergadas con su disparador. |
| `ROADMAP.md` (este) | **Trabajo pendiente**: mejoras, deudas y pendientes con su tamaño. |

Una decisión postergada (`D4`, `D11`…) vive en `DECISIONES.md` y **acá solo se la
referencia**, nunca se la copia: dos copias se contradicen y nadie sabe cuál vale.

Tamaño: **S** = un rato · **M** = un hito chico · **L** = un hito propio.

---

## 1. Motor de sala y agenda (Paso 5)

| # | Qué es | Rebanada | Tamaño |
| --- | --- | --- | --- |
| R1 | **Conflicto bloqueo-vs-agendado (C5).** Cuando un bloqueo o un cierre cae sobre clases o reservas ya agendadas, el sistema **junta los conflictos y el humano decide** caso por caso — nunca una cancelación automática silenciosa. Para un curso regular, un bloqueo que pisa una clase **es una suspensión** (corre el fin de ciclo, regla de negocio 4). Conecta con notificaciones. El modelo se prevé desde C1; se construye después. | C5 | L |
| R2 | **Agenda visual (C4).** La grilla-calendario día/semana/mes con intervalos de 30 min parametrizables, como mesa de operaciones: Nueva Reserva, Bloquear, Nueva Venta, marcar realizada, reprogramar, cancelar. **Pasa por Claude Design.** Javier: *"es fundamental para Natalia por su vista"* — va después del motor, no antes. | C4 | L |

## 2. Caja (2F)

| # | Qué es | Rebanada | Tamaño |
| --- | --- | --- | --- |
| R3 | **Lista "Por pagar".** Hoy `lineasPorCobrar` arma solo el bucket `cuotas`: no existe la contracara. Sin ella, lo que hay que pagarle a alguien no aparece en ninguna lista. Es el contenedor que necesitan R4 y R5. | 2F | M |
| R4 | **Pago al reemplazante (D19).** A D17b le descuenta al titular lo que costó el reemplazo, pero no genera la contrapartida: al suplente se le paga de memoria. Ver **D19** en `DECISIONES.md`. | 2F | S sobre R3 |
| R5 | **Liquidaciones pendientes con pago parcial.** Que una liquidación pagada a medias se vea y se pueda cerrar desde Caja. | 2F | M |
| R6 | **Arqueo / cierre de caja.** No existe. | 2F | M |
| R7 | **Camino inverso del cobro** (anular o revertir un cobro asentado, dejando traza). Hoy no hay forma. | 2F | M |

## 3. Marco de roles y política (documento de Arquitectura, 12/09/2026)

| # | Qué es | Rebanada | Tamaño |
| --- | --- | --- | --- |
| R8 | **Cuatro roles donde hoy hay dos.** El sistema tiene `administrador` y `profesor`; el marco define Gerente, Comercial, Asistente y Profesor. Los permisos ya son configurables por rol, así que es mayormente datos. **El detalle que puede romper en silencio:** las políticas RLS de escritura usan `es_admin()`, que pregunta literalmente por `clave = 'administrador'`. Hay que verificar tabla por tabla, no asumir que alcanza con que las server actions usen `service_role`. | transversal | M |
| R9 | **Tope de descuento en dos niveles.** Hoy el paso `Cobro` permite descuento manual con motivo obligatorio pero **sin techo**. El marco pide un tope para el mostrador y que por encima la operación la ejecute el Gerente. Parámetro + validación **en el servidor** (el control no puede vivir en la pantalla). | transversal | M |
| R10 | **Precio del plan inmutable mientras tiene membresías activas.** Hoy rige *snapshot al vender* (regla 12), que protege lo ya vendido pero no impide editar el precio de un plan activo. El marco pide bloquear la edición: para cambiar el precio se inactiva el plan y se libera uno nuevo. **Es un cambio de comportamiento, no solo de pantalla.** | Planes | M |
| R11 | **Cursos deja de editar tarifas base.** Consecuencia directa del marco (§2.4): las tarifas base son política de Gerencia y viven solo en *Precios y paquetes*. Cursos a lo sumo las muestra en lectura. Cierra la doble superficie sobre el mismo dato que quedó abierta al construir D8. | Cursos | S |
| R12 | **Aprobación de planes (borrador → aprobado → publicado).** Fuera de alcance hoy —el Comercial publica directo— pero el modelo tiene que admitirlo después sin rehacerse. | Planes | — (previsión) |
| R13 | **Rol Alumno.** Visión futura: el alumno operando desde su celular (comprar, marcar asistencia con NFC/beacon). No se construye nada; el modelo de permisos no le cierra la puerta. | futuro | — (previsión) |

## 4. Interfaz y consistencia

| # | Qué es | Rebanada | Tamaño |
| --- | --- | --- | --- |
| R14 | **App Shell a 7 grupos.** La barra lateral tiene 3 grupos (General · Gestión · Administración); el App Shell diseñado tiene 7. Es el **Paso 3**. | Paso 3 | M |
| R15 | **Alineación UX del resto de pantallas.** Cursos, Profesores, Dashboard y navegación siguen en el backlog de `docs/PLAN_UX_DANZE.md`. | Paso 6 | L |

## 5. Datos pendientes

| # | Qué es | Rebanada | Tamaño |
| --- | --- | --- | --- |
| R16 | **Alumnos: fecha de nacimiento y sexo.** Migración aditiva + los dos campos en la ficha (sexo desde catálogo, no hardcodeado). Surgió de una revisión de uso. | Alumnos | S |

---

## Decisiones postergadas que además son trabajo

No se copian acá — viven en `DECISIONES.md` con su disparador. Se listan para no
perderlas de vista al priorizar: **D1** (unificar `membresia_id` en lo existente),
**D2** (sacar el repo de OneDrive), **D3** (renombrar `ClienteVentas.tsx`),
**D4** (acceso al detalle en toda lista), **D9** (tarjeta de confirmación de venta
específica), **D11** (inscribir acompañantes de una prueba grupal),
**D12**/**D13** (estilos a catálogo, y aumentar un catálogo sin salir de la
operación).
