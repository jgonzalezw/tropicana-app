# H6 — Extensión de membresía (rama `h6-extension-membresia`)

## Contexto
Una particular o un alquiler ya vendido hoy no puede sumar horas. El aviso de `ReservasDeMembresia.tsx:259` dice que esa es «la extensión de membresía (todavía no construida)». Lo que está definido:
- **C3 definiciones v2 §7.3:** sumar horas a una membresía viva, dentro de los márgenes de su plan. Lo extra se cobra con su propia cuota (regla 7).
- **Plan de construcción:** «H6… Migración chica… Acción "Extender" desde la membresía… Design: No».

Hoy el plan guarda solo `extension_modo` (lista|recargo) y `extension_recargo_pct`, con tope en el parámetro `extension_recargo_max_pct`.

**Decisiones de Javier (2026-10-04)** — se anotan en `docs/decisiones/vigentes.md` en el primer commit:
1. **Precio:** el plan marca qué formas de precio permite, entre cuatro:
   - `lista`: tramo de 1 h. En particular, `tarifas_particular` del estilo con horas=1; en alquiler, `sala_tarifas` del paquete de 1 h para `categoria_aplicada` y `alquiler_tamano`.
   - `recargo`: lista más el % del plan, con el tope del parámetro.
   - `prorrata`: `precio_aplicado` / horas originales.
   - `manual`: lo carga el vendedor.

   Si el plan marca una sola, esa queda fija. Si marca varias, el vendedor elige al extender. Si una forma no está disponible (por ejemplo, no hay tramo de 1 h), se explica y no desaparece (calidad 5).
2. **Sin tope de horas.**
3. **Vigencia:** la persona decide. Se propone mantener `fecha_fin` y se puede correr hasta hoy + la vigencia efectiva del plan (`vigenciaDiasEfectiva`). Queda registrado en la extensión, nunca en silencio (regla 5).
4. **Profesor:** mismo criterio, con el snapshot de la venta.
   - `fee_hora`: paga más horas dadas.
   - `pct_margen`: lo cobrado ya incluye la cuota de la extensión. Si el plan descuenta sala, el costo de sala de las horas extra se toma con foto propia (`costoSalaDeVenta`).
   - `monto_fijo`: prorrata, monto fijo / horas originales × horas extra.
5. **Permiso:** `crear` del módulo (`particulares` o `alquileres`), con el mismo alcance propio/todo que hoy. No hace falta un permiso nuevo.

**Reglas que agrego yo:**
- Solo se extiende una membresía **viva**: no completada, con vigencia que no haya terminado (`fecha_fin` ≥ hoy), que no sea de cortesía y sin comisión de tipo `comision` devengada. Si ya se devengó o liquidó, «no se reabre» y se vende una nueva.
- Criterio 2 (avance) sí se puede extender: el avance sigue con los nuevos totales.

## Modelo (migración 0063, con la skill `migracion-segura`)
- `planes.extension_modos text[] not null`. Admite un subconjunto no vacío de `{lista,recargo,prorrata,manual}`, con check de coherencia: si incluye `recargo`, entonces `extension_recargo_pct` no es null. Se completa desde `extension_modo` y después se borra `extension_modo` junto con su check.
- Tabla `membresia_extensiones`:
  - `id`, `membresia_id` (FK) y `cuota_id` (FK).
  - `horas`, `modo_precio`, `precio_hora_base`, `recargo_pct` y `precio_total`.
  - Valores de antes, para auditoría y rollback: `horas_antes`, `fecha_fin_antes`, `fecha_fin_nueva`, `monto_fijo_antes`, `costo_sala_antes`.
  - Fotos propias: `monto_fijo_extra` y `costo_sala_extra`.
  - `registrado_por` y `created_at`.
  - RLS con el mismo patrón que `membresia_salas`. Al final, `notify pgrst, 'reload schema'`.
- **Decisión de diseño:** la membresía acumula los totales vigentes.
  - `horas_contratadas += horas`, `pago_monto_fijo += monto_fijo_extra` y `costo_sala_aplicado += costo_sala_extra`. `fecha_fin` toma la nueva fecha.
  - `precio_aplicado` no se toca: es el snapshot de la venta original.
  - Con esto, el saldo de horas (`saldoMembresia`), `situacionParticular` y `calcularDevengosParticulares` (`src/lib/liquidacion/particulares.ts`) funcionan **sin cambios**, y la extensión guarda el antes y el después.
