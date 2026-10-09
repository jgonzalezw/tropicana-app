# Fase 2 · Commit 11 (optimización de franjas) y Commit 12 (reprogramar en la hoja)

## Contexto
La hoja «+ Nueva reserva» tarda ~6 s por día y ~13 s al abrir: `consultarFranjasReserva` hace ~24 consultas por día, unas 12 en fila a ~400 ms cada una, y vuelve a leer todo en cada cambio de día. Javier aprobó los dos planes (handoff `design_handoff_reprogramar_reserva/README.md`). Se hace primero el 11; **al terminarlo se le mandan los números a Javier antes de seguir con el 12**.

---

## Commit 11 · Optimización

### 0. Doble llamada al abrir
- Causa probable: el `useEffect` de `HojaFranjas.tsx:98` corre dos veces en dev (React StrictMode: montar, desmontar y montar). `vigente=false` descarta la primera respuesta, pero la consulta igual sale.
- **Cómo lo confirmo:** registro temporal de los inicios. Si las dos llamadas salen a pocos ms una de otra y en `next build && next start` sale una sola, es el doble efecto de dev y no se toca. Si en el build también salen dos, es una llamada real y la elimino.

### 1. Datos fijos, una sola vez por apertura
- Acción nueva `consultarBaseFranjas(membresiaId)` en `particulares/acciones.ts`.
- **Una sola lectura de `membresias`** (id, fechas, horas, profesor, `categoria_aplicada`, `curso_id`, `plan_id`), y de ahí:
  - el contexto de permisos: hay que refactorizar `contextoReservaMembresia` para que acepte la fila ya leída;
  - las salas permitidas: `salasPermitidasDeMembresia` acepta `plan_id` ya leído, con una variante interna, y su prueba sigue igual.
- En paralelo, en una sola tanda:
  - parámetros, salas, los dos catálogos;
  - el horario y las excepciones de las salas posibles (`.in("sala_id", …)`);
  - los cursos de esas salas y del profesor (asignaciones, luego cursos);
  - el nombre del profesor;
  - el saldo (`reservas_sala` por `membresia_id`).
- Devuelve todo eso. Las marcas de los días y la «próxima fecha abierta» se calculan en el cliente con funciones puras que ya existen (`ventanasDelDia`, `marcaDia`).

### 2. Datos de la semana: una consulta por rango
- Acción `consultarSemanaFranjas({ membresiaId, desde, hasta })`. Vuelve a comprobar el permiso de forma barata y hace dos lecturas en paralelo:
  - `reservas_sala` con `(sala_id in salas posibles OR profesor_id = prof)`, `fecha between`, estado fuera de lo que libera. Solo las columnas: id, sala_id, profesor_id, fecha, hora, duracion_min, tipo, estado, solicitada_hasta, motivo, glosa.
  - `sesiones` suspendidas de los cursos de sala y profesor en el rango (curso_id, fecha).
- Cambiar de día dentro de la semana: **0 consultas**. Cambiar de semana: 2 consultas, en paralelo.

### 3. Función pura compartida: `src/lib/ocupacionSemana.ts`
- `contextoDelDia(base, semana, salaId, fecha, excluirReservaId?)` devuelve un `ContextoValidacion` del día filtrando lo ya cargado: reservas por sala y fecha, suspendidas del día y la reserva excluida.
- `bloquesDelContexto` y `validarFranja` (`validacionReserva.ts`) no cambian. La hoja arma sus franjas con `contextoDelDia` y `bloquesDelContexto`.
- `cargarContextoValidacion` (el guardado) pasa a armar su `ContextoValidacion` con `contextoDelDia`, sobre las mismas lecturas acotadas a un día. Así el guardado y la grilla usan **la misma función**.
- **El servidor revalida al guardar**: `crearReserva` sigue leyendo de la base y validando. No usa nada que mande el cliente.
- `bloquesDelContexto` se mueve a `src/lib` si hace falta para el cliente, sin cambiar lo que hace.

### 4. Cliente (`HojaFranjas.tsx`)
- Base y semanas viven en `useRef` mientras la hoja está abierta. Al guardar o al cerrar se descartan, porque la hoja se desmonta.
- Si el guardado falla por un choque (23P01 o validación): se descarta la semana, se recarga y se avisa «Esa franja se ocupó mientras tanto; recargué la semana». Hoy `recarga` ya invalida; se suma el aviso.
- `DatosFranjas` se arma en el cliente con lo mismo que hoy devuelve el servidor, así que la grilla, `SemanaChips` y `franjasReserva.ts` no cambian.

