-- =====================================================================
-- TROPICANA - control de las migraciones 0016 y 0017
-- ---------------------------------------------------------------------
-- Solo LEE: no modifica nada. Se puede correr en dev o en produccion,
-- antes y despues de aplicar las migraciones, para comparar.
--
-- Pegar en el SQL Editor de Supabase del proyecto que se quiera revisar.
-- Todos los controles tienen que dar 0 / OK despues de 0016 y 0017.
--
-- Solo ASCII.
-- =====================================================================

select control, valor, case when ok then 'OK' else 'REVISAR' end as resultado from (
  -- 0016: la fecha de fin es lo que habilita liquidar la membresia.
  select 1 as n, 'Membresias de plan sin fecha de fin' as control,
         count(*)::text as valor, count(*) = 0 as ok
    from membresias where plan_id is not null and fecha_fin is null
  union all
  -- 0016: un ciclo no puede terminar antes de empezar.
  select 2, 'Ciclos que terminan antes de empezar',
         count(*)::text, count(*) = 0
    from membresias where fecha_fin is not null and fecha_fin < fecha_inicio
  union all
  -- 0016: el contador "X de N" tiene que coincidir con las presencias reales.
  select 3, 'Contadores de clases desactualizados',
         count(*)::text, count(*) = 0
    from membresias i where i.clases_plan is not null and i.estado <> 'baja'
      and i.clases_hechas <> (select count(*) from asistencias a join sesiones s on s.id = a.sesion_id
                               where a.membresia_id = i.id and a.estado = 'presente' and s.estado = 'dictada')
  union all
  -- Politica de tolerancia: una falta sin licencia deja el ciclo sin bono.
  select 4, 'Bono acreditado pese a tener falta sin licencia',
         count(*)::text, count(*) = 0
    from membresias i where i.bono_generado > 0
      and exists (select 1 from asistencias a join sesiones s on s.id = a.sesion_id
                   where a.membresia_id = i.id and a.estado = 'ausente'
                     and not a.con_licencia and s.estado = 'dictada')
  union all
  -- 0017: nada de plata cobrada fuera de una cuota.
  select 5, 'Cobros sin cuota (plata colgada)',
         count(*)::text, count(*) = 0
    from pagos where tipo = 'cobro' and cuota_id is null and membresia_id is not null
  union all
  -- 0017: todo lo vendido tiene su cuota.
  select 6, 'Membresias sin ninguna cuota',
         count(*)::text, count(*) = 0
    from membresias i where i.estado <> 'baja'
      and not exists (select 1 from cuotas cu where cu.membresia_id = i.id)
  union all
  -- 0017: el estado de la cuota refleja lo efectivamente cobrado.
  select 7, 'Estado de cuota que no coincide con lo cobrado',
         count(*)::text, count(*) = 0
    from cuotas cu where cu.estado <> (
      case when greatest(0, cu.monto_devengado - cu.descuento_adelanto) = 0
                or coalesce((select sum(p.monto + p.descuento) from pagos p
                              where p.cuota_id = cu.id and p.tipo = 'cobro'), 0)
                   >= greatest(0, cu.monto_devengado - cu.descuento_adelanto) then 'pagada'
           when coalesce((select sum(p.monto + p.descuento) from pagos p
                           where p.cuota_id = cu.id and p.tipo = 'cobro'), 0) > 0 then 'parcial'
           else 'pendiente' end)
  union all
  -- Regla base del modelo: una membresia se cierra cuando el ciclo se agoto Y
  -- esta cobrada. Agotada con saldo sigue 'activa'; sin agotar no puede estar
  -- 'completada'. No aplica a las ilimitadas (cierran por fecha, no por conteo).
  select 8, 'Membresias cuyo estado no sigue la regla (agotada + cobrada)',
         count(*)::text, count(*) = 0
    from (
      select i.id, i.estado,
             case when case when i.clases_plan is not null
                            then (select count(*) from asistencias a join sesiones s on s.id = a.sesion_id
                                   where a.membresia_id = i.id and s.estado = 'dictada') >= i.clases_plan
                            else (select count(*) from asistencias a join sesiones s on s.id = a.sesion_id
                                   where a.membresia_id = i.id and a.estado = 'presente'
                                     and s.estado = 'dictada') >= i.clases_total end
                       and coalesce((select sum(greatest(0, cu.monto_devengado - cu.descuento_adelanto
                              - coalesce((select sum(p.monto + p.descuento) from pagos p
                                           where p.cuota_id = cu.id and p.tipo = 'cobro'), 0)))
                             from cuotas cu where cu.membresia_id = i.id), 0) <= 0
                  then 'completada' else 'activa' end as objetivo
        from membresias i
       where i.estado <> 'baja'
         and (i.clases_plan is not null or i.clases_total is not null)
    ) r where r.estado <> r.objetivo
) t order by n;

