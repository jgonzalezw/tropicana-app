# I-012 fase 4 · Reporte de la membresía (plan guardado el 2026-10-09, sin aprobar)

> Carril en PAUSA, estado A. Se reconstruye sobre la capa de R20 (etapa 3): ver `2026-10-09-plan-r20-notificaciones.md`. Donde dice `politicas` y `membresia_eventos` rige ese plan.


## Contexto
La ficha `/membresias/[id]` ya tiene en el menú ⋯ el ítem «Reporte de la membresía», pero está deshabilitado con el texto «Llega en la fase 4». El handoff `design_handoff_reporte_membresia` pide un documento de dos hojas para el alumno o el titular:
- **Hoja 1:** el estado de la membresía (sección 4 del handoff de la ficha, con los ajustes de la fase 2).
- **Hoja 2 (nueva):** las políticas, una por tipo (regular, particular, alquiler), con los colores de la marca.

Además pide:
- **Acciones:** Imprimir / PDF, Copiar resumen y Enviar por WhatsApp. El envío queda registrado en el historial.
- **Ningún texto fijo en el código:** las políticas se guardan como datos versionados, con marcadores que se completan desde `parametros`.

**Rama:** `membresias/fase-4`, desde `main` (`4b1d4c6`).
**Decisiones postergadas que toca:** ninguna.
**Backlog de I-012 que toca:**
- Se activa el ítem «Reporte de la membresía».
- «Imprimir estado de cuenta» y «Copiar estado de cuenta» se quitan del menú, porque el reporte los reemplaza.

**Desvío respecto del handoff de la ficha:** ese handoff decía «fase 4: solo lectura, sin migraciones». Ahora hace falta **una migración (0071)**, por dos motivos:
- las políticas pasan a guardarse como datos;
- hoy no hay ningún lugar donde registrar el envío por WhatsApp.

---

## Las cuatro preguntas del README

**1. ¿Depende de algo de la fase 3?**
No. El reporte solo lee lo que `obtenerMembresia` ya trae:
- cuotas: `cuenta.cuotas`;
- pagos: `pagos`, con medio y descuento;
- saldo de horas: `detalle.saldo`.

No cobra ni modifica cuotas.

**2. ¿Qué datos de la hoja 1 no existen hoy o no se pueden calcular?**

Datos que ya existen:
- Titular, tutor o contacto (`titular.avisarA`), plan, tipo, ciclo, profesor y horario.
- Clases con presente, licencia y sustituto (regulares).
- Reservas en sus siete estados, con «Reagendada → …» tomado de `reagendadaA`.
- Saldo de horas desglosado, cuotas y pagos.
- Bono, faltas con y sin licencia, y `renovacionBonificada` (es la fecha de «Renová antes del…»).

Datos que no existen, o que exigen una decisión:
- **«También podés ver este reporte actualizado en la app de Tropicana»** (pie de la hoja 1). La app del alumno no existe todavía. Propuesta: el pie también pasa a ser un dato de la política y la versión base no incluye esa frase.
- **Clases futuras del ciclo** (las «Próxima» del calendario). Hoy `clases` trae solo sesiones que ya existen. Las fechas futuras se proyectan con los días del curso hasta `fecha_fin`, reutilizando la función que usa `finDeCicloReal`. No creo una lógica nueva. Esto lo verifico en el primer paso; si no se puede proyectar sin duplicar la regla, el calendario muestra solo lo registrado más el fin de ciclo.
- **Membresía de prueba.** El handoff no la menciona. Va con la política **regular**, porque una prueba es una membresía preliminar de un plan regular (regla de negocio 11).
- **Días de la prueba.** Ya existen: el parámetro `prueba_plazo_dias` vale 7 (migración 0023) y el plan puede pisarlo con `planes.prueba_plazo_dias`. No hace falta un parámetro nuevo; el reporte usa el valor del plan y, si no tiene, el del parámetro.

**3. ¿Sale bien como PDF desde el navegador?**
Sí, con estas precauciones. Repito el patrón que ya funciona en `ImprimirCuenta.tsx` y `Recibo.tsx`: un HTML autónomo que se abre con `window.open` y `print()`.
- `@page { size: A4; margin: 12mm }`. El ancho deja de ser fijo (en el mockup son 780 px) y pasa a ser fluido: el ancho útil de A4 es de unos 690 px.
- La hoja 2 empieza en página nueva (`break-before: page`).
- Las tarjetas, las filas de clases o reservas y cada mes del calendario llevan `break-inside: avoid`. Así no se cortan.
- Sin `print-color-adjust: exact`, Chrome no imprime los fondos de color. Se agrega para que salgan la banda oscura y las tarjetas de color.
- Limitaciones:
  - La hoja 1 de un ciclo largo, con dos meses de calendario y muchas filas, puede ocupar dos páginas. Se corta entre bloques, nunca dentro de uno.
  - La hoja 2 regular es la más alta. Si no entra en una página A4, se baja levemente la escala en impresión.
