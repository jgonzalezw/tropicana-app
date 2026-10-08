<!-- Calidad del código y controles: texto literal de docs/REGLAS.md (partido en el recorte del 2026-10-04) -->

## 4. Calidad del código

1. **Un fallo nunca se disfraza de ausencia.** Si el dato es necesario para que
   la pantalla haga su trabajo, un error de lectura **se muestra**; nunca se
   convierte en "no hay nada". El patrón cómodo de Supabase
   —`const { data } = await sb.from(...)`— tira el error, y después `data ?? []`
   hace que la pantalla mienta: dice "no hay planes" cuando la consulta se
   rompió. Usar **`exigir()`** de `@/lib/datos`; el `error.tsx` de `(privado)`
   lo muestra con su mensaje. Si vacío es un resultado legítimo (contar
   dependencias, un dato opcional), no hace falta.
   *Costó dos veces: el recibo que daba 404 sobre un pago que existía, y la
   venta que se quedaba sin planes. Las dos veces se fue el tiempo buscando el
   problema donde no estaba.*
2. **Agregar una columna al `select` rompe la consulta entera** si la API
   todavía no conoce la columna. Después de una migración que agrega columnas y
   se empiezan a leer, correr `notify pgrst, 'reload schema';`.
3. **Antes de dar por hecho un diagnóstico, mirar el dato.** Las dos veces que
   se perdió tiempo fue por afirmar una causa sin medirla. Medir es barato:
   una consulta de lectura contra la base responde en segundos.
4. **Si un cambio no aparece en pantalla, descartar el build antes que el
   código.** El orden correcto es: confirmar el archivo en disco
   (`Select-String -Path <archivo> -Pattern <texto nuevo>`), cortar el server,
   y arrancar con **`npm run dev:limpio`** (borra la build y levanta, en un
   comando y en cualquier sistema), recargando con Ctrl+F5. Recién si después
   de eso sigue igual, el problema es el código.
   **Síntoma que engaña:** no es solo "el cambio no aparece" — también una ruta
   que existe y devuelve **404 propio de Next**, llevándose puesto el app-shell.
   Un 404 así es de resolución de ruta, no de datos: ninguna pantalla de este
   proyecto devuelve 404 cuando no encuentra un registro.
   *Costó dos veces (commits `2a26010` y `8fb648c`): las dos se fue el tiempo
   revisando datos, RLS y componentes que estaban bien. El repo vivía dentro
   de OneDrive, que sincroniza por debajo y pelea con el watcher de Turbopack
   —no hay arreglo por configuración, la doc de Next prohíbe sacar `distDir`
   del proyecto—. **La causa de raíz se sacó el 2026-09-16**: el repo se mudó
   a `D:\dev\tropicana-app`, fuera de OneDrive (D2, cerrada). Desde
   2026-09-11 `npm run dev` **avisa** cuando detecta el repo dentro de una
   carpeta que sincroniza sola, y el aviso queda por si vuelve a pasar.*
5. **Una capacidad que no está disponible se explica; no desaparece.** Es la
   regla 1 aplicada a la pantalla. Si una pestaña, un botón o una opción se
   ocultan cuando falta su configuración, "todavía no lo configuré" y "algo se
   rompió" se ven idénticos: no está. Se muestra igual, deshabilitada o con un
   panel que diga **qué falta y dónde cargarlo**.
   *Costó la pestaña "Clase de prueba": se ocultaba sola y no había forma de
   saber desde la pantalla si faltaba el precio del curso o si la consulta
   había fallado.*
6. **Un valor con alternativas se elige de una lista; nunca se escribe a mano.**
   Vale para parámetros, catálogos y cualquier campo con un conjunto cerrado de
   valores. Escribirlo a mano deja pasar `compactoo`, que no falla: cae al
   default y la aplicación se comporta distinto sin decir por qué — la regla 1
   otra vez. La lista la sirve el dato (`parametros.opciones`), no el código
   (regla de negocio 13), y **el que valida es el servidor**: el desplegable
   ayuda, no decide. Dejar unos campos con lista y otros a mano es peor que
   ninguna: enseña que la lista no significa nada.
   *Pedido de Javier, 2026-09-11: "SIEMPRE que se tengan valores alternativos a
   elegir, debes poner un control que permita hacerlo desde una lista de
   opciones… el que dejes algunos para escritura manual es baja calidad de
   desarrollo e inconsistente."*