-- ---------------------------------------------------------------------
-- 9. FIN DE CICLO COHERENTE CON LAS SUSPENSIONES
--    El fin de ciclo es la fecha de la clase N contando solo las clases que
--    de verdad ocurren: una sesion suspendida no consume ciclo, lo corre.
--    Este control es el que habria detectado el caso Yubinka/Vivancos: una
--    membresia vendida con fecha retroactiva sobre una clase ya suspendida
--    se quedaba con el fin de ciclo proyectado por calendario.
-- ---------------------------------------------------------------------
with base as (
  select i.id, i.fecha_inicio, i.clases_plan, i.fecha_fin
    from membresias i
   where i.estado <> 'baja' and i.clases_plan is not null and i.fecha_inicio is not null
     -- Las PRUEBAS quedan fuera: desde 0024 sus clases son fechas elegidas al
     -- vender, no el resultado de caminar el calendario. Si el vendedor elige
     -- la clase del lunes que viene en vez de la proxima, caminar da otra
     -- fecha y este control gritaria en falso. Las cubre el control 13.
     and not coalesce((to_jsonb(i) ->> 'es_prueba')::boolean, false)
),
clases as (
  select b.id as membresia_id, d::date as fecha,
         row_number() over (partition by b.id order by d, ic.curso_id) as k
    from base b
    join membresia_cursos ic on ic.membresia_id = b.id
    join lateral generate_series(b.fecha_inicio, b.fecha_inicio + 400, interval '1 day') d on true
   where extract(isodow from d)::int = any(ic.dias)
     and not exists (select 1 from sesiones s
                      where s.curso_id = ic.curso_id and s.fecha = d::date
                        and s.estado = 'suspendida')
)
select '9. fin de ciclo vs suspensiones' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from base b
  join clases c on c.membresia_id = b.id and c.k = b.clases_plan
 where b.fecha_fin is distinct from c.fecha;

-- ---------------------------------------------------------------------
-- 10. SUSPENSIONES SIN TRAZA DE CORRIMIENTO
--     Toda clase suspendida dentro del periodo de una membresia con plan
--     tiene que haber dejado su fila en corrimientos_ciclo. Si falta, la
--     membresia se vendio despues de la suspension (venta retroactiva) y
--     nadie relleno la traza.
-- ---------------------------------------------------------------------
select '10. suspensiones sin corrimiento' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from membresias i
  join membresia_cursos ic on ic.membresia_id = i.id
  join sesiones s on s.curso_id = ic.curso_id and s.estado = 'suspendida'
       and s.fecha >= i.fecha_inicio and (i.fecha_fin is null or s.fecha <= i.fecha_fin)
 where i.estado <> 'baja' and i.clases_plan is not null
   and not exists (select 1 from corrimientos_ciclo cc
                    where cc.membresia_id = i.id and cc.sesion_id = s.id);

-- ---------------------------------------------------------------------
-- 11. MEMBRESIA DE PLAN SIN SUS CURSOS DECLARADOS
--     El padron resuelve quien toma cada curso por membresia_cursos, no
--     por membresias.curso_id (que es solo el curso principal de la
--     venta). Si una membresia de plan no tiene una fila por cada curso al
--     que el plan le da acceso, el alumno queda INVISIBLE en el padron de
--     los cursos que faltan, sin ningun sintoma: simplemente no esta en la
--     lista. Cuenta las membresias vivas a las que les falta alguna.
-- ---------------------------------------------------------------------
with acceso as (
  -- Cursos a los que cada plan da acceso, segun su modo.
  select p.id as plan_id, c.id as curso_id
    from planes p
    join cursos c on c.activo
   where (p.acceso_modo = 'todas')
      or (p.acceso_modo = 'solo'
          and exists (select 1 from plan_cursos pc
                       where pc.plan_id = p.id and pc.curso_id = c.id))
      or (p.acceso_modo = 'excepto'
          and not exists (select 1 from plan_cursos pc
                           where pc.plan_id = p.id and pc.curso_id = c.id))
)
select '11. membresias sin sus cursos declarados' as control,
       count(distinct i.id) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from membresias i
  join acceso a on a.plan_id = i.plan_id
 where i.estado <> 'baja'
   and i.plan_id is not null
   -- Solo las que ya usan el mecanismo: las de legado no tienen ninguna fila
   -- y el padron las resuelve por curso_id, como siempre.
   and exists (select 1 from membresia_cursos ic where ic.membresia_id = i.id)
   -- Una prueba elige sus cursos al comprar: no toma todos los del plan.
   -- Se lee via to_jsonb para que el script corra tambien contra una base
   -- que todavia no tiene la columna (0023 no aplicada): ahi no hay pruebas,
   -- asi que el filtro simplemente no excluye nada.
   and coalesce((to_jsonb(i) ->> 'es_prueba')::boolean, false) = false
   and not exists (select 1 from membresia_cursos ic
                    where ic.membresia_id = i.id and ic.curso_id = a.curso_id);

