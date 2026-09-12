# Tropicana — decisiones tomadas y decisiones postergadas

Este archivo se carga en **toda** sesión (vía `CLAUDE.md`, junto con
`REGLAS.md`). Existe por un motivo concreto: Javier no tiene cómo acordarse de
todo lo que se decidió y quedó para después, y sin registro esas decisiones se
pierden y se vuelven a discutir, o peor, se contradicen sin que nadie lo note.

**Cómo se usa, y no es opcional:**

1. Una decisión **vigente** se respeta siempre. Solo cambia con **otra decisión
   explícita** de Javier, y entonces se edita acá con la fecha y el porqué.
   Nunca se cambia "sobre la marcha" ni porque en el momento parezca mejor.
2. Toda decisión **postergada** vive en la tabla de abajo con su **disparador**:
   cuándo conviene hacerla y qué la vuelve urgente.
3. **Todo plan que se le proponga a Javier abre mostrando el backlog** de
   decisiones postergadas que ese plan toca o vuelve más caras. Si ninguna
   aplica, se dice "ninguna" — pero se dice.
4. Cuando se cumple el disparador de una decisión postergada, **se avisa**, aun
   si nadie preguntó.

---

## 1. Decisiones postergadas (backlog)

> **Prioridad vigente (Javier, 2026-09-12).** *"D1 y D2 esperan."* Lo que manda
> es lo que Natalia necesita: **gestión de clases particulares** (rebanada 2D) y
> **validar/reservar la disponibilidad de la sala** (Paso 5). Las dos van juntas
> —vender una hora sin validar la sala es vender dos veces la misma hora—, así
> que atenderlo implica **adelantar el Paso 5**, entero o en una versión mínima.
> Eso destraba **D5, D6 y D7**, cuyos disparadores ya se cumplieron.


