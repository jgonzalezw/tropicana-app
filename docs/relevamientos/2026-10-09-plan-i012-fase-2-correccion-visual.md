# I-012 fase 2 · corrección visual de la sección Membresías (igual al mockup)

## Contexto
Javier comparó la ficha con `Ficha de membresia.dc.html` y no se parece. El handoff v3 trae `Especificacion visual ficha.md` con los valores exactos. Esa especificación es la fuente principal y el mockup completa lo que falte.

**Alcance:** todas las pantallas de la sección.
- Lista.
- Barra superior de la ficha.
- Encabezado, indicadores y pestañas (Clases/Reservas, Pagos, Historial).
- Columna derecha.
- La hoja «Nueva reserva».

**Fuera de alcance:**
- El riel de 60 px: la navegación actual no se toca hasta la fase 8.
- Las pantallas actuales: `/particulares/[id]`, `/alquileres/[id]` y `/sala` quedan idénticas.

Rama: `membresias/fase-2`, en el mismo PR que la fase 2.

**Ya hecho en esta sesión (sin commit):**
- e2e `e2e/membresias-2.spec.ts`, verde.
- Arreglo del mensaje de choque con un bloqueo, en `validacionReserva.ts`. `ocupandoAhora` trataba todo como particular y descartaba los bloqueos; ahora dice «La sala ya está ocupada… choca con ‹bloqueo›».
- Ambos van en un commit 5 antes de empezar.

## Precisiones de Javier (aprobado)
- **Quiebres por container queries**, según el ancho real de la sección y no el de la ventana.
  - `.n-disposicion` es el contenedor de la sección y `.n-ficha` el de la ficha.
  - Si la ficha mide menos de 1100 px, la columna derecha pasa abajo.
  - Si lista + ficha no entran (300 + 520 px), se usa el modo de dos pantallas que ya existe para celular.
  - Nunca scroll horizontal. Se verifica en la captura a 1000 px.
- **Tokens fijos:** la sección queda siempre en tema oscuro. Va anotado en `docs/decisiones/vigentes.md` como decisión de 1a/2.
- **Nombres de plan:** se muestran como están guardados, sin ningún formateo.

## Causas de lo que se ve mal (medidas)
- **Renovar marrón:** `--n-acc` se deriva de `--primario` del tema del usuario (`ui-nuevo.css:13`). La spec fija los tokens, así que paso a valores fijos (`#e8894d` y los demás). Deshabilitado queda en opacidad .45.
- **Título en mayúsculas:** no hay `text-transform`; el plan está guardado así («FLEX 6H PARTICULARES…»). La spec dice «se muestran como están guardados». Queda en 26 px y sin forzar, pero un nombre guardado en mayúsculas se seguirá viendo en mayúsculas.
- **Valores en dos líneas:** falta `white-space:nowrap` y los formatos cortos. `fechaTexto` da «27 dic 2026» y `gs` da «Bs. 250,00».
- **Columna comprimida:** `.n-cols` usa `minmax(0,1fr)` y corta en 1199 px. La spec pide `minmax(520px,1fr)` y corte en 1100 px.

## Archivos
**Lógica (src/lib, con pruebas):**
1. `src/lib/fichaMembresia.ts` + test:
   - `fechaCorta(iso, hoy)` da «Jue 15 oct», con año solo si es otro año.
   - `montoCorto(n)` da «Bs. 250»; con centavos, «Bs. 250,50».
   - `iniciales(nombre)`.
   - `indicadoresDe` pasa a usar esos formatos y los textos de la spec: «Disponible para pedir 1 h», «Desde Mar 15 sep · vigencia de N días» y «Vence Vie 9 oct».
2. `src/lib/reservas.ts` + test: `presentacionFilaReserva(reserva, ahora, plazoHoras)` devuelve:
   - etiqueta y tono de la pastilla («Por cerrar» si ya pasó y sigue confirmada);
   - la acción sugerida;
   - el texto «Cancelar a pedido · devuelve / consume la hora», calculado con `evaluarCancelacion` y el parámetro `reserva_cancelacion_plazo_horas`.

**Extracción sin cambio de comportamiento:**

3. `src/components/useGestionReserva.ts`: hook nuevo con el estado y los handlers de `GestionReserva.tsx` (l.202-349).
   - Incluye `transicionar`, `confirmarReprogramar`, `guardarCortesia`, las duraciones y los `falta*`.
   - Exporta `etiquetaDestino` y `efectoDestino`.
   - Las acciones del servidor son las mismas.