-- ---------------------------------------------------------------------
-- 12. ASISTENCIA EN UN CURSO QUE LA MEMBRESIA NO TOMA
--     Al reves del 11: si hay una asistencia cargada contra un curso que
--     la membresia no declara, o en un dia que el alumno no eligio, el
--     padron listo a alguien que no correspondia.
-- ---------------------------------------------------------------------
select '12. asistencias fuera de los cursos de la membresia' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from asistencias asi
  join sesiones s on s.id = asi.sesion_id
  join membresias i on i.id = asi.membresia_id
 where i.plan_id is not null
   and exists (select 1 from membresia_cursos ic where ic.membresia_id = i.id)
   and not exists (select 1 from membresia_cursos ic
                    where ic.membresia_id = i.id
                      and ic.curso_id = s.curso_id
                      and (ic.dias is null or array_length(ic.dias, 1) is null
                           or extract(isodow from s.fecha)::int = any(ic.dias)));

-- ---------------------------------------------------------------------
-- 13. PRUEBA SIN LA FECHA DE SU CLASE
--     Desde 0024 cada curso de una membresia de prueba guarda la fecha
--     exacta de su unica clase, y el padron la usa para mostrar al alumno
--     ese dia y ninguno otro. Sin fecha, la prueba no aparece en el padron
--     de ese curso: el alumno viene y no esta en la lista.
--     Se salta si la columna todavia no existe (0024 no aplicada).
-- ---------------------------------------------------------------------
select '13. pruebas sin fecha de clase' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from public.membresia_cursos ic
  join public.membresias i on i.id = ic.membresia_id
 where coalesce((to_jsonb(i) ->> 'es_prueba')::boolean, false)
   and (to_jsonb(ic) ->> 'fecha') is null;

-- ---------------------------------------------------------------------
-- 14. PRUEBA CUYAS FECHAS NO SON LAS DE SUS CLASES
--     Reemplaza al control 9 para las pruebas: una prueba empieza en su
--     primera clase y termina en la ultima. Si no coincide, el padron y la
--     liquidacion van a mirar un periodo que no existe.
-- ---------------------------------------------------------------------
select '14. pruebas con fechas que no son sus clases' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from public.membresias i
  join (
    select ic.membresia_id, min(ic.fecha) as primera, max(ic.fecha) as ultima
      from public.membresia_cursos ic
     where ic.fecha is not null
     group by ic.membresia_id
  ) f on f.membresia_id = i.id
 where coalesce((to_jsonb(i) ->> 'es_prueba')::boolean, false)
   and i.estado <> 'baja'
   and (i.fecha_inicio is distinct from f.primera or i.fecha_fin is distinct from f.ultima);

-- ---------------------------------------------------------------------
-- 16. CLASE DE PRUEBA EN UN DIA QUE NO EXISTE
--     La fecha de la clase de una prueba tiene que ser un dia en que ESE
--     curso se dicta, y no puede caer en una clase suspendida. Si no, es una
--     clase que no existe: no aparece en ningun padron y no liquida.
--     Lo detecta el caso real: una prueba de Bachata Conexion (martes y
--     jueves) quedo cargada un sabado, porque el campo de fecha era libre.
-- ---------------------------------------------------------------------
select '16. pruebas con clase en un dia sin curso o suspendida' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from public.membresia_cursos ic
  join public.membresias i on i.id = ic.membresia_id
  join public.cursos c on c.id = ic.curso_id
 where coalesce((to_jsonb(i) ->> 'es_prueba')::boolean, false)
   and i.estado <> 'baja'
   and (to_jsonb(ic) ->> 'fecha') is not null
   and (
     extract(isodow from (to_jsonb(ic) ->> 'fecha')::date)::int <> all(c.dias_semana)
     or exists (select 1 from public.sesiones s
                 where s.curso_id = ic.curso_id
                   and s.fecha = (to_jsonb(ic) ->> 'fecha')::date
                   and s.estado = 'suspendida')
   );