| # | Decisión | Estado | Por qué se postergó | Disparador: cuándo hacerla |
| --- | --- | --- | --- | --- |
| D1 | **Unificar el nombre de la membresía en lo YA EXISTENTE.** La dirección **ya está decidida** (ver 1.b): de acá en adelante todo campo nuevo es `membresia_id`. Lo que queda pendiente es **migrar lo viejo**: renombrar `inscripcion_id` → `membresia_id` en `asistencias`, `cuotas`, `pagos`, `corrimientos_ciclo` e `inscripcion_cursos`, y la tabla `inscripciones` → `membresias`. | **Pendiente — Javier decidió el 2026-09-12 que ESPERA** | El renombre toca 9 tablas, RLS, todo el código y el script de refresh. Javier (2026-09-12): *"Dejemos para después las correcciones de lo existente"*, con los particulares y la sala como prioridad operativa. | Su disparador original —"antes de que el pase a producción se haga grande"— **ya se cumplió dos pases seguidos** (0023–0030 y 0032–0033) y **se pospuso igual, a sabiendas**. Vuelve a la mesa cuando baje la urgencia de 2D/Paso 5. Controlado por el **control 15**, que da REVISAR a propósito y **va a seguir dándolo**, porque cada campo nuevo en `membresia_id` no reduce la cuenta de grafías hasta que lo viejo se migre. |
| D2 | **Sacar el repo de OneDrive** (`C:\Users\Javier\onedrive\natalia\tropicana-app` → p. ej. `C:\dev\tropicana-app`). **Es la única cura**: se evaluó mandar la carpeta de build afuera con `distDir` y la doc de Next lo prohíbe — *"distDir should not leave your project directory"*. No hay arreglo por configuración. **El motivo por el que estaba en OneDrive era el respaldo ante falla de disco** (Javier, 2026-09-12), y ese motivo está cubierto: el código vive en GitHub y se restituye con un `git clone`. Lo que OneDrive sí cubría y git **no** es `.env.local` (ignorado por `.gitignore`, y con razón) y los `validacion_*.xlsx`. Antes de mover la carpeta, esas dos cosas necesitan su propio lugar — el `.env.local` en un gestor de contraseñas, no en otra carpeta. | **Pendiente — Javier decidió el 2026-09-12 que ESPERA** | No urge y corta el trabajo en curso. Javier (2026-09-12): *"D1 y D2 esperan"*. | **Ya costó tres veces** (`2a26010`, `8fb648c`, y el 404 de `/liquidaciones/2`). Mitigado, no resuelto: `npm run dev` avisa cuando el repo está en una carpeta sincronizada, y `npm run dev:limpio` borra la build en un comando. Hacerlo en el próximo hueco. |
| D3 | **Renombrar `ClienteVentas.tsx`** a algo que diga lo que hace (`PestanasVenta` / `MostradorVenta`). El nombre indujo a Javier a creer que había otra pantalla de ventas. | Pendiente | Cosmético; se hizo en medio de un diagnóstico. | Junto con D1, que es el mismo tipo de trabajo (renombres). |
| D4 | **Generalizar el acceso al detalle**: hipervínculo o botón tipo "ojo", igual en toda lista de entidades. Hoy está suelto en Caja y en Alumnos. | Pendiente (pedido de Javier, 2026-09-08) | Es una decisión de diseño transversal: conviene que pase por Design. | Cuando se defina con Design, o cuando la tercera pantalla necesite el mismo gesto. |
| D5 | **Clasificar mejor el motivo del cobro** en el recibo: Membresía, Clase Particular, Clase de Prueba, Alquiler, Taller, Venta Producto, Ajuste. | **Pendiente — DISPARADOR CUMPLIDO** (2026-09-12) | Se resolvió lo urgente (que el motivo elegido no se descarte). | Era "cuando entren los otros tipos de servicio — Paso 2D". **Se cumplió el 2026-09-12**: Natalia pide los particulares con urgencia. En cuanto se venda el primero, el catálogo de motivos se queda corto solo. |
| D6 | **Duración de la clase (`cursos.duracion_min`)** — no existe, y la agenda de sala la necesita para dibujar bloques. **Sin duración no hay bloque que validar**: una clase "a las 19:00" no choca con nada si no se sabe cuánto dura. | **Pendiente — DISPARADOR CUMPLIDO** (2026-09-12) | Apareció al planificar 2D. | Era "al arrancar la agenda de sala". **Se cumplió el 2026-09-12**: Natalia pide validar la disponibilidad de la sala. Es prerrequisito técnico de esa validación. |
| D7 | **¿Puede existir una reserva de sala sin paquete vendido?** Sin responder. Define si la agenda es un **calendario libre** (se reserva y después se cobra) o el **reflejo de lo ya vendido**: son dos productos distintos. Va con una segunda pregunta de alcance: **Paso 5 completo (agenda visual) o validación mínima de choque dentro de 2D**. | **Pendiente de decisión — DISPARADOR CUMPLIDO y BLOQUEA** (2026-09-12) | Idem D6. | Era "al arrancar la agenda de sala". **Se cumplió el 2026-09-12** con el pedido de Natalia. **No se puede empezar la sala sin responderla.** |
| D8 | **Pantalla "Precios y Paquetes" como punto único de los precios base.** Javier (2026-09-11): los tramos de precio por cantidad de clases —hoy definidos en la pantalla de Cursos— van a una pantalla propia, diseñada con Design, con una pestaña por bloque (entre ellas, valores de clase de prueba y tramos de precio por cantidad de clases). **De esos tramos** sale el valor unitario de cada clase para el precio referencial. Regla que la gobierna: **el precio pleno es por 4 semanas del calendario normal del curso** — 8 clases si el curso es de dos por semana. La pantalla unifica en un solo punto todas las definiciones de precio base de la aplicación, y desde ahí se cotiza y se adopta el precio de cursos, planes y ofertas especiales. | Pendiente (mejora el diseño; requiere compatibilizarse con el motor de planes, que se definió después) | Se definió **antes** del motor de planes y hay que compatibilizar las dos cosas. Hoy estamos en medio de la clase de prueba. | Junto con Design, después de cerrar la clase de prueba. **Antes** de cargar precios nuevos en producción: cada precio que se cargue con el modelo viejo es un dato más a migrar. |
| D11 | **Inscribir a los acompañantes de una prueba grupal, con su crédito.** Hoy, en una prueba grupal, solo el **titular** puede convertir y se le acredita **su parte** (opción b: lo pagado ÷ personas). La parte de los acompañantes **existe pero no se puede reclamar**: no tienen nombre en el sistema. Javier: *"lo lógico es que el resto queda para cuando se inscriban los otros en plazo… haciendo referencia a algún ID que se entregue al momento de la inscripción, o referir al titular aunque no se haya inscrito… pero debe ir descontando la cantidad de beneficiarios. Si cualquiera deja pasar la fecha, igual lo pierde."* | **Pendiente** (2026-09-11) | Los acompañantes no tienen identidad en el modelo; darles una es un cambio de modelo, no un ajuste. Javier: *"dejarlo en b por ahora sin la inscripción de los restantes"*. | Cuando **aparezca el primer caso real** (un acompañante que quiere inscribirse y reclamar su parte), o en el paso siguiente si se prioriza. **Cada prueba grupal que se venda mientras tanto es un crédito que alguien puede venir a reclamar y no vamos a poder darle.** |
| D12 | **Los estilos/especialidades tienen que ser catálogo, no parámetro.** Hoy `especialidades` es un parámetro de texto con los estilos separados por coma (`Salsa,Bachata,Zumba,Urbano,Heels`), y lo mismo pasa con `medios_pago`. Un catálogo se aumenta y se corrige; un parámetro de texto se reescribe entero a mano y no tiene ni id ni orden ni "activo". Javier (2026-09-11): *"Considero que los estilos o especialidades deberían ser valores de catalogo no de parámetros, y deben poderse aumentar o corregir."* | **Pendiente** (2026-09-11) | Es una migración de datos (parámetro → filas de catálogo) más las pantallas que los leen. Estamos cerrando la clase de prueba. | Junto con D13, que es la otra mitad del mismo problema. **Antes** de que alguien cargue estilos nuevos en producción: cada uno que se cargue como texto es un dato más a migrar. |
| D13 | **Aumentar un valor de catálogo sin salir de la operación.** En las listas de las pantallas, el usuario tiene que poder agregar un valor al catálogo mientras está haciendo otra cosa: cargando un profesor, poder agregar un estilo que no está; ídem en cursos. Hoy hay que abandonar la pantalla, ir a configurar y volver a empezar. Javier (2026-09-11): *"para versión posterior… el usuario pueda aumentar valores a la lista de algún catalogo mientras realiza una operación."* | **Pendiente — versión posterior** (2026-09-11) | Necesita que los catálogos existan de verdad primero (D12) y es un gesto transversal: conviene definirlo una vez con Design y montarlo igual en todos lados (regla de proceso 4), como D4. | Después de D12, y junto con D4 —que es el mismo tipo de decisión: cómo se le ofrece un gesto al usuario en toda lista. |
| D19 | **Al reemplazante no se le deja la plata para cobrar por caja.** D17b le **descuenta** al titular lo que costó el reemplazo, pero **no genera la contrapartida**: lo que hay que pagarle al suplente no aparece en ninguna lista. Se puede pagar hoy, a mano, con el motivo `otro_pago_profesor` (`pagos.profesor_id` existe desde la 0006), pero hay que acordarse: `lineasPorCobrar` arma solo el bucket `cuotas` y **no existe una lista "Por pagar"**. La asimetría es la que molesta: al titular se le debita solo, al suplente se le paga de memoria. | **Pendiente** (2026-09-12) | La lista "Por pagar" es el paso **2F** (egresos en Caja), que no arrancó. Meterla ahora es abrir 2F a mitad de D17b. | **Apenas se registre el primer reemplazo real**, o al arrancar 2F —lo que pase antes. Cada reemplazo que se cargue mientras tanto es plata que alguien tiene que recordar pagar. |
| D9 | **La tarjeta de confirmación de la venta tiene que ser específica**: plan + monto + cursos + días + fecha de la primera clase + si es clase de prueba. Hoy dice poco y hubo que ir a la base para saber qué había quedado. | Pendiente (pedido de Javier, 2026-09-11) | Se arregló lo urgente (que mostrara **todas** las fechas y el plural). Lo demás es un rediseño del mensaje. | Junto con D4, que también es cómo se le muestra una entidad a la persona. |

