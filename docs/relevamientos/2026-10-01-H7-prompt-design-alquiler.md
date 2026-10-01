# C3 H7 — prompt para Claude Design: alquiler de sala

Pegar tal cual en Claude Design (2026-10-01). Reemplaza la mitad "alquiler" de
`Vender servicio.dc.html` (handoff del 30 ago), que contradice las definiciones
v2 de Natalia (25/09). Las clases particulares ya están construidas y
aprobadas: esta pantalla debe sentirse **la misma venta**, con otro contenido.

---

## Qué necesito

Tres piezas, con el sistema de diseño de siempre (tokens, tipografía, patrón
de bloques progresivos de *Inscribir y cobrar*, barra fija inferior, 375 px y
escritorio, estados cargando / error / vacío):

1. **Vender alquiler de sala** (pantalla nueva, la que más importa).
2. **Plan de alquiler** (editor dentro de *Planes*): los campos que lleva un
   plan de este tipo.
3. **Etiquetas editables** en *Precios y paquetes*: nombres de los tramos de
   personas y de las categorías de cliente.

## 1. Vender alquiler de sala

Bloques, en este orden, cada uno se habilita al completar el anterior:

1. **Titular.** Un **contacto** (persona u organización), no un alumno. Se busca
   por nombre o WhatsApp; si no existe se crea ahí mismo (nombre y WhatsApp,
   con el panel de posible duplicado que ya usamos). Un tercero puede ser una
   empresa. **No se convierte en alumno ni entra al padrón.**
2. **Plan de alquiler.** Se elige de una lista de planes tipo alquiler. El plan
   **no tiene precio fijo**: el precio sale de la tabla de alquiler de
   *Precios y paquetes* (categoría × tamaño × horas).
3. **Categoría, personas y horas.**
   - La **categoría la propone el sistema** y muestra **por qué** (ej. "Es
     alumno: tiene la membresía de Salsa activa" / "Fue alumno: cerró hace 3
     días, rige la gracia de 7 días" / "Profesor de Tropicana" / "Profesor
     externo" / "Tercero"). La persona **puede cambiarla**; lo aplicado queda
     guardado con la venta. Reglas: Alumno = membresía activa en curso regular
     o particular, o cerrada hace ≤ N días (hoy 7); Profesor de Tropicana =
     cursos asignados activos, o particulares vendidas activas, o cerrados
     hace ≤ N días; Profesor externo = profesor que no cumple lo anterior;
     Tercero = el resto.
   - **Cantidad de personas** → tramo (hoy Individual 1, Pareja hasta 2, Grupo
     hasta 16; los nombres se editan).
   - **Horas**: solo los **paquetes de la tabla** (hoy 1, 2, 4 y 8 h), elegidos
     de una lista. Nunca se escribe un número libre.
   - Con los tres datos se muestra el **precio resuelto y su ruta** ("Alquiler
     de sala → Alumno × Pareja × 4 h = Bs 250"). Si falta el paquete o la celda
     está vacía: panel que dice **qué falta y dónde cargarlo** (con enlace a
     *Precios y paquetes*) y el botón de vender queda **deshabilitado**.
4. **Sala y horario.** Cada horario es **una reserva independiente** (después
   se puede reagendar, suspender o cambiar de sala por separado).
   - Sala **propia**: se valida la disponibilidad (choques con clases, otras
     reservas, bloqueos y el horario base) y se muestran los choques.
   - Sala **externa** (solo si el plan la permite): una sola sala genérica a
     la que se le pone un **nombre descriptivo** (ej. "Salón Los Pinos"); no se
     valida ocupación ni lleva costo.
   - Plan con **agenda fija**: días de la semana, hora y duración, y se genera
     el calendario completo hasta agotar las horas. Plan **flexible**: solo la
     primera reserva; el resto se reserva después.
   - Duración: múltiplos del mínimo del sistema; la hora de inicio, alineada al
     intervalo estándar.
5. **Cobro.** El paso compartido de siempre (total, medio, descuento con
   motivo, saldo con fecha de compromiso).

Barra fija inferior con el resumen y el botón **Vender**, deshabilitado hasta
que todo lo obligatorio esté completo (diciendo qué falta).

**Tarjeta de confirmación específica**: plan, categoría aplicada, personas,
horas, sala(s) y fechas, monto y saldo, más un botón **"Enviar por WhatsApp"**
al titular (con "Copiar" como respaldo).

**Lo que NO lleva** (a diferencia del handoff de agosto): sin profesor, sin
comisión ni "paquete de sala" que se le descuente a nadie, sin categoría
elegida a ciegas, sin tarifa suelta sin plan, sin duraciones fijas 1/2/4/8.
Un alquiler no le paga nada a un profesor; se cierra cuando se consumen las
horas (o vence su vigencia: lo no usado se pierde).

Estados: cargando; error de lectura (nunca se disfraza de "no hay nada");
**sin planes de alquiler** (explica dónde crearlos); sin permiso.

## 2. Plan de alquiler (en Planes)

Campos propios del tipo: nombre, **vigencia en días**, **modalidad de reserva**
(agenda fija o flexible), **salas** (todas o solo algunas) y el interruptor
**"Permite sala externa"**, y la política de **extensión** (a precio de lista o
con recargo %). **No lleva**: estilo, profesor, forma de pago al profesor,
criterio de liquidación ni precio (sale de la tabla).

## 3. Precios y paquetes — etiquetas editables

En la pestaña de alquiler: poder renombrar los **tramos de personas** y las
**categorías de cliente**. Las **claves no se editan** (el sistema decide la
categoría con ellas): mostrarlas bloqueadas con una nota que lo explique.

## Reglas del producto que debe respetar

- Todo se vende por plan; el titular es un contacto; una reserva = un horario.
- Ningún botón de guardar se aprieta con un dato obligatorio sin cargar.
- Un valor con alternativas se elige de una lista, nunca se escribe.
- Una capacidad no disponible se **explica** (qué falta y dónde cargarlo); no
  desaparece.
- Español, tono y copy como el resto del handoff.