-- ---------------------------------------------------------------------
-- 17. HECHOS DENTRO DE UN PERIODO PAGADO QUE NO DEJARON RASTRO
--     Regla de negocio 16 (reescrita el 2026-09-18): un periodo liquidado y
--     pagado NO esta congelado. Las clases solo afectan contadores, asi que
--     registrar tarde, corregir o suspender siempre se puede: lo que no se
--     hace es reescribir lo pagado. Si el recalculo da otro numero, la
--     diferencia sale como un `ajuste` (0044), y una venta retroactiva
--     devenga lo suyo como complemento.
--
--     POR ESO ESTE CONTROL SE ACOTO. Antes contaba como sospechosa CUALQUIER
--     inscripcion creada despues del cierre con fecha adentro -- que desde la
--     0044 es el caso legitimo y esperado. Un control que grita en falso
--     ensena a ignorarlo, que es peor que no tenerlo.
--
--     Lo que sigue siendo un problema real: un hecho dentro de un periodo
--     pagado que NO dejo ni complemento ni ajuste. Ahi si la comision que se
--     pago quedo sin respaldo y nadie lo compenso.
--
--     El cierre es el ultimo dia del mes de la liquidacion mas nueva CON PAGO
--     ('pagada' o 'cerrada': 'cerrada' es pago parcial).
-- ---------------------------------------------------------------------
with cierre as (
  select max((date_trunc('month', periodo) + interval '1 month - 1 day')::date) as hasta
    from public.liquidaciones
   where estado in ('pagada', 'cerrada') and periodo is not null
),
-- Ventas retroactivas que ERAN ELEGIBLES para esa liquidacion y aun asi nunca
-- devengaron nada. Las dos condiciones de elegibilidad importan y se midieron:
-- una membresia `activa`, o una cuyo ciclo termina DESPUES del cierre, todavia
-- no puede devengar (solo entran las completadas con fecha_fin <= cierre,
-- regla 1 y regla 8). Sin ese filtro el control marcaba ocho membresias de dev
-- que estaban perfectamente bien: no habian devengado porque no les tocaba.
ventas_mudas as (
  select i.id
    from public.membresias i, cierre
   where cierre.hasta is not null
     and i.creado_en::date > cierre.hasta
     and i.estado = 'completada'
     and i.fecha_fin is not null and i.fecha_fin <= cierre.hasta
     and not exists (select 1 from public.comisiones_devengadas cd
                      where cd.membresia_id = i.id)
),
-- Suspensiones retroactivas sobre una membresia ya devengada que no dejaron
-- ningun ajuste: el conteo cambio y la plata no se recalculo.
suspensiones_mudas as (
  select s.id
    from public.sesiones s, cierre
   where cierre.hasta is not null
     and s.estado = 'suspendida'
     and s.fecha <= cierre.hasta
     and s.actualizado_en::date > cierre.hasta
     and exists (
       select 1 from public.membresia_cursos ic
       join public.membresias i on i.id = ic.membresia_id
       join public.comisiones_devengadas cd on cd.membresia_id = i.id
      where ic.curso_id = s.curso_id
        and s.fecha between i.fecha_inicio and coalesce(i.fecha_fin, s.fecha)
        and not exists (select 1 from public.comisiones_devengadas aj
                         where aj.membresia_id = i.id and aj.tipo = 'ajuste')
     )
)
select '17. hechos dentro de un periodo pagado sin complemento ni ajuste' as control,
       (select count(*) from ventas_mudas) + (select count(*) from suspensiones_mudas) as n,
       case when (select count(*) from ventas_mudas) + (select count(*) from suspensiones_mudas) = 0
            then 'OK' else 'REVISAR' end as estado;

-- ---------------------------------------------------------------------
-- 18. LAS PARTES DE UNA MEMBRESIA SUMAN LO COBRADO
--     Es la invariante de la prorrata (regla de negocio 10): la venta se
--     reparte entre los cursos, asi que la suma de las bases devengadas de
--     una membresia tiene que dar exactamente lo que se cobro. Si da menos,
--     algun curso quedo sin devengar y un profesor no va a cobrar. Si da
--     mas, se devengo dos veces.
--     Solo mira membresias con TODAS sus partes ya devengadas: mientras se
--     generan las liquidaciones de a un profesor por vez, es normal que
--     falten. Y solo las de 0025 en adelante (curso_id no nulo): lo anterior
--     se devengaba por membresia entera.
-- ---------------------------------------------------------------------
with partes as (
  select cd.membresia_id,
         sum(cd.base) as suma_partes,
         count(*) as cursos_devengados
    from public.comisiones_devengadas cd
   where cd.membresia_id is not null and cd.curso_id is not null
   group by cd.membresia_id
),
esperado as (
  select p.membresia_id, p.suma_partes,
         (select count(*) from public.membresia_cursos ic
           where ic.membresia_id = p.membresia_id) as cursos_del_plan,
         p.cursos_devengados,
         coalesce((select sum(pg.monto) from public.pagos pg
                     join public.cuotas cu on cu.id = pg.cuota_id
                    where cu.membresia_id = p.membresia_id and pg.tipo = 'cobro'), 0) as cobrado
    from partes p
)
select '18. partes devengadas que no suman lo cobrado' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from esperado e
 -- Un curso que no dicto no devenga, asi que "todas las partes" no es
 -- "tantas filas como cursos": se compara la plata, que es lo que importa.
 where e.cobrado > 0
   and e.cursos_devengados >= 1
   and abs(e.suma_partes - e.cobrado) > 0.01
   -- Solo cuando ya se devengaron todos los cursos que dictaron algo.
   and not exists (
     select 1 from public.membresia_cursos ic
      where ic.membresia_id = e.membresia_id
        and not exists (select 1 from public.comisiones_devengadas cd2
                         where cd2.membresia_id = e.membresia_id and cd2.curso_id = ic.curso_id)
        and exists (select 1 from public.sesiones s
                     join public.membresias i on i.id = e.membresia_id
                    where s.curso_id = ic.curso_id and s.estado = 'dictada'
                      and s.fecha between i.fecha_inicio and coalesce(i.fecha_fin, s.fecha))
   );