4. `src/components/GestionReserva.tsx`: usa el hook y conserva su JSX actual tal cual, incluido el modo barra de `/sala`.

**Presentación nueva (`src/components/nuevo/`):**

5. `FilaReserva.tsx`: fila cerrada (`96px | 1fr | pastilla | chevron`) y panel al abrir.
   - Botones de 30 px con radio 8 y la acción sugerida rellena.
   - Reprogramar y Suspender se despliegan dentro del panel, Suspender con motivos en chips.
   - El paso de confirmación con su efecto se mantiene (decisión de Javier).
   - Historial siempre visible, sin «▶ Historial».
   - Textos del mockup donde la acción coincide: «Marcar realizada», «Marcar ausente», «Reprogramar», «Suspender…», «Cancelar a pedido · …», «Cortesía». Los reales donde no hay equivalente, como «Rechazar solicitud».
6. `ChipTitular.tsx`: chip con avatar de 18 px e iniciales.
7. `ui-nuevo.css`, solo bajo `.ui-nuevo`:
   - tokens fijos de la spec;
   - botones del encabezado de 36 px;
   - título de 26 px con `letter-spacing:-.015em`;
   - indicadores en una línea, con gap de 6-8 px;
   - pestañas con padding 10px 12px, activa 600 e inactiva 400;
   - tarjetas con título de 12 px `--fg3` 500 y gap de 10 px;
   - `.n-cols` en `minmax(520px,1fr) 320px` y una columna por debajo de 1100 px;
   - lista: título de 18 px, buscador de 34 px, punto de 7 px y pastilla de estado en la línea 3, a la izquierda;
   - miga «Membresías › Titular · Plan» de 13 px con padding 0 24px;
   - clases nuevas `n-fila-res*`, `n-boton--punteado` y `n-titular`.

**Pantallas de la sección:**

8. `membresias/(lista)/[id]/FichaMembresiaVista.tsx`:
   - fila de pastillas con el ciclo en texto plano;
   - fila de título y acciones (flex, `align-items:flex-end`);
   - `ChipTitular`;
   - tarjetas con `montoCorto` y `fechaCorta`;
   - la miga.
9. `AccionesFicha.tsx`: solo clases.
10. `PestanasFicha.tsx`:
    - cabecera de Reservas en una línea con «+ Nueva reserva» punteado;
    - `FilaReserva` en lugar de `GestionReserva`;
    - filas de Clases, Pagos e Historial con la pastilla de la spec.
11. `page.tsx`, o donde se arma `DatosReservas`: lee `reserva_cancelacion_plazo_horas` de `parametros` con `exigir()`.
12. `components/NuevaReserva.tsx`, solo con `marco="hoja"`:
    - duración y sala en chips, Dónde segmentado, como el mockup;
    - con `marco="pagina"` no cambia nada (`/particulares/44` y `/alquileres/92` iguales).
13. `membresias/(lista)/ListaMembresias.tsx`: estructura de la fila de 3 líneas.

**Se conservan los testids y textos de los e2e:**
- testids: `ficha-membresia`, `ficha-titular`, `saldo-cuenta`, `resumen-reservas`, `boton-nueva-reserva`, `bloque-*`, `fila-membresia`, `.n-punto[data-tipo]`, `.n-fila__nombre`;
- textos: «Disponible para pedir X h», «Contratadas X h», «Más acciones», tabs con `aria-selected`.

## Verificación
- `npm test` (con las pruebas nuevas de `fechaCorta`, `montoCorto`, `iniciales` y `presentacionFilaReserva`), `tsc` y `eslint` limpios.
- Una sola corrida de e2e `membresias-1b` y `membresias-2`. Si algo falla dos veces, paro y te aviso.
- Paridad: el texto visible de `/particulares/44`, `/alquileres/92` y el panel de `/sala` no cambia respecto de `main`.
- Chrome: ficha de una particular contra el mockup lado a lado, una vez a 1440 px y una vez a 1000 px. Reviso encabezado, indicadores en una línea, cabecera de Reservas, filas cerradas con pastilla y acciones solo al abrir. Te paso las dos capturas.
- Para vos, a mano: abrir una reserva y Confirmar/Suspender desde la fila nueva, y mirar la lista.

## Commits
5 (e2e + arreglo del bloqueo) · 6 (lib + hook, sin cambio visual) · 7 (tokens + CSS + encabezado/indicadores/lista) · 8 (FilaReserva + pestañas + hoja Nueva reserva). Después, el PR.
