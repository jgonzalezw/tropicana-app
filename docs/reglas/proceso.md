<!-- Reglas de proceso: texto literal de docs/REGLAS.md (partido en el recorte del 2026-10-04) -->

## 3. Reglas de proceso

1. **El pase a producción requiere el OK explícito de Javier, cada vez.**
   Validar en dev no lo dispara. **Desde el 2026-09-25 esto es un control
   técnico, no solo una instrucción**: `.claude/settings.json` (versionado)
   trae un hook (`.claude/hooks/guardia-produccion.mjs`) que pide aprobación
   antes de cualquier SQL o migración contra `pnvhpbxjbdmbktpwebtx`, antes de
   un `git push` a `main`, y antes de tocar `.claude/` — para que ninguna
   sesión pueda aflojar este mismo control sin que Javier lo vea. Los
   permisos personales de cada sesión van en `.claude/settings.local.json`,
   que **no se versiona** (`.gitignore`): lo que se apruebe al paso en una
   máquina queda en esa máquina.
2. **Se trabaja en dev hasta que Javier pida el pase.** Dev es
   `tropicana-dev` (`hyhijzuomqpylcmrzdvw`); producción es `pnvhpbxjbdmbktpwebtx`.
3. **Pantalla o flujo nuevo sin mockup aprobado: avisar antes de construir.**
   Javier decide Design-first o Code v1 + Design refina. `docs/design/` es un
   espejo textual del handoff: **nunca** se edita a mano.
4. **Piezas reutilizables por entidad.** Un componente por entidad, montado
   idéntico en todos lados (contrato tipo `Cobro` / `EntidadAlumno`).
5. **Un cambio de datos en producción se respalda antes**, si no es reversible
   por sí solo, y se reporta con el antes/después exacto. Si el respaldo es un
   **script de rollback que transforma datos** (no solo estructura, como el
   de la 0047 — un puro renombre), probarlo comparando también el
   **contenido reconstruido, fila por fila, contra el dato real**: el hash de
   esquema solo prueba que la forma quedó idéntica, no que el dato que el
   script reconstruye adentro de esa forma es correcto.
   *Costó: el rollback de la 0048 (`scripts/rollback_0048_contactos.sql`)
   pasó el hash de esquema contra producción a la primera, pero tenía dos
   bugs de datos que el hash no podía ver — el whatsapp quedaba normalizado
   con `+591` en vez del formato crudo original, y `tutor_nombre`/
   `tutor_whatsapp` se anulaban cuando el tutor también era alumno,
   contradiciendo el dato real de producción (que tiene las dos cosas a la
   vez). Los encontró recién la comparación fila por fila contra producción,
   2026-09-24.*
6. **Nunca pegar cadenas de conexión ni contraseñas** en el chat ni en el repo.
7. **`docs/ESTADO.md` se actualiza con cada hito cerrado.**
8. **Una decisión tomada se respeta hasta que otra decisión la cambie.** No se
   revisa "sobre la marcha" ni porque en el momento parezca mejor: si hay que
   cambiarla, se plantea, se pondera y se anota en `docs/DECISIONES.md` con la
   fecha y el porqué. Javier no tiene cómo revisar cada decisión pasada en cada
   cambio — llevar ese control es trabajo de esta sesión, no suyo.