-- ---------------------------------------------------------------------
-- 19. COMISION CON PRORRATEO DEVENGADA CON CLASES SIN REGISTRAR
--     Regla de negocio 17 (alcance corregido 2026-09-12). Desde que las
--     clases se cuentan por calendario menos suspendidas (regla 10), una
--     clase sin sesion —ni asistencia ni suspension— pesa igual que una
--     dictada. Eso solo mueve plata cuando hay que REPARTIR: con un solo
--     curso, lo cobrado va entero a ese curso y el conteo no cambia nada.
--     Por eso el control mira solo las membresias de DOS O MAS cursos.
--     La pantalla lo impide; este control verifica que no haya quedado
--     ninguna de antes del bloqueo.
-- ---------------------------------------------------------------------
with dias_de_clase as (
  -- Membresia regular: los dias del calendario que el alumno eligio.
  select ic.membresia_id, ic.curso_id, d::date as fecha
    from public.membresia_cursos ic
    join public.membresias i on i.id = ic.membresia_id
    join public.cursos c on c.id = ic.curso_id
    cross join lateral generate_series(i.fecha_inicio::date,
                                       i.fecha_fin::date,
                                       interval '1 day') as d
   where ic.fecha is null
     and i.fecha_fin is not null
     and extract(isodow from d)::int = any (
           case when coalesce(array_length(ic.dias, 1), 0) > 0
                then ic.dias else c.dias_semana end)
  union all
  -- Prueba: una sola clase, en su fecha exacta (0024).
  select ic.membresia_id, ic.curso_id, ic.fecha
    from public.membresia_cursos ic
   where ic.fecha is not null
)
select '19. membresias devengadas con clases sin registrar' as control,
       count(distinct dc.membresia_id) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from dias_de_clase dc
 where not exists (select 1 from public.sesiones s
                    where s.curso_id = dc.curso_id and s.fecha = dc.fecha)
   and exists (select 1 from public.comisiones_devengadas cd
                where cd.membresia_id = dc.membresia_id)
   -- Solo con prorrateo: una membresia mono-curso no depende del conteo.
   and (select count(*) from public.membresia_cursos ic2
         where ic2.membresia_id = dc.membresia_id) > 1;

-- ---------------------------------------------------------------------
-- 20. COMISION ATRIBUIDA A UN PROFESOR QUE NO TENIA EL CURSO ASIGNADO
--     `asignaciones` tiene `desde` / `hasta`, pero el calculo del prorrateo
--     lee solo las vigentes: si a mitad de mes cambia el titular de un
--     curso, toda la comision del mes se le atribuye al nuevo y el anterior
--     no cobra las clases que si dicto. Es D18 en docs/DECISIONES.md — un
--     bug conocido, no una mejora.
--     CORREGIDO el 2026-09-12: el reparto usa el historial de asignaciones.
--     El control marca las comisiones cuyo profesor no tenia ese curso
--     asignado durante el periodo liquidado. Lo devengado ANTES de la
--     correccion puede seguir marcado: no se reescribe (regla 12). Lo que
--     importa es que no aparezcan filas NUEVAS.
--
--     LOS AJUSTES QUEDAN FUERA (0044, 2026-09-18). Un ajuste es la
--     diferencia de una comision que se recalculo, y el caso tipico es
--     justamente el profesor que PERDIO la asignacion: se le devuelve lo
--     que ya no le toca, con base negativa. Contarlo aca lo marcaria como
--     sospechoso siendo que es la correccion, no el problema.
-- ---------------------------------------------------------------------
select '20. comisiones de un profesor sin la asignacion vigente en el periodo' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR (ver fecha: lo previo a 2026-09-12 es historico)' end as estado
  from public.comisiones_devengadas cd
  join public.membresias i on i.id = cd.membresia_id
 where cd.curso_id is not null
   and cd.tipo <> 'ajuste'
   and not exists (
     select 1 from public.asignaciones a
      where a.curso_id = cd.curso_id
        and a.profesor_id = cd.profesor_id
        and a.desde <= coalesce(i.fecha_fin, i.fecha_inicio)
        and (a.hasta is null or a.hasta >= i.fecha_inicio)
   );

-- ---------------------------------------------------------------------
-- 15. UN CONCEPTO, UN NOMBRE: llaves a `membresias` con nombres distintos
--     Hasta la 0047 la misma llave se llamaba `inscripcion_id` en unas tablas
--     y `membresia_id` en otras (D1). La 0047 unifico todo en `membresia_id`
--     y renombro la tabla a `membresias`: desde ahi este control da OK, y
--     queda para que NUNCA vuelva a aparecer una segunda grafia.
--     Cuenta solo la llave de PERTENENCIA (la membresia duena de la fila).
--     Quedan afuera, a proposito: `membresia_anterior_id` (otro concepto: de
--     que membresia viene esta) y los respaldos historicos `*_previo_*`, que
--     conservan el nombre que tenian cuando se tomaron.
-- ---------------------------------------------------------------------
select '15. nombres distintos para la llave a membresias' as control,
       count(distinct kcu.column_name) as n,
       case when count(distinct kcu.column_name) <= 1 then 'OK'
            else 'REVISAR (grafias: ' ||
                 string_agg(distinct kcu.column_name, ' / ') || ')' end as estado
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
       on kcu.constraint_name = tc.constraint_name
      and kcu.table_schema = tc.table_schema
  join information_schema.constraint_column_usage ccu
       on ccu.constraint_name = tc.constraint_name
      and ccu.table_schema = tc.table_schema
 where tc.constraint_type = 'FOREIGN KEY'
   and tc.table_schema = 'public'
   and ccu.table_name = 'membresias'
   and ccu.column_name = 'id'
   and kcu.column_name <> 'membresia_anterior_id'
   and tc.table_name not like '%\_previo\_%';