7. **Todo parámetro o valor de catálogo que el código lea nace en una
   migración.** Cargarlo a mano en dev —con SQL suelto o desde la pantalla—
   lo deja fuera de producción **para siempre**: el pase lleva migraciones, no
   filas sueltas. Y no hay control que lo note, porque cada base se mira sola.
   El síntoma es engañoso: sin el parámetro el código cae a su default y no
   falla nada visible, pero la configuración **no existe** y por lo tanto no se
   puede cambiar — una capacidad que no está y no lo dice (regla 5).
   *Costó una vez: `liquidacion_reparto_pantalla` y `_impreso` se crearon a
   mano en dev; la migración 0028 los daba por existentes y solo los
   actualizaba. El pase del 2026-09-12 no los llevó, y la pantalla de
   Parámetros mostró 4 en dev y 2 en producción. Lo corrigió la **0031**.*

8. **Toda pantalla arranca en el mismo borde: se arma con `<Pagina>`**
   (`src/components/Pagina.tsx`), **nunca** con su propio contenedor ni con
   `mx-auto`. `<Pagina>` fija el padding y el borde izquierdo; cada pantalla
   elige solo su ancho máximo (`ancho="lg" … "6xl"`). Una barra fija abajo
   arranca después de la barra lateral (`min-[900px]:left-64`) y alinea sus
   botones con el mismo padding, sin centrarlos. Lo hace cumplir
   `src/lib/pantallas.test.ts`: falla si aparece un `mx-auto` o un contenedor
   de pantalla propio.
   *Costó dos veces el mismo día (Inscribir y Cuenta del alumno,
   2026-09-24): cada pantalla tenía su contenedor y algunas se centraban
   solas. Javier: "estandarizar que siempre se comporten igual".*
9. **Ningún botón de guardar se puede apretar con un dato obligatorio sin
   cargar.** El servidor siempre valida (regla de calidad 1), pero **el
   botón además queda deshabilitado** mientras falte algo — no alcanza con
   que el clic muestre el error recién después: eso dejaba que Jhonny
   vendiera una particular sin elegir sala, o guardara una plantilla sin
   estilo ni forma de pago, y se enterara del error con el formulario ya
   armado. La validación **es una sola función pura**, compartida por el
   cliente (para deshabilitar y decir qué falta) y el servidor (para
   decidir) — nunca dos copias de la misma regla que puedan desalinearse.
   Ejemplos ya hechos así: `puedeConfirmar` en `ClienteInscribir.tsx`,
   `puedeVender` en `inscribir/VenderParticular.tsx` (con `validarReservaSala`
   corriendo también del lado servidor) y `puedeGuardar` en
   `planes/ClientePlanes.tsx` (con `validarDatosPlan`, en `src/lib/planes.ts`,
   importada tal cual por `planes/acciones.ts`).
   *Costó en C3 H1 y H2 (2026-09-26): las dos pantallas nuevas dejaban
   apretar "Vender"/"Crear plan" con la sala, el profesor o el estilo sin
   elegir, y el error recién aparecía después del clic. Javier: "todas las
   pantallas creadas en H1 y H2 deben tener los datos completos antes de
   guardar... debe ser una regla siempre, antes lo hacías, ahora has
   relajado la calidad." Corregido el mismo día; queda como regla general,
   no solo para esas dos pantallas.*

10. **Una definición de liquidación vive en un solo lugar, y todo flujo la usa.**
    Criterios de liquidación (sigla, texto), avance de una membresía, cuenta del
    alumno (precio, descuento, pagado, saldo) y el cálculo del devengo salen de
    una pieza compartida; el flujo (cierre normal, retiro, simulación) solo
    cambia el objetivo y qué se hace con el resultado. Antes de definir algo
    de esto, buscar si ya existe y reutilizarlo; si no sirve tal cual, se
    ajusta la pieza, no se escribe otra al lado. *Costó I-011 (2026-10-08): el
    retiro medía el avance con `clases_hechas` (solo presentes) mientras
    Asistencia contaba clases dictadas, y los criterios tenían cuatro
    catálogos distintos. Javier: "todos los cálculos de liquidación deben ser
    realizados por un solo proceso estandarizado, independientemente del
    flujo."* **Vale también para lo que se muestra:** toda exposición de
    liquidación (retiro, pre-liquidación, simulación, Liquidaciones,
    comprobante) usa la misma línea (`lineas.ts`), el mismo formateador
    (`formatoLiquidacion.ts`) y las mismas tablas (`TablasLineas.tsx`,
    `imprimirLineas.ts`); el flujo solo elige columnas y rótulos. Lo que no
    entra al cálculo (regla 17, falta un plan, un cobro) se muestra arriba, en
    «Hay que resolver», nunca al final ni escondido. *Costó L-01 (2026-10-08):
    el retiro no mostraba las multicurso ya liquidadas que la liquidación del
    período sí mostraba, y las excepciones quedaban fuera de vista.*

## 5. Controles

`scripts/control_migracion.sql` — controles de solo lectura que verifican
varias de estas reglas contra cualquiera de las dos bases. Cuando una regla se
pueda chequear, va ahí: una regla en prosa se pierde, una que rompe un control
no.
