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

| # | Decisión | Estado | Por qué se postergó | Disparador: cuándo hacerla |
| --- | --- | --- | --- | --- |
| D1 | **Un solo nombre para la membresía.** Hoy conviven `membresia_id` (`comisiones_devengadas`, `liquidacion_items`, `inscripciones.membresia_anterior_id`) e `inscripcion_id` (`asistencias`, `cuotas`, `pagos`, `corrimientos_ciclo`, `inscripcion_cursos`) para la **misma** llave a `inscripciones.id`. Falta que Javier elija dirección: **(a)** todo a `membresia` (tabla incluida) o **(b)** todo a `inscripcion_id`. | **Pendiente de decisión** (2026-09-11) | Estamos a mitad del Paso 2 con la clase de prueba sin validar; el renombre toca 9 tablas, RLS, todo el código y el script de refresh. Mezclarlo ahora junta dos riesgos que conviene tener separados. | Apenas cierre la clase de prueba (Pasos E, F, G), y **antes** de que el próximo pase a producción se haga grande. Controlado por el **control 15**. |
| D2 | **Sacar el repo de OneDrive** (`C:\Users\Javier\onedrive\natalia\tropicana-app` → p. ej. `C:\dev\tropicana-app`). **Es la única cura**: se evaluó mandar la carpeta de build afuera con `distDir` y la doc de Next lo prohíbe — *"distDir should not leave your project directory"*. No hay arreglo por configuración. | **Pendiente — disparador ya cumplido** | No urge y corta el trabajo en curso. | **Ya costó tres veces** (`2a26010`, `8fb648c`, y el 404 de `/liquidaciones/2`). Mitigado, no resuelto: `npm run dev` avisa cuando el repo está en una carpeta sincronizada, y `npm run dev:limpio` borra la build en un comando. Hacerlo en el próximo hueco. |
| D3 | **Renombrar `ClienteVentas.tsx`** a algo que diga lo que hace (`PestanasVenta` / `MostradorVenta`). El nombre indujo a Javier a creer que había otra pantalla de ventas. | Pendiente | Cosmético; se hizo en medio de un diagnóstico. | Junto con D1, que es el mismo tipo de trabajo (renombres). |
| D4 | **Generalizar el acceso al detalle**: hipervínculo o botón tipo "ojo", igual en toda lista de entidades. Hoy está suelto en Caja y en Alumnos. | Pendiente (pedido de Javier, 2026-09-08) | Es una decisión de diseño transversal: conviene que pase por Design. | Cuando se defina con Design, o cuando la tercera pantalla necesite el mismo gesto. |
| D5 | **Clasificar mejor el motivo del cobro** en el recibo: Membresía, Clase Particular, Clase de Prueba, Alquiler, Taller, Venta Producto, Ajuste. | Pendiente (Javier: *"Dejemos eso para una mejora posterior"*) | Se resolvió lo urgente (que el motivo elegido no se descarte). | Cuando entren los otros tipos de servicio — Paso 2D (particulares, alquiler, talleres). Ahí el catálogo actual se queda corto solo. |
| D6 | **Duración de la clase (`cursos.duracion_min`)** — no existe, y la agenda de sala la necesita para dibujar bloques. | Pendiente | Apareció al planificar 2D. | Al arrancar la agenda de sala (2D). |
| D7 | **¿Puede existir una reserva de sala sin paquete vendido?** Sin responder. | Pendiente de decisión | Idem D6. | Al arrancar la agenda de sala (2D). |
| D8 | **Pantalla "Precios y Paquetes" como punto único de los precios base.** Javier (2026-09-11): los tramos de precio por cantidad de clases —hoy definidos en la pantalla de Cursos— van a una pantalla propia, diseñada con Design, con una pestaña por bloque (entre ellas, valores de clase de prueba y tramos de precio por cantidad de clases). **De esos tramos** sale el valor unitario de cada clase para el precio referencial. Regla que la gobierna: **el precio pleno es por 4 semanas del calendario normal del curso** — 8 clases si el curso es de dos por semana. La pantalla unifica en un solo punto todas las definiciones de precio base de la aplicación, y desde ahí se cotiza y se adopta el precio de cursos, planes y ofertas especiales. | Pendiente (mejora el diseño; requiere compatibilizarse con el motor de planes, que se definió después) | Se definió **antes** del motor de planes y hay que compatibilizar las dos cosas. Hoy estamos en medio de la clase de prueba. | Junto con Design, después de cerrar la clase de prueba. **Antes** de cargar precios nuevos en producción: cada precio que se cargue con el modelo viejo es un dato más a migrar. |
| D10 | **Volver `asistencia_semanas_retro` a 2 en dev.** Se subió a **8** el 2026-09-11 para poder alcanzar las clases de agosto desde Asistencia y validar la prorrata (E) y el cierre de período (regla 16). Es config de dev, no llega a producción. *No se capturó el valor anterior antes de sobrescribirlo; el default del código es 2.* | **Pendiente** (pedido explícito de Javier) | Sin ampliarla, la pantalla no deja navegar a agosto y las validaciones no se pueden hacer. | **Apenas Javier termine de validar E y la regla 16.** Dejarla en 8 hace que Natalia pueda editar asistencias de hace dos meses, que no es lo que se quiere. |
| D11 | **Inscribir a los acompañantes de una prueba grupal, con su crédito.** Hoy, en una prueba grupal, solo el **titular** puede convertir y se le acredita **su parte** (opción b: lo pagado ÷ personas). La parte de los acompañantes **existe pero no se puede reclamar**: no tienen nombre en el sistema. Javier: *"lo lógico es que el resto queda para cuando se inscriban los otros en plazo… haciendo referencia a algún ID que se entregue al momento de la inscripción, o referir al titular aunque no se haya inscrito… pero debe ir descontando la cantidad de beneficiarios. Si cualquiera deja pasar la fecha, igual lo pierde."* | **Pendiente** (2026-09-11) | Los acompañantes no tienen identidad en el modelo; darles una es un cambio de modelo, no un ajuste. Javier: *"dejarlo en b por ahora sin la inscripción de los restantes"*. | Cuando **aparezca el primer caso real** (un acompañante que quiere inscribirse y reclamar su parte), o en el paso siguiente si se prioriza. **Cada prueba grupal que se venda mientras tanto es un crédito que alguien puede venir a reclamar y no vamos a poder darle.** |
| D12 | **Los estilos/especialidades tienen que ser catálogo, no parámetro.** Hoy `especialidades` es un parámetro de texto con los estilos separados por coma (`Salsa,Bachata,Zumba,Urbano,Heels`), y lo mismo pasa con `medios_pago`. Un catálogo se aumenta y se corrige; un parámetro de texto se reescribe entero a mano y no tiene ni id ni orden ni "activo". Javier (2026-09-11): *"Considero que los estilos o especialidades deberían ser valores de catalogo no de parámetros, y deben poderse aumentar o corregir."* | **Pendiente** (2026-09-11) | Es una migración de datos (parámetro → filas de catálogo) más las pantallas que los leen. Estamos cerrando la clase de prueba. | Junto con D13, que es la otra mitad del mismo problema. **Antes** de que alguien cargue estilos nuevos en producción: cada uno que se cargue como texto es un dato más a migrar. |
| D13 | **Aumentar un valor de catálogo sin salir de la operación.** En las listas de las pantallas, el usuario tiene que poder agregar un valor al catálogo mientras está haciendo otra cosa: cargando un profesor, poder agregar un estilo que no está; ídem en cursos. Hoy hay que abandonar la pantalla, ir a configurar y volver a empezar. Javier (2026-09-11): *"para versión posterior… el usuario pueda aumentar valores a la lista de algún catalogo mientras realiza una operación."* | **Pendiente — versión posterior** (2026-09-11) | Necesita que los catálogos existan de verdad primero (D12) y es un gesto transversal: conviene definirlo una vez con Design y montarlo igual en todos lados (regla de proceso 4), como D4. | Después de D12, y junto con D4 —que es el mismo tipo de decisión: cómo se le ofrece un gesto al usuario en toda lista. |
| D9 | **La tarjeta de confirmación de la venta tiene que ser específica**: plan + monto + cursos + días + fecha de la primera clase + si es clase de prueba. Hoy dice poco y hubo que ir a la base para saber qué había quedado. | Pendiente (pedido de Javier, 2026-09-11) | Se arregló lo urgente (que mostrara **todas** las fechas y el plural). Lo demás es un rediseño del mensaje. | Junto con D4, que también es cómo se le muestra una entidad a la persona. |