-- ---------------------------------------------------------------------
-- 21. MEMBRESIA QUE SE SALE DE LA VIGENCIA DE SU CURSO
--     Vigencia del curso (0033). El calendario de un curso no genera clases
--     fuera de [vigente_desde, vigente_hasta]: esos dias no cuentan para el
--     prorrateo (regla 10) ni se exige registrarlos (regla 17).
--
--     Si una membresia VIEJA queda parcialmente afuera, su conteo de clases
--     cambio sin que nadie lo pidiera, y con eso se movio el peso del reparto
--     - que es justo lo que la regla de negocio 5 prohibe hacer en silencio.
--     La causa tipica es haber corregido `vigente_desde` hacia adelante
--     despues de vender. Se arregla ampliando la vigencia del curso, no
--     tocando la membresia.
-- ---------------------------------------------------------------------
select '21. membresias que se salen de la vigencia de su curso' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from membresia_cursos ic
  join membresias i on i.id = ic.membresia_id
  join cursos c on c.id = ic.curso_id
 where i.fecha_inicio < c.vigente_desde
    or (c.vigente_hasta is not null and i.fecha_fin > c.vigente_hasta)
    or (ic.fecha is not null
        and (ic.fecha < c.vigente_desde
             or (c.vigente_hasta is not null and ic.fecha > c.vigente_hasta)));

-- ---------------------------------------------------------------------
-- 22. ALUMNO O PROFESOR SIN CONTACTO
--     Desde la 0048, `alumnos.contacto_id` y `profesores.contacto_id` son
--     NOT NULL + UNIQUE: son extensiones de rol, no dueños de su propia
--     identidad. Si alguno quedara sin contacto, ninguna pantalla podria
--     mostrar su nombre ni su WhatsApp.
-- ---------------------------------------------------------------------
select '22. alumnos o profesores sin contacto' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from (
    select id from public.alumnos where contacto_id is null
    union all
    select id from public.profesores where contacto_id is null
  ) t;

-- ---------------------------------------------------------------------
-- 23. WHATSAPP FUERA DE FORMATO
--     `normalizar_whatsapp()` deja en +591 + 8 digitos todo numero
--     boliviano reconocible; lo que no encaja se deja en digitos crudos y
--     queda marcado aca, en vez de inventarse un numero (regla de calidad
--     1). Los dos casos medidos en produccion (uno de 9 digitos que
--     empieza con 776 y uno de 11 que empieza con 346) van a seguir
--     apareciendo hasta que alguien los corrija a mano: el control
--     recuerda que existen, no los oculta.
-- ---------------------------------------------------------------------
select '23. whatsapp de contacto fuera de formato +591' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK'
            else 'REVISAR (detalle: ' ||
                 string_agg(id || '=' || whatsapp, ', ' order by id) || ')' end as estado
  from public.contactos
 where whatsapp is not null
   and whatsapp !~ '^\+591[0-9]{8}$';

-- ---------------------------------------------------------------------
-- 24. MENOR REPETIDO
--     Un menor sin WhatsApp propio se identifica por el WhatsApp del tutor
--     mas su propio nombre (`claveMenor` en lib/contactos.ts). Si dos
--     alumnos activos comparten esa clave, son la misma persona cargada
--     dos veces: cada uno arrastra su propio historial de asistencia y
--     membresias, partido en dos.
-- ---------------------------------------------------------------------
with menores as (
  select a.id as alumno_id, c.id as contacto_id,
         lower(trim(coalesce(c.nombre, '') || ' ' || coalesce(c.apellido, ''))) as nombre_clave,
         tutor.whatsapp as tutor_whatsapp
    from public.alumnos a
    join public.contactos c on c.id = a.contacto_id
    left join public.contacto_relaciones cr on cr.hacia_id = c.id and cr.tipo = 'tutor_de'
    left join public.contactos tutor on tutor.id = cr.desde_id
   where a.es_menor and a.activo and c.activo
)
select '24. menores repetidos (mismo tutor + mismo nombre)' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from (
    select tutor_whatsapp, nombre_clave, count(*) as veces
      from menores
     where tutor_whatsapp is not null and nombre_clave <> ''
     group by tutor_whatsapp, nombre_clave
    having count(*) > 1
  ) t;

-- ---------------------------------------------------------------------
-- 25. EL TRIGGER DE CONSENTIMIENTOS EXISTE
--     `consentimientos` es de solo agregar (regla de negocio: un
--     consentimiento no se edita ni se borra, se reemplaza con uno nuevo).
--     Si el trigger `consentimientos_no_update` desaparece, una migracion o
--     un cambio de permisos abrio la puerta a reescribir el historial de
--     consentimiento, que es exactamente lo que no puede pasar.
-- ---------------------------------------------------------------------
select '25. trigger consentimientos_no_update presente' as control,
       count(*) as n,
       case when count(*) = 1 then 'OK' else 'REVISAR' end as estado
  from pg_trigger
 where tgname = 'consentimientos_no_update'
   and tgrelid = 'public.consentimientos'::regclass
   and not tgisinternal;