- Control nuevo en `scripts/control_migracion.sql`:
  - cada extensión tiene su cuota y `cuota.monto_devengado = precio_total`;
  - `horas_contratadas` de la membresía = `horas_antes` de la primera extensión + Σ horas.

## Código
- **`src/lib/extensiones.ts` (puro, con `extensiones.test.ts`):**
  - `precioExtension(modo, {...})`, `montoFijoExtra` y `horasOriginales`;
  - `faltaParaExtension(...)`: una sola validación, compartida por el botón y el servidor (calidad 9).

  Reutiliza `validarRecargoExtension` de `src/lib/planesAlquiler.ts` y `src/lib/planesParticular.ts`, adaptado a `extension_modos`.
- **Planes:** en `src/app/(privado)/planes/ClientePlanes.tsx` (particular ~1104 y alquiler ~1272), el selector segmentado pasa a casillas con las 4 formas, más el % si se marca recargo. Se ajustan también `planes/acciones.ts` (guardar y `topeRecargoExtension`) y los tipos de `src/lib/tipos.ts:435`.
- **Acciones nuevas en `src/app/(privado)/particulares/acciones.ts`:** `previsualizarExtension` y `extenderMembresia`.
  - Usan el resolvedor por tipo de Hito B: módulo, dueño, `alcancePropioDe`.
  - Siguen la secuencia de `venderParticular`/`venderAlquiler` (`inscribir/acciones.ts:1391`, `inscribir/accionesAlquiler.ts:398`): cobro → cuota → pago (motivo `clase_particular`/`alquiler`) → fila de extensión → update de la membresía. Si algo falla a mitad, lo dice («Se registró…, pero falló…»).
  - Revalidan el estado de la membresía viva en el servidor.
- **UI (pantalla nueva sin mockup; aviso según proceso 3, lo marca así el plan de construcción):** componente `src/components/ExtenderMembresia.tsx`, que se abre como panel desde la ficha de `/particulares/[id]` y de `/alquileres/[id]`, sin salir de la ficha.
  - Pide horas (paso 0,5) y forma de precio (solo si hay más de una), y muestra el precio propuesto: editable solo en manual.
  - Pide la nueva fecha de vencimiento: por defecto la actual, con el tope.
  - El cobro usa el mismo bloque que la venta.
  - El botón se deshabilita con `faltaParaExtension`.
  - Después de guardar, el panel se colapsa con un solo aviso (memoria del bug del submit), más `AvisoWhatsapp` al titular o a su persona de contacto, con las horas sumadas, el nuevo saldo, el vencimiento y lo que queda por pagar.
  - En la ficha, la lista «Extensiones» muestra fecha, horas, precio y forma.
  - El texto de `ReservasDeMembresia.tsx:259` se actualiza para apuntar a «Extender».
- **Antes de grabar:** grep de todos los lectores de `precio_aplicado` y `horas_contratadas` (por ejemplo `src/lib/cuentas.ts:168`/`:368` y `liquidacion/preliquidacion.ts:410`), para confirmar que ninguno supone horas = tramo vendido.

## Docs
- Glosario («Extensión»: sacar «se construye en C3»), `decisiones/vigentes.md` (las 5 decisiones), `ESTADO.md` y `RETOMAR.md` (cierre).
- Corregir el punto 2 desactualizado de RETOMAR: Hito B ya está hecho.

## Verificación (dev `hyhijzuomqpylcmrzdvw`, sin pedir permiso)
1. `npm test` (extensiones y las de liquidación existentes), `npx tsc --noEmit` y `npm run lint`.
2. Aplicar 0063 en dev y correr `control_migracion.sql`. Comprobar que los planes existentes quedaron con `extension_modos` = su modo anterior.
3. En el navegador, con `npm run dev:limpio`:
   - plan con una sola forma (queda fija) y plan con varias (elige el vendedor);
   - extender una particular `fee_hora`, una `pct_margen` con sala y una `monto_fijo`, y un alquiler;
   - en cada caso, ver la cuota en Caja, el saldo de horas y la reserva nueva agendable;
   - pre-liquidación con los montos esperados;
   - casos bloqueados (membresía completada, vencida, cortesía, ya devengada) con su mensaje;
   - 375 px.
4. El pase a producción va solo con el OK de Javier.