## 1.b Decisiones tomadas que están pendientes de construir

No son backlog: Javier ya decidió que **así se debe trabajar**. Están acá para
que no se pierdan hasta que el código las alcance.

| # | Decisión | Estado |
| --- | --- | --- |
| **El nombre de la membresía, de acá en adelante** (mitad de D1) | **Todo campo nuevo que apunte a `inscripciones.id` se llama `membresia_id`.** Nunca más `inscripcion_id` en algo nuevo, ni una tercera grafía. Javier (2026-09-12): *"en adelante usa siempre el mismo nombre para membresía. Dejemos para después las correcciones de lo existente."* El nombre elegido es el del **concepto** —así se llama en el glosario, en los documentos y en la conversación— y la regla del proyecto es un concepto, un nombre. | **VIGENTE desde 2026-09-12.** Todavía no hay ningún campo nuevo que la estrene: la última tabla creada, `descuentos_liquidacion` (0032), cuelga de `sesiones`, no de la membresía. La estrena el primero que apunte a `inscripciones.id`. Migrar lo viejo es **D1**. |
| **Vigencia del curso** (ex D15) | Un curso tiene **fecha de activación y de baja**. El registro de asistencia es exigible **solo** entre esas fechas: fuera de ellas nunca se pide y nada queda "sin registrar". No se pueden vender planes ni pruebas con un curso inactivo — eso **inactiva el plan**. Si aparecen clases retroactivas, la fecha de activación **se corrige** (el usuario la ajusta antes de inscribir y la revalida): que haya clase retroactiva significa que sí había profesor, alumno y clase. Javier (2026-09-12): *"No lo veo como backlog. Es así como se debe trabajar."* Y el marco general: **todo lo retroactivo es una excepción de la operativa, no el día a día.** | **CONSTRUIDA** en dev el 2026-09-12 (migración 0033 + `src/lib/vigencia.ts`). Falta que Javier valide y dé el OK del pase. |