- Lo compruebo una vez a mano con la vista previa de Chrome, para los tres tipos. No agrega una prueba automática.

**4. ¿Cómo se registra en el historial el envío por WhatsApp?**
Hoy no hay dónde: el historial de la ficha se deriva de otras tablas (`historialDe`) y `AvisoWhatsapp` no registra nada.

Propuesta:
- Una tabla nueva, `membresia_eventos`, de solo agregar. Es el comienzo de la tabla de eventos que piden las fases 5–7, así que no quedaría una tabla suelta.
- Al tocar «Enviar por WhatsApp»:
  1. Una server action registra la fila. Valida en el servidor el permiso del tipo de la membresía y que el destinatario venga de `destinatarioAviso`.
  2. Después se abre WhatsApp con `abrirWhatsapp`, dirigido a `titular.avisarA`.
- `historialDe` suma esas filas: «Reporte enviado por WhatsApp · A {nombre} · enviado manualmente por {usuario}».

**Límite real:** con `wa.me` no se puede adjuntar un PDF. El mensaje lleva el texto del resumen, el mismo que «Copiar resumen». Si se quiere mandar el PDF, primero se guarda con Imprimir / PDF y se adjunta a mano. La pantalla lo dice en una línea; no lo esconde (regla de calidad 5).

---

## Modelo de datos propuesto (migración 0071)

```sql
-- Políticas: una fila por tipo y versión; el contenido se reemplaza entero por versión.
create table public.politicas (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null check (tipo in ('regular','particular','alquiler')),
  version       text not null,          -- 'Oct 2026' (se muestra en el pie)
  vigente_desde date not null,
  url_oficial   text,                   -- opcional → «Ver política oficial completa»
  contenido     jsonb not null,         -- bloques de la hoja 2 (ver abajo)
  creado_en     timestamptz not null default now(),
  unique (tipo, vigente_desde)
);
-- RLS: lectura para autenticados; sin escritura desde la app (por ahora, SQL o migración).

-- Eventos de la membresía (solo agregar; base para las fases 5–7).
create table public.membresia_eventos (
  id            uuid primary key default gen_random_uuid(),
  membresia_id  uuid not null references public.membresias(id),
  tipo          text not null check (tipo in ('reporte_enviado')),  -- se amplía en fases 5–7
  contacto_id   uuid references public.contactos(id),              -- destinatario
  detalle       jsonb not null default '{}',                       -- {politica_id, whatsapp}
  creado_por    uuid not null references auth.users(id),
  creado_en     timestamptz not null default now()
);
-- RLS: insertar y leer con el permiso de ver ese tipo; sin update ni delete.
```

**Cómo se elige la versión vigente:** por tipo, la de mayor `vigente_desde` que sea ≤ hoy. Si un tipo no tiene ninguna, el reporte lo dice («sin política cargada para alquiler»); no muestra una hoja vacía (regla de calidad 1).

**`contenido`** tiene la forma fija del diseño, así que el componente solo dibuja:
```json
{ "kicker": "GUÍA PARA ALUMNOS · MEMBRESÍAS",
  "titulo": ["Cursos regulares", "Asistencia y tolerancia"],
  "intro":   { "pastilla": "REVISA TU MEMBRESÍA", "texto": "…" },
  "verde":   { "titulo": "Falta justificada", "items": ["…"] },
  "naranja": { "titulo": "Falta sin licencia", "items": ["…"], "con_plazo": false },
  "amarilla":{ "titulo": "Si Tropicana suspende una clase", "texto": "La sesión suspendida **no se consume**…" },
  "ciclo_ejemplo": { "titulo": "…", "lineas": [...], "leyenda": [...] },     // solo regular
  "tarjetas": [{ "titulo": "Clase de prueba", "texto": "…dentro de los {prueba_dias} posteriores." }, …],
  "oscura":  { "titulo": "Al finalizar cada clase", "texto": "…" },
  "pie": "¿Dudas sobre la tolerancia…? Consulta en recepción.",
  "como_funciona": ["Tu ciclo tiene {clases_total} clases… termina el {fin}…", …],  // hoja 1
  "pie_hoja1": "¿Dudas sobre tu membresía? Escribinos al WhatsApp de la escuela." }
```

- **Marcadores de parámetros:** `{plazo_cancelacion}`, `{solicitud_validez}`, `{prueba_dias}`.
- **Marcadores de la membresía:** `{clases_total}`, `{fin}`, `{horas_total}`, `{renovar_hasta}`.
- **Negrita:** solo `**…**`. No se guarda HTML; todo se escapa al dibujar.
- Los textos de la hoja 1 («Cómo funciona», el pie) también pasan a datos, para que no quede nada fijo en el código.
- **Lo que sigue en el código, porque es cálculo y no texto:**
  - la nota «En tu membresía: …»;
  - el ejemplo del plazo sobre la próxima reserva real;
  - el estado de cada clase o reserva.