## 2. Decisiones vigentes que ya se violaron una vez

Las que ya costaron. Se listan aparte porque el antecedente es el que evita la
recaída.

| Decisión | Vigente desde | Cómo se violó | Qué la protege ahora |
| --- | --- | --- | --- |
| **El fin de ciclo lo corre la suspensión** (regla de negocio 4) | siempre | Se afirmó que el motor no tocaba `fecha_fin`, tras un `grep` que no encontró el campo. | Glosario de `REGLAS.md` + controles 9 y 10. |
| **El corrimiento no toca el plazo de pago de la cuota** | 2026-09-10 | Se arrastró la definición de la etapa 1. | Glosario de `REGLAS.md`. |
| **Un fallo no se disfraza de ausencia** (calidad 1) | 2026-09-11 | Dos veces: el recibo 404 y la venta sin planes. | `exigir()` + `error.tsx` + regla de calidad 1. |
| **Un concepto, un nombre** | siempre (glosario) | Se agregó `membresia_anterior_id` en la 0023, con el resto del esquema en `inscripcion_id`. | **Control 15** + D1. |
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

- Migraciones **0023** (clase de prueba), **0024** (fecha por curso), **0025**
  (comisión por curso), **0026** (reparto guardado), **0027** (un profesor
  puede devengar dos cursos) y **0028** (parámetros con lista de opciones).
- **Criterio de conteo de clases**: calendario menos suspendidas (regla 10) y
  su contrapeso, el bloqueo por sesiones sin registrar (regla 17).
- Padrón resuelto por `inscripcion_cursos` — **bloqueante** antes de que se
  cree el primer plan multi-curso en producción.
- `exigir()` + `error.tsx`, precio de referencia por tramos, configuración y
  venta de la clase de prueba, Paso D del padrón.
- Script de refresh corregido (copia `plan_cursos` / `inscripcion_cursos` y
  sincroniza catálogos y parámetros).