9. **La sesión sabe dónde corre, y no promete lo que ese entorno no puede.**
   Claude Code **local** (el `claude` de PowerShell) ve el disco de Javier;
   una sesión **en la nube** ve solo su propio clon del repo. Levantar el
   server, leer `.env.local` o ver un stash es del local; las migraciones, el
   código y los controles van por red y se pueden desde los dos. Si el paso
   necesita su disco, se le pasa el comando para que lo corra él — no se
   intenta y se le informa un resultado que midió otra máquina. **GitHub es el
   único puente entre los dos**, así que la copia local se atrasa sola si no se
   pullea. Detalle en `docs/ENTORNOS_CLAUDE.md`.
   *Costó una vez: la sesión en la nube no podía ver el `stash` de la carpeta
   de Javier, y ese stash tenía trabajo sin commitear que la mudanza del repo
   habría borrado sin que nadie se enterara.*
   **Javier no programa: solo actualiza y prueba.** Cuando una sesión en la
   nube pushea a una rama que él va a mirar en su local, el cierre de esa
   respuesta **siempre** trae el comando exacto (`git fetch origin <rama> &&
   git pull origin <rama>`, o el que corresponda si la rama recién se crea) y,
   si hay código nuevo (no solo docs), el recordatorio de `npm run
   dev:limpio`. No hace falta que él lo pida cada vez — pedirle que adivine el
   comando es exactamente el tipo de trabajo que le toca a esta sesión, no a
   él (mismo espíritu que la regla de proceso 10). *(Javier, 2026-09-26: "yo
   no hago ningún cambio, solo necesito actualizar lo tuyo en local".)*
   **Todo cierre de hito actualiza el bloque "Dónde retomar"** (arriba de
   `docs/RETOMAR.md`) en el mismo commit de cierre: rama activa, último
   commit, qué sigue y el comando exacto para adelantar la rama designada de
   la sesión siguiente. Una sesión nueva lo lee **antes** de mirar ramas —
   así no repite el trabajo de averiguar dónde quedó el hito anterior.
   *(Javier, 2026-09-26: pedido explícito, para no perder tokens
   analizándolo al abrir la sesión de H4.)*
10. **Toda decisión postergada vive en `docs/DECISIONES.md` con su disparador**
   (cuándo conviene hacerla, qué la vuelve urgente). **Todo plan que se le
   proponga a Javier abre mostrando el backlog** de decisiones postergadas que
   ese plan toca o encarece; si no aplica ninguna, se dice "ninguna". Y cuando
   se cumple un disparador, se avisa aunque nadie haya preguntado.
   *Costó tres veces: se reintrodujo una decisión ya tomada por no tenerla a
   mano, y el retrabajo lo pagó Javier en horas y en tokens.*
11. **Toda pantalla o paso nuevo incluye su opción de permisos por rol, antes
    de darse por concluido.** No es un paso aparte para después: si la pantalla
    o la operación no tiene su módulo en `Roles y Permisos` (o usa uno que no
    le corresponde), no está terminada.
    *Costó una vez: Planes, Liquidaciones y Precios y paquetes se construyeron
    usando el permiso de otro módulo (`cursos`, `comisiones`, `administracion`)
    porque no existía uno propio. Un asistente con permiso de `cursos` veía
    Planes sin que hubiera forma de evitarlo — encontrado por Javier ya con el
    asistente operando la aplicación, 2026-09-16.*
12. **Toda notificación que entrega una pantalla se puede mandar por WhatsApp
    en un clic, y también copiar.** Vale para cualquier aviso que nombre a una
    persona y algo que le pasó o le va a pasar (una clase suspendida, un cobro,
    un vencimiento) — no para los banners de éxito genéricos que no hablan de
    nadie en particular. Mientras no exista el módulo de notificaciones
    multicanal, el mínimo dejó de ser copiar el texto: es un botón que abre
    WhatsApp con el mensaje ya escrito, dirigido al número del contacto —
    "Copiar" queda como respaldo. La pieza es `src/components/AvisoWhatsapp.tsx`
    (regla de proceso 4): recibe nombre, WhatsApp y mensaje, y si el número no
    está en formato internacional deja el botón deshabilitado con la
    explicación (calidad 5), nunca lo esconde. A un alumno menor el aviso le
    llega a su tutor, que es quien lo identifica.
    **El botón intenta primero la aplicación del dispositivo, no la web**
    (Javier, 2026-09-26): antes iba directo a `wa.me`, que es la propia
    página de WhatsApp la que pregunta si se sigue ahí o se pasa a la
    aplicación — un paso de más. `abrirWhatsapp` (`src/lib/
    whatsappCliente.ts`) navega primero al esquema `whatsapp://` (que abre
    la app de escritorio o del teléfono directo, sin pasar por esa página) y
    si nada la atiende — no hay forma de saber de antemano si está instalada
    — recién ahí abre `wa.me` como respaldo, mejor esfuerzo con un margen
    corto. `urlChatWhatsapp` (el link web) y `urlAppWhatsapp` (el esquema
    `whatsapp://`), las dos en `src/lib/contactos.ts`, comparten la misma
    validación de formato. La misma pieza gobierna los tres lugares que
    abren un chat — `AvisoWhatsapp`, y los dos enlaces de número que
    aparecen sueltos en las fichas (`EnlaceWhatsapp`, `AbrirChatWhatsapp`,
    en `src/components/entidades/`) — para no dejar dos comportamientos
    distintos con el mismo botón.
    *(Javier, 2026-09-16, al construir el aviso de C5; ampliado a WhatsApp en
    un clic el 2026-09-25, al construir C3 H2 — la venta de particulares.)* La
    revisión retroactiva de las pantallas existentes con notificación queda en
    `ROADMAP.md` (R21).