-- ---------------------------------------------------------------------
-- 26. CURSO ACTIVO SIN ESTILO VALIDO
--     D12: `cursos.estilo` reemplaza a `linea` (texto libre). Un curso
--     activo sin `estilo` no aparece bien clasificado en Precios, en el
--     filtro de titulares de Profesores ni en las tarifas de particular
--     que se cobran por estilo.
-- ---------------------------------------------------------------------
select '26. cursos activos sin estilo' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from public.cursos
 where activo and estilo is null;

-- ---------------------------------------------------------------------
-- 27. CELDAS BLOQUEADAS DE LA MATRIZ DE MINIMOS CON OTRO VALOR
--     C3-0a.3: nombre/whatsapp/tutor/es_menor/tipo_profesor en ciertos
--     contextos son de los que depende la logica del sistema (deteccion de
--     duplicados, el check de la base que exige nombre u organizacion). El
--     editor (Administracion > Catalogos > Matriz de minimos) las bloquea
--     con candado; este control detecta si alguien las cambio por SQL
--     directo. Lista identica a CELDAS_BLOQUEADAS en src/lib/matrizMinimos.ts
--     -- si una cambia, la otra tiene que cambiar tambien.
-- ---------------------------------------------------------------------
with fijas(contexto, campo, nivel) as (values
  ('prospecto','nombre','O'), ('prueba','nombre','O'), ('alumno_adulto','nombre','O'),
  ('alumno_menor','nombre','O'), ('profesor','nombre','O'), ('tercero_persona','nombre','O'),
  ('proveedor','nombre','O'), ('form_publico','nombre','O'),
  ('tercero_org','nombre','-'), ('tercero_org','razon_social','O'),
  ('alumno_adulto','whatsapp','O'), ('prueba','whatsapp','O'), ('alumno_menor','whatsapp','-'),
  ('alumno_menor','tutor','O'),
  ('alumno_adulto','es_menor','O'), ('alumno_menor','es_menor','O'),
  ('profesor','tipo_profesor','O')
)
select '27. celdas bloqueadas de la matriz con otro valor' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from public.matriz_minimos m
  join fijas f on f.contexto = m.contexto and f.campo = m.campo
 where m.nivel <> f.nivel;

-- ---------------------------------------------------------------------
-- 28. PLANES DE PARTICULARES ACTIVOS SIN ESTILO
--     0052 (C3 H1): un plan de particulares sin estilo no tiene de donde
--     sacar los tramos de tarifas_particular al vender (H2) -- una
--     plantilla a medio cargar que pasaria por lista para vender.
-- ---------------------------------------------------------------------
select '28. planes de particulares activos sin estilo' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from public.planes
 where activo and tipo_servicio = 'particular' and estilo is null;

-- ---------------------------------------------------------------------
-- 29. PLANES DE PARTICULARES ACTIVOS SIN FORMA DE PAGO AL PROFESOR
--     0052 (C3 H1): sin forma_pago_profesor, H5 (liquidacion) no tiene
--     como calcular cuanto gana el profesor por este plan.
-- ---------------------------------------------------------------------
select '29. planes de particulares activos sin forma de pago al profesor' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from public.planes
 where activo and tipo_servicio = 'particular' and forma_pago_profesor is null;

-- ---------------------------------------------------------------------
-- 30. MEMBRESIAS DE PARTICULARES SIN HORAS, PROFESOR O CONTACTO
--     0053 (C3 H2): una membresia sin curso_id es de particulares (check
--     membresias_curso_o_horas ya lo obliga a tener horas_contratadas).
--     Sin profesor_id ni contacto_id no hay a quien liquidar ni a quien
--     avisarle: la venta quedo a medio hacer.
-- ---------------------------------------------------------------------
select '30. membresias de particulares sin horas, profesor o contacto' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from public.membresias
 where estado <> 'baja' and curso_id is null
   and (horas_contratadas is null or profesor_id is null or contacto_id is null);

-- ---------------------------------------------------------------------
-- 31. MEMBRESIAS DE PARTICULARES SIN NINGUNA RESERVA
--     0053 (C3 H2): al vender se crea la primera reserva real (decision
--     de Javier, 25/09) -- una membresia particular activa sin ninguna
--     fila en reservas_sala se vendio sin ocupar la sala, contra la razon
--     de ser de adelantar el Paso 5 (no vender una hora sin reservarla).
-- ---------------------------------------------------------------------
select '31. membresias de particulares activas sin ninguna reserva' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from public.membresias m
 where m.estado = 'activa' and m.curso_id is null
   and not exists (select 1 from public.reservas_sala r where r.membresia_id = m.id);

-- ---------------------------------------------------------------------
-- 32. RESERVAS QUE OCUPAN LA SALA EXTERNA
--     0053 (C3 H2): la sala externa generica no se valida (definiciones-v2
--     seccion 9); el trigger reservas_sala_set_ocupa la marca ocupa_sala =
--     false para que el EXCLUDE la salte. Si esto da mas de 0, el trigger
--     no esta corriendo o alguien puso ocupa_sala a mano.
-- ---------------------------------------------------------------------
select '32. reservas que marcan ocupa_sala en la sala externa' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from public.reservas_sala r
  join public.salas s on s.id = r.sala_id
 where s.es_externa and r.ocupa_sala;