**El ejemplo que estaba acá era falso, y conviene decirlo:** se afirmaba que
"Salsa y Bachata Inicial tiene su primera sesión el 31/08 y el conteo le
atribuye 8 clases de agosto". Medido el 2026-09-12 contra dev: el **31/08 es su
fecha de creación en el sistema**; su primera sesión y su primera asignación son
del **03/08**. Ese curso sí corría en agosto. El agujero que la vigencia cierra
es real —el calendario no tenía principio— pero no se demostraba con ese caso.
*(Regla de calidad 3: antes de dar por hecho un diagnóstico, mirar el dato.)*

## 2. Decisiones vigentes que ya se violaron una vez

Las que ya costaron. Se listan aparte porque el antecedente es el que evita la
recaída.

| Decisión | Vigente desde | Cómo se violó | Qué la protege ahora |
| --- | --- | --- | --- |
| **El fin de ciclo lo corre la suspensión** (regla de negocio 4) | siempre | Se afirmó que el motor no tocaba `fecha_fin`, tras un `grep` que no encontró el campo. | Glosario de `REGLAS.md` + controles 9 y 10. |
| **El corrimiento no toca el plazo de pago de la cuota** | 2026-09-10 | Se arrastró la definición de la etapa 1. | Glosario de `REGLAS.md`. |
| **Un fallo no se disfraza de ausencia** (calidad 1) | 2026-09-11 | Dos veces: el recibo 404 y la venta sin planes. | `exigir()` + `error.tsx` + regla de calidad 1. |
| **Un concepto, un nombre** | siempre (glosario) | Se agregó `membresia_anterior_id` en la 0023, con el resto del esquema en `inscripcion_id`. | **Control 15** + D1. |
| **El padrón no mira el estado de la venta** (regla de negocio 2) | siempre | `cargarPadron` filtraba por `estado === "activa"`, así que una membresía `completada` desaparecía del padrón de sus propias clases pasadas. La clase se veía vacía y se suspendía "sin alumnos", borrándole al profesor el peso de esa clase. Pasó con Heels en agosto. | Corregido el 2026-09-12, y el consumo se pregunta **al día** que se mira, no con los totales de hoy. |
| **`asistencia_semanas_retro` vuelve a 2** (D10, cerrada) | 2026-09-12 | Se subió a 8 el 11/09 para alcanzar agosto y validar la prorrata. Quedó en 8 más de un día: mientras tanto, Natalia podía editar asistencias de hace dos meses. | Javier la devolvió a **2** el 2026-09-12, verificado en dev. |
| **Quién dictó la clase no se supone** (regla de negocio 20) | 2026-09-12 | `sesiones.profesor_id` existía y se llenaba por inferencia: se estampaba la asignación **abierta**, sin mirar la fecha de la clase. O sea, el campo del hecho se completaba con una conjetura, y encima con la equivocada. | Corregido en 0030 (D17a): se elige al registrar la asistencia, con el titular del día a la vista y el reemplazo obligatorio si el curso está desasignado. |
| **La comisión es de quien dictó** (regla de negocio 10) | siempre | El cálculo leía solo las asignaciones vigentes (`hasta is null`), así que un cambio de titular a mitad de mes le daba el período entero al nuevo y el anterior no cobraba las clases que sí dictó. Lo detectó Javier el 2026-09-12 al revisar D16. | Corregido: el reparto usa el **historial** de asignaciones (migración 0029) + **control 20**. |
| **La config que el código lee nace en una migración** (calidad 7) | 2026-09-12 | `liquidacion_reparto_pantalla` y `_impreso` se crearon a mano en dev; la 0028 los daba por existentes y solo los actualizaba. El pase a producción no los llevó: 4 parámetros en dev, 2 en producción. Lo detectó Javier al recorrer la pantalla. | Migración **0031** (idempotente, aplicada en las dos bases) + regla de calidad 7. |
| **Una fecha de la que depende plata no se asigna sola** (regla de negocio 5) | 2026-09-12 | La primera versión de la vigencia del curso estampaba `vigente_hasta = hoy` al desactivar. De esa fecha depende cuántas clases pone el curso en el prorrateo: ponerla por default es decidir plata por omisión. Lo frenó Javier antes de que se validara: *"es delicada como para que la asignes sin intervención."* | La baja pide la fecha y la persona la confirma; una baja hacia atrás por encima de clases o membresías en curso **se rechaza** nombrando el tope, y el mismo guard corre al editar la ficha. |
| **Un valor con alternativas se elige de una lista** (calidad 6) | 2026-09-11 | Los dos parámetros del reparto (`liquidacion_reparto_pantalla` / `_impreso`) quedaron como texto libre, con otros parámetros ya resueltos con desplegable. De paso abrieron un grupo "Liquidaciones" cuando ya existía "Liquidación". | `parametros.opciones` (0028) + validación en el servidor + regla de calidad 6. |

