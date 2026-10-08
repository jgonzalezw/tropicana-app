# Plan: I-009, número de clase en Asistencia

## Contexto
Javier dio I-001 por probado y aprobado; sigue I-009 (S3). Su pedido: *«el contador que se muestra debe indicar a qué número de clase (ordinal) corresponde la clase de la fecha y cuántas le quedan. Puede complementar con el actual clases tomadas/faltas, y resaltar cuando es la última clase del alumno»*.

**Medido** en `src/app/(privado)/asistencia/acciones.ts` (`cargarPadron`):
- `progreso.hechas` (`:637`) y `faltasCiclo` (`:566-585`) cuentan **todas** las asistencias de la membresía, también las posteriores a la fecha que se mira. Al abrir una fecha pasada se ven los totales de hoy.
- No se calcula ningún ordinal.
- Ya existen `fechasDictadas` y `fechasPresentes` por membresía (`:380-405`, solo sesiones dictadas y de todos sus cursos). `cicloAgotadoAl` (`:421`) las usa con el mismo criterio que hace falta acá: plan de N cuenta las dictadas, paquete cuenta las presentes.
- La pantalla arma el texto en `ClienteAsistencia.tsx:927-963` (`meta` y `pill`).

Sin migración. Rama `fix/i-009` desde `fix/i-001` (I-001 todavía no está en `main`; así no se pisan las dos ramas).

## Cambio
1. **Función pura nueva** `src/lib/ordinalClase.ts`, `ordinalDeClase({ clasesPlan, clasesTotal, modalidad, fechasDictadas, fechasPresentes, fecha })`, que devuelve `{ numero, total, quedan, ultima } | null`. Usa el mismo criterio que `cicloAgotadoAl`:
   - **Plan de N clases:** `numero` = dictadas antes de `fecha` + 1. `total` = `clases_plan`, que ya incluye el bono. `quedan` = total − numero. `ultima` = numero ≥ total.
   - **Paquete por clase:** igual, pero cuenta las presentes (una falta no consume).
   - **Ilimitado, prueba o legado sin N:** `null`, sin cambios.
   - Prueba unitaria `src/lib/ordinalClase.test.ts` con estos casos: primera clase, la del medio, la última, una fecha pasada con clases posteriores (no deben contar), un paquete con faltas, e ilimitado.
2. **`cargarPadron`:**
   - En cada fila se agrega `ordinal: ordinalDeClase(...)`. En las filas `extras`, `ordinal: null`.
   - `progreso.hechas` y `faltasCiclo` pasan a contar **hasta la fecha mirada, inclusive**. Para hoy no cambia nada; para una fecha pasada deja de mostrar el futuro. `faltasCiclo` necesita la fecha de la sesión: se toma del mapa `dictadas`, que ya existe. No se toca nada que decida el padrón, la tolerancia ni el bono.
3. **Tipo** `FilaAsistencia` (`src/lib/tipos.ts:693`): campo `ordinal` documentado.
4. **Pantalla** (`ClienteAsistencia.tsx`):
   - `meta` del plan de N: `Clase 5 de 12 · quedan 7 · 4/12 tomadas · 1 falta`. El ordinal va primero y se complementa con lo que ya había.
   - `meta` del paquete: `Una clase · clase 3 de 8 · quedan 5`.
   - Si `ultima`, el texto dice «Última clase» (sin «quedan 0») y aparece la pastilla **«Última clase»** con el color de aviso, también cuando ya está marcado. Tiene prioridad sobre las pastillas de tolerancia.

**Límite que se anota:** si un alumno multi-curso tiene dos de sus cursos el mismo día, los dos padrones muestran el mismo número, porque dentro del día no hay orden. Es lo mismo que hace `cicloAgotadoAl`.

## Verificación
- `npm test` (incluye la prueba nueva), `npx tsc --noEmit` y `npm run lint` en verde.
- Medición con SQL de lectura en dev (`hyhijzuomqpylcmrzdvw`): elegir una membresía de plan de N con varias clases dictadas y una fecha pasada. Comparar el número esperado (dictadas antes de esa fecha + 1) con lo que muestra la pantalla.
- Javier, en `npm run dev:limpio` con la rama `fix/i-009`: abrir Tomar asistencia, un curso de hoy y una fecha pasada. Ver «Clase N de M · quedan K» y la pastilla «Última clase» en un alumno al que le queda una.
- Cierre: fila I-009 en INCIDENTES con causa, commit y prevención; I-001 pasa a «validado por Javier».
