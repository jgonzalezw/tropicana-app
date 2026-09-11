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
    from inscripciones where plan_id is not null and fecha_fin is null
  union all
  -- 0016: un ciclo no puede terminar antes de empezar.
  select 2, 'Ciclos que terminan antes de empezar',
         count(*)::text, count(*) = 0
    from inscripciones where fecha_fin is not null and fecha_fin < fecha_inicio
  union all
  -- 0016: el contador "X de N" tiene que coincidir con las presencias reales.
  select 3, 'Contadores de clases desactualizados',
         count(*)::text, count(*) = 0
    from inscripciones i where i.clases_plan is not null and i.estado <> 'baja'
      and i.clases_hechas <> (select count(*) from asistencias a join sesiones s on s.id = a.sesion_id
                               where a.inscripcion_id = i.id and a.estado = 'presente' and s.estado = 'dictada')
  union all
  -- Politica de tolerancia: una falta sin licencia deja el ciclo sin bono.
  select 4, 'Bono acreditado pese a tener falta sin licencia',
         count(*)::text, count(*) = 0
    from inscripciones i where i.bono_generado > 0
      and exists (select 1 from asistencias a join sesiones s on s.id = a.sesion_id
                   where a.inscripcion_id = i.id and a.estado = 'ausente'
                     and not a.con_licencia and s.estado = 'dictada')
  union all
  -- 0017: nada de plata cobrada fuera de una cuota.
  select 5, 'Cobros sin cuota (plata colgada)',
         count(*)::text, count(*) = 0
    from pagos where tipo = 'cobro' and cuota_id is null and inscripcion_id is not null
  union all
  -- 0017: todo lo vendido tiene su cuota.
  select 6, 'Membresias sin ninguna cuota',
         count(*)::text, count(*) = 0
    from inscripciones i where i.estado <> 'baja'
      and not exists (select 1 from cuotas cu where cu.inscripcion_id = i.id)
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
                                   where a.inscripcion_id = i.id and s.estado = 'dictada') >= i.clases_plan
                            else (select count(*) from asistencias a join sesiones s on s.id = a.sesion_id
                                   where a.inscripcion_id = i.id and a.estado = 'presente'
                                     and s.estado = 'dictada') >= i.clases_total end
                       and coalesce((select sum(greatest(0, cu.monto_devengado - cu.descuento_adelanto
                              - coalesce((select sum(p.monto + p.descuento) from pagos p
                                           where p.cuota_id = cu.id and p.tipo = 'cobro'), 0)))
                             from cuotas cu where cu.inscripcion_id = i.id), 0) <= 0
                  then 'completada' else 'activa' end as objetivo
        from inscripciones i
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
    from inscripciones i
   where i.estado <> 'baja' and i.clases_plan is not null and i.fecha_inicio is not null
     -- Las PRUEBAS quedan fuera: desde 0024 sus clases son fechas elegidas al
     -- vender, no el resultado de caminar el calendario. Si el vendedor elige
     -- la clase del lunes que viene en vez de la proxima, caminar da otra
     -- fecha y este control gritaria en falso. Las cubre el control 13.
     and not coalesce((to_jsonb(i) ->> 'es_prueba')::boolean, false)
),
clases as (
  select b.id as inscripcion_id, d::date as fecha,
         row_number() over (partition by b.id order by d, ic.curso_id) as k
    from base b
    join inscripcion_cursos ic on ic.inscripcion_id = b.id
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
  join clases c on c.inscripcion_id = b.id and c.k = b.clases_plan
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
  from inscripciones i
  join inscripcion_cursos ic on ic.inscripcion_id = i.id
  join sesiones s on s.curso_id = ic.curso_id and s.estado = 'suspendida'
       and s.fecha >= i.fecha_inicio and (i.fecha_fin is null or s.fecha <= i.fecha_fin)
 where i.estado <> 'baja' and i.clases_plan is not null
   and not exists (select 1 from corrimientos_ciclo cc
                    where cc.inscripcion_id = i.id and cc.sesion_id = s.id);

-- ---------------------------------------------------------------------
-- 11. MEMBRESIA DE PLAN SIN SUS CURSOS DECLARADOS
--     El padron resuelve quien toma cada curso por inscripcion_cursos, no
--     por inscripciones.curso_id (que es solo el curso principal de la
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
  from inscripciones i
  join acceso a on a.plan_id = i.plan_id
 where i.estado <> 'baja'
   and i.plan_id is not null
   -- Solo las que ya usan el mecanismo: las de legado no tienen ninguna fila
   -- y el padron las resuelve por curso_id, como siempre.
   and exists (select 1 from inscripcion_cursos ic where ic.inscripcion_id = i.id)
   -- Una prueba elige sus cursos al comprar: no toma todos los del plan.
   -- Se lee via to_jsonb para que el script corra tambien contra una base
   -- que todavia no tiene la columna (0023 no aplicada): ahi no hay pruebas,
   -- asi que el filtro simplemente no excluye nada.
   and coalesce((to_jsonb(i) ->> 'es_prueba')::boolean, false) = false
   and not exists (select 1 from inscripcion_cursos ic
                    where ic.inscripcion_id = i.id and ic.curso_id = a.curso_id);

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
  join inscripciones i on i.id = asi.inscripcion_id
 where i.plan_id is not null
   and exists (select 1 from inscripcion_cursos ic where ic.inscripcion_id = i.id)
   and not exists (select 1 from inscripcion_cursos ic
                    where ic.inscripcion_id = i.id
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
  from public.inscripcion_cursos ic
  join public.inscripciones i on i.id = ic.inscripcion_id
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
  from public.inscripciones i
  join (
    select ic.inscripcion_id, min(ic.fecha) as primera, max(ic.fecha) as ultima
      from public.inscripcion_cursos ic
     where ic.fecha is not null
     group by ic.inscripcion_id
  ) f on f.inscripcion_id = i.id
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
  from public.inscripcion_cursos ic
  join public.inscripciones i on i.id = ic.inscripcion_id
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
-- 17. HECHOS DENTRO DE UN PERIODO YA LIQUIDADO Y PAGADO
--     Regla de negocio 16: un periodo liquidado y pagado esta cerrado. Si
--     aparecen ventas, clases suspendidas o asistencias con fecha dentro de
--     el, alguien reescribio el pasado y la comision que se pago quedo sin
--     respaldo. Cuenta los hechos posteriores al cierre que caen ahi adentro.
--     El cierre es el ultimo dia del mes de la liquidacion mas nueva CON PAGO
--     (estado 'pagada' o 'cerrada': 'cerrada' es pago parcial).
-- ---------------------------------------------------------------------
with cierre as (
  select max((date_trunc('month', periodo) + interval '1 month - 1 day')::date) as hasta
    from public.liquidaciones
   where estado in ('pagada', 'cerrada') and periodo is not null
)
select '17. hechos dentro de un periodo pagado' as control,
       (select count(*) from public.inscripciones i, cierre
         where cierre.hasta is not null and i.creado_en::date > cierre.hasta
           and i.fecha_inicio <= cierre.hasta)
     + (select count(*) from public.sesiones s, cierre
         where cierre.hasta is not null and s.estado = 'suspendida'
           and s.fecha <= cierre.hasta and s.actualizado_en::date > cierre.hasta)
       as n,
       case when (select count(*) from public.inscripciones i, cierre
                   where cierre.hasta is not null and i.creado_en::date > cierre.hasta
                     and i.fecha_inicio <= cierre.hasta)
                + (select count(*) from public.sesiones s, cierre
                    where cierre.hasta is not null and s.estado = 'suspendida'
                      and s.fecha <= cierre.hasta and s.actualizado_en::date > cierre.hasta) = 0
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
         (select count(*) from public.inscripcion_cursos ic
           where ic.inscripcion_id = p.membresia_id) as cursos_del_plan,
         p.cursos_devengados,
         coalesce((select sum(pg.monto) from public.pagos pg
                     join public.cuotas cu on cu.id = pg.cuota_id
                    where cu.inscripcion_id = p.membresia_id and pg.tipo = 'cobro'), 0) as cobrado
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
     select 1 from public.inscripcion_cursos ic
      where ic.inscripcion_id = e.membresia_id
        and not exists (select 1 from public.comisiones_devengadas cd2
                         where cd2.membresia_id = e.membresia_id and cd2.curso_id = ic.curso_id)
        and exists (select 1 from public.sesiones s
                     join public.inscripciones i on i.id = e.membresia_id
                    where s.curso_id = ic.curso_id and s.estado = 'dictada'
                      and s.fecha between i.fecha_inicio and coalesce(i.fecha_fin, s.fecha))
   );

-- ---------------------------------------------------------------------
-- 15. UN CONCEPTO, UN NOMBRE: llaves a `inscripciones` con nombres distintos
--     La misma llave foranea se llama `inscripcion_id` en unas tablas y
--     `membresia_id` en otras. Es deuda conocida (D1 en docs/DECISIONES.md),
--     asi que HOY este control da REVISAR a proposito: esta ahi para que la
--     deuda no se olvide y para que NO se agregue una tercera grafia.
--
--     Si algun dia aparece un tercer nombre, el numero sube y se nota. Cuando
--     se ejecute D1 (unificar), este control tiene que quedar en OK y recien
--     ahi deja de ser un recordatorio.
-- ---------------------------------------------------------------------
select '15. nombres distintos para la llave a inscripciones' as control,
       count(distinct kcu.column_name) as n,
       case when count(distinct kcu.column_name) <= 1 then 'OK'
            else 'REVISAR (deuda conocida D1: ' ||
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
   and ccu.table_name = 'inscripciones'
   and ccu.column_name = 'id';

-- ---------------------------------------------------------------------
-- Detalle, por si algun control da REVISAR:
-- ---------------------------------------------------------------------
-- select id, alumno_id, curso_id, estado, fecha_inicio, fecha_fin,
--        clases_plan, clases_hechas, bono_generado
--   from inscripciones where plan_id is not null order by id;
--
-- select cu.id, cu.inscripcion_id, cu.periodo, cu.monto_devengado, cu.estado,
--        coalesce((select sum(p.monto) from pagos p where p.cuota_id = cu.id and p.tipo='cobro'), 0) as cobrado
--   from cuotas cu order by cu.inscripcion_id;