-- ---------------------------------------------------------------------
-- 33. RESERVAS CON MAS HORAS CONSUMIDAS QUE LAS CONTRATADAS
--     0054 (C3 H3): el saldo se calcula desde las reservas (regla de
--     negocio 23), nunca se guarda paso a paso. Si esto da mas de 0, algo
--     dejo pasar una reserva que se paso del paquete -- la validacion de
--     `crearReserva` (duracion <= disponible) tiene una falla.
-- ---------------------------------------------------------------------
select '33. membresias de particulares con mas horas consumidas que contratadas' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from (
    select m.id,
           m.horas_contratadas * 60 as contratadas_min,
           coalesce(sum(r.duracion_min) filter (
             where r.estado in ('confirmada', 'reprogramada', 'ausente', 'realizada')
           ), 0) as consumidas_min
      from public.membresias m
      left join public.reservas_sala r on r.membresia_id = m.id
     where m.curso_id is null
     group by m.id, m.horas_contratadas
  ) s
 where s.consumidas_min > s.contratadas_min;

-- ---------------------------------------------------------------------
-- 34. RESERVAS SOLICITADAS SIN `solicitada_hasta`
--     0054: el check `reservas_sala_solicitada_hasta_check` ya lo impide a
--     nivel de base -- este control es la doble verificacion de lectura
--     (calidad 3: medir antes de asumir), y detectaria un check
--     deshabilitado sin que nadie se de cuenta.
-- ---------------------------------------------------------------------
select '34. reservas Solicitada sin fecha de vencimiento' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from public.reservas_sala
 where estado = 'solicitada' and solicitada_hasta is null;

-- ---------------------------------------------------------------------
-- 35. RESERVAS SIN NINGUNA FILA DE HISTORIAL
--     0054: el trigger `reservas_sala_historial_trg` escribe la primera
--     fila al crearse (y el backfill la puso para las que ya existian). Si
--     esto da mas de 0, el trigger no corrio para esa fila.
-- ---------------------------------------------------------------------
select '35. reservas sin ninguna fila de historial' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from public.reservas_sala r
 where not exists (select 1 from public.reservas_historial h where h.reserva_id = r.id);

-- ---------------------------------------------------------------------
-- 36. RESERVAS DE PARTICULAR SIN PROFESOR
--     0053/0054: toda reserva de una membresia particular tiene que
--     heredar el profesor de la membresia -- sin eso no hay a quien
--     validarle el choque de agenda ni a quien liquidarle la clase.
-- ---------------------------------------------------------------------
select '36. reservas de particular sin profesor' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from public.reservas_sala
 where tipo = 'particular' and profesor_id is null;

-- ---------------------------------------------------------------------
-- 37. UNA SUSPENSION LIGADA A UN CIERRE/BLOQUEO SIGUE SUSPENDIDA
--     0055 (C3 H4): `suspendida_por_excepcion_id`/`suspendida_por_bloqueo_id`
--     solo los escribe `suspenderReservaOperativa`, y `suspendida` es un
--     estado final (TRANSICIONES, reservas.ts) -- revertir crea una reserva
--     NUEVA, nunca reabre esta. Si esto da mas de 0, algo movio de estado a
--     una reserva que debia quedar congelada como historia.
-- ---------------------------------------------------------------------
select '37. reserva con vinculo de suspension operativa que no esta suspendida' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from public.reservas_sala
 where (suspendida_por_excepcion_id is not null or suspendida_por_bloqueo_id is not null)
   and estado <> 'suspendida';

-- ---------------------------------------------------------------------
-- 38. UNA RESERVA QUE REVIERTE A OTRA APUNTA A UNA SUSPENDIDA
--     0055: `revertirSuspension` es la unica que escribe `revierte_reserva_id`,
--     y siempre contra una fila que en ese momento estaba `suspendida` (y
--     sigue siendolo, por el control 37). Si esto da mas de 0, se armo el
--     vinculo contra una reserva que nunca fue la que se estaba revirtiendo.
-- ---------------------------------------------------------------------
select '38. reserva que revierte a otra que no esta suspendida' as control,
       count(*) as n,
       case when count(*) = 0 then 'OK' else 'REVISAR' end as estado
  from public.reservas_sala r
  join public.reservas_sala anterior on anterior.id = r.revierte_reserva_id
 where anterior.estado <> 'suspendida';

-- ---------------------------------------------------------------------
-- Detalle, por si algun control da REVISAR:
-- ---------------------------------------------------------------------
-- select id, alumno_id, curso_id, estado, fecha_inicio, fecha_fin,
--        clases_plan, clases_hechas, bono_generado
--   from membresias where plan_id is not null order by id;
--
-- select cu.id, cu.membresia_id, cu.periodo, cu.monto_devengado, cu.estado,
--        coalesce((select sum(p.monto) from pagos p where p.cuota_id = cu.id and p.tipo='cobro'), 0) as cobrado
--   from cuotas cu order by cu.membresia_id;