## 3. Orden del pase y del refresh dev↔prod

El orden importa y equivocarlo borra trabajo. Vale para **todo** cambio con
migración — D8 incluida.

1. **Migración + código en dev.** La migración la aplica la sesión; Javier no
   pega SQL a mano.
2. **Javier valida en dev.** Nada avanza sin esto.
3. **OK explícito de Javier** (regla de proceso 1). Validar en dev no lo
   dispara.
4. **Migración en producción**, y recién entonces el deploy del código (Vercel
   publica solo al mergear a `main`). Si el código llega antes que la
   migración, la pantalla lee columnas que no existen y se cae entera.
5. **Correr `scripts/control_migracion.sql` en producción** y comparar con lo
   que dio en dev.
6. **Recién después, si hace falta, refrescar dev desde prod.**

> **La trampa:** `refresh-dev.mjs` **vacía** las tablas de dominio de dev y las
> reemplaza con las de producción. Todo lo que se haya cargado en dev para
> probar —planes, precios de prueba, inscripciones— **se pierde**. Nunca
> refrescar entre los pasos 1 y 4: se pierde justo lo que se está por validar.
> Los catálogos y parámetros sí se sincronizan por clave y sin borrar, así que
> una clave que solo existe en dev sobrevive.

## 4. Pendiente de pase a producción

Lo que está **solo en dev** y espera el OK explícito de Javier (regla de
proceso 1). No es un backlog de decisiones: es el estado del release.

- **Migraciones 0023–0030: APLICADAS EN PRODUCCIÓN el 2026-09-12**, con el OK
  explícito de Javier. Ningún dato de dominio se modificó (detalle y controles
  en `docs/ESTADO.md`).
- **Código desplegado**: `main` actualizado `31da6ae..ed44fbd` el 2026-09-12
  (fast-forward, 47 commits). Vercel publica solo al mergear.
- **Control 3 en producción: resuelto.** Daba 2 (membresías 23 y 24, Zumba);
  al regrabarse esas asistencias el motor recalculó los contadores. Verificado
  el 2026-09-12: da **0**. (Dev sigue en **1**, desvío propio de dev.)
- **Migraciones 0032 y 0033: APLICADAS EN PRODUCCIÓN el 2026-09-12**, con el OK
  explícito de Javier ("avanzá con las migraciones"). Las dos son aditivas y no
  modificaron ningún dato de dominio. Los 21 controles dan **OK**, salvo el 15
  —la deuda D1— que da REVISAR a propósito. Detalle en `docs/ESTADO.md`.
- **PENDIENTE: el deploy del código.** `main` sigue en `5f547f0`; el código de
  D17b y de la vigencia está en la rama, sin mergear. Producción tiene el
  **esquema nuevo con el código viejo**, que es el estado seguro (las columnas
  nuevas simplemente no se leen). Falta el OK para mergear a `main`, que es lo
  que dispara Vercel.