### 5. Pruebas (`node --test src/lib/ocupacionSemana.test.ts`)
Pocas y representativas, con paridad contra `ocupacionDelDia`/`ocupacionDeProfesor` hechos a mano:
- un día normal;
- un día con excepción de horario;
- un día con clase suspendida;
- una Solicitada vencida;
- además, que `excluirReservaId` saque la reserva de la sala y del profesor (lo usa el 12).

### 6. Medición
- Mismo método que el «antes»: parche temporal de registro en `admin.ts` y un spec temporal, revertidos y borrados después.
- Misma tabla: abrir, chip, chip, semana siguiente, con consultas, suma, reloj del servidor y tiempo en pantalla.
- Si la agenda del profesor pesa, propongo el índice `(profesor_id, fecha)` **sin crearlo**.
- Después: `tsc`, `npm test` solo de los archivos tocados y el e2e `membresias-2` una vez.
- Commit «Fase 2, 14: …», con la numeración que sigue al 13. **Se le mandan los números a Javier y se espera.**

---

## Commit 12 · Reprogramar desde la ficha (después del OK a los números)

1. **Lectura:** `consultarBaseFranjas`/`consultarSemanaFranjas` aceptan `reservaId` opcional.
   - Se excluye esa reserva de la sala y del profesor (`contextoDelDia(…, excluirReservaId)`).
   - Lo disponible para pedir es el saldo más la duración de esa reserva.
   - Se devuelve la reserva actual: fecha, hora, duración y sala.
2. **`src/lib/franjasReserva.ts`, modo reprogramar:**
   - aspecto «actual» para las franjas de la reserva, que cuentan como libres;
   - el inicio vale si entra el mínimo;
   - el primer clic propone `min(duración actual, la mayor que entre)`, nunca menos del mínimo;
   - después se ajusta igual que al crear;
   - `mismoRango(sel, actual, sala, fecha)` deja el botón apagado.
3. **`src/lib/plazoReprogramacion.ts`:** `validarPlazoReprogramacion()` devuelve siempre OK. La llama la acción y no aparece en ningún texto.
4. **Acción:** envoltorio `moverReserva(e)` en `particulares/acciones.ts`.
   - Comprueba `salasPermitidasDeMembresia` (sin plan no hay restricción) y `validarPlazoReprogramacion`.
   - Después llama a `reprogramarReserva`, que no cambia: las pantallas viejas siguen igual. Esa acción actualiza la misma reserva, valida excluyendo su id, controla el saldo al alargar y recalcula la membresía.
   - No hay cobro por reserva: las cuotas son de la membresía.
5. **UI:**
   - `HojaFranjas` recibe `reprogramar?: ReservaActual`, con:
     - título «Reprogramar reserva» y la píldora «Actual · día · hora · sala»;
     - apertura en el día y la sala de la reserva, con la marca «Actual» en ese día;
     - el prefijo «Duración actual X h · » y la leyenda «Actual»;
     - un solo botón «Mover reserva»;
     - el resumen con «Antes: …» (y la duración anterior si cambió) o «Es el horario actual · Elegí otro día u horario».
   - En la ficha (`membresias_nuevas`), «Reprogramar» de `FilaReserva` abre esta hoja en vez del diálogo. Las pantallas viejas siguen con su diálogo.
   - Al guardar: aviso «Reserva movida · {resumen}», `router.refresh()` de la ficha y se descarta lo guardado al cerrar la hoja.
6. **Pruebas:** `node --test src/lib/franjasReserva.test.ts` con estos casos:
   - correr 30 min chocando con la propia reserva, en sala y en profesor;
   - duración más corta y más larga, hasta lo disponible;
   - inicio donde entra el mínimo pero no la duración actual;
   - mismo rango: el botón no se habilita;
   - alquiler sin plan.

   Más `tsc` y el e2e de la ficha (`membresias-2`, con un caso de mover) una vez.

## Después
PR de la fase 2. Anotar en el PR las pruebas intermitentes (muestrario ⋯/Deshacer y el pushState de la búsqueda) y que la revisión visual con el menú plegado quedó como estaba. Sin pase a producción.

## Reglas de prueba
`tsc` siempre. `npm test` solo con los archivos de `src/lib` tocados. El e2e solo del spec cambiado, una vez. Si algo falla dos veces, paro y aviso.