- **Carga:** la 0071 carga los textos del mockup como versión base «Oct 2026» (`vigente_desde` = 2026-10-01), sin URL.

---

## Archivos

**Migración**
- `supabase/migrations/0071_politicas_y_eventos_membresia.sql`: las dos tablas, RLS, la carga de las tres versiones base y `notify pgrst, 'reload schema'`.
- `scripts/control_migracion.sql`: un control nuevo, «cada tipo tiene una política vigente».

**Reglas en `src/lib` (con pruebas)**
- `src/lib/politicas.ts`:
  - `reemplazarMarcadores(texto, valores)`, que avisa si queda un marcador sin valor;
  - `politicaVigente(versiones, tipo, hoy)`;
  - `tipoDePolitica(tipoMembresia)`: prueba → regular.
- `src/lib/reporteMembresia.ts`:
  - `notaEnTuMembresia(ficha)` por tipo;
  - `ejemploPlazo(proximaReserva, plazoHoras)`, que cubre el caso en que el plazo cruza al día anterior;
  - `datosHoja1(ficha, hoy)`, que reutiliza `indicadoresDe` y `lineasDePagos` de `fichaMembresia.ts`;
  - `resumenTexto(...)`, para Copiar y para WhatsApp.
- `src/lib/reporteHTML.ts`: `construirReporteHTML(datos)`, un HTML autónomo con los estilos de impresión.
  - Es una sola pieza: la vista previa la muestra en un `iframe srcDoc` y la impresión la abre con `window.open`. Así el diseño no se duplica (regla de proceso 4).
  - Sigue el patrón de `construirHTMLImpresion` en `alumnos/[id]/cuenta/ImprimirCuenta.tsx`.
- `src/lib/fichaMembresia.ts`: `historialDe` agrega los eventos `reporte_enviado`.

**Lectura y acción (`src/app/(privado)/membresias/`)**
- `acciones.ts`: `obtenerReporte(id)`, que lee la ficha, la política vigente y los parámetros con `exigir()`, y `registrarEnvioReporte(id)`.
- `(lista)/[id]/ReporteMembresia.tsx`: un overlay con barra (Copiar resumen · Imprimir / PDF · Enviar por WhatsApp · ×) y la vista previa. Reutiliza `abrirWhatsapp` y el `Aviso` de `components/nuevo`.
- `(lista)/[id]/AccionesFicha.tsx`: activa «Reporte de la membresía» y quita los dos ítems de estado de cuenta.
- `public/marca/tropicana-logo-sol.jpeg`: el logo, copiado del handoff.

**Permiso**
- No es una pantalla nueva: el reporte se abre dentro de la ficha, con el mismo permiso por tipo.
- `registrarEnvioReporte` valida en el servidor el permiso de ver el tipo de esa membresía.

---

## Pruebas (solo las del README)

**`tsc`**, siempre.

**`npm test`**, con unitarias solo de reglas:
- el reemplazo de marcadores con parámetros;
- la elección de la versión vigente;
- la nota «En tu membresía» por tipo;
- el ejemplo del plazo cuando cruza al día anterior.

**E2E:** un spec nuevo, `e2e/membresias-4-reporte.spec.ts`, que se corre una vez.
- Datos propios de una membresía de cada tipo. Se amplía `e2e/membresiaDePrueba.ts` con un parámetro `tipo`, que copia como modelo una regular o un alquiler activos, igual que hoy con la particular.
- Comprueba que la hoja 2 corresponde al tipo (su título) y que «PLAZO: N h» coincide con el valor de `reserva_cancelacion_plazo_horas` leído de la base.

**Revisión a mano:** una vez, la vista previa de impresión de Chrome para los tres tipos.

Si algo falla dos veces, paro y te aviso.

---

## Pase
1. Se valida en dev y, si funciona, se pasa a producción con tu OK, como siempre (lo exige el hook). No hay interruptor nuevo.
2. La migración es solo aditiva: dos tablas nuevas y su carga. No modifica datos existentes, así que no hace falta respaldo `*_previo_*`. El rollback consiste en borrar las dos tablas, y lo pruebo en dev.
3. **Foto previa en producción:** el conteo de `membresias` y `reservas_historial`, que el pase no toca, y la verificación de que 0071 es la próxima libre.
4. **Al cierre:** se actualizan `DECISIONES` (políticas como datos versionados; `membresia_eventos` nace en la fase 4), `ESTADO` y `RETOMAR`.

**Modelo sugerido:** uno capaz para la migración y el HTML de impresión; uno económico para las pruebas.
