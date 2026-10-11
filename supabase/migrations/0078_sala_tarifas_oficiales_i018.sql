-- =====================================================================
-- 0078 -- I-018 (S1): tarifas oficiales de alquiler de sala.
-- Fuente: 'Alquiler de Sala.xlsx' (validada por Javier). 8 tramos de horas
-- x 4 categorias x 3 tamanos = 96 precios generales (sala_id NULL: valen
-- para todas las salas). Sobrescribe los de 1 h que habia.
-- Numero fuera de secuencia a proposito: 0075-0077 estan reservadas (R20 E4c).
-- Respaldo: sala_tarifas_previo_i018 y sala_horas_paquete_previo_i018.
-- Rollback (al final, comentado).
-- =====================================================================

create table if not exists public.sala_tarifas_previo_i018 as
  select * from public.sala_tarifas;
create table if not exists public.sala_horas_paquete_previo_i018 as
  select * from public.sala_horas_paquete;
alter table public.sala_tarifas_previo_i018 enable row level security;
alter table public.sala_horas_paquete_previo_i018 enable row level security;

-- Tramos de horas que faltan (el 1 h ya existe).
insert into public.sala_horas_paquete (horas, orden)
select h, h::int
  from generate_series(2, 8) as h
 where not exists (select 1 from public.sala_horas_paquete p where p.horas = h);

with oficial(horas, categoria, tamano, precio) as (values
  (1, 'alumno', 'individual', 30),
  (1, 'alumno', 'pareja', 30),
  (1, 'alumno', 'grupo', 60),
  (1, 'profesor_tropicana', 'individual', 30),
  (1, 'profesor_tropicana', 'pareja', 30),
  (1, 'profesor_tropicana', 'grupo', 60),
  (1, 'profesor_externo', 'individual', 50),
  (1, 'profesor_externo', 'pareja', 50),
  (1, 'profesor_externo', 'grupo', 70),
  (1, 'tercero', 'individual', 70),
  (1, 'tercero', 'pareja', 70),
  (1, 'tercero', 'grupo', 80),
  (2, 'alumno', 'individual', 55),
  (2, 'alumno', 'pareja', 55),
  (2, 'alumno', 'grupo', 110),
  (2, 'profesor_tropicana', 'individual', 55),
  (2, 'profesor_tropicana', 'pareja', 55),
  (2, 'profesor_tropicana', 'grupo', 110),
  (2, 'profesor_externo', 'individual', 90),
  (2, 'profesor_externo', 'pareja', 90),
  (2, 'profesor_externo', 'grupo', 125),
  (2, 'tercero', 'individual', 125),
  (2, 'tercero', 'pareja', 125),
  (2, 'tercero', 'grupo', 145),
  (3, 'alumno', 'individual', 80),
  (3, 'alumno', 'pareja', 80),
  (3, 'alumno', 'grupo', 155),
  (3, 'profesor_tropicana', 'individual', 80),
  (3, 'profesor_tropicana', 'pareja', 80),
  (3, 'profesor_tropicana', 'grupo', 155),
  (3, 'profesor_externo', 'individual', 130),
  (3, 'profesor_externo', 'pareja', 130),
  (3, 'profesor_externo', 'grupo', 185),
  (3, 'tercero', 'individual', 185),
  (3, 'tercero', 'pareja', 185),
  (3, 'tercero', 'grupo', 210),
  (4, 'alumno', 'individual', 100),
  (4, 'alumno', 'pareja', 100),
  (4, 'alumno', 'grupo', 205),
  (4, 'profesor_tropicana', 'individual', 100),
  (4, 'profesor_tropicana', 'pareja', 100),
  (4, 'profesor_tropicana', 'grupo', 205),
  (4, 'profesor_externo', 'individual', 170),
  (4, 'profesor_externo', 'pareja', 170),
  (4, 'profesor_externo', 'grupo', 240),
  (4, 'tercero', 'individual', 240),
  (4, 'tercero', 'pareja', 240),
  (4, 'tercero', 'grupo', 275),
  (5, 'alumno', 'individual', 125),
  (5, 'alumno', 'pareja', 125),
  (5, 'alumno', 'grupo', 255),
  (5, 'profesor_tropicana', 'individual', 125),
  (5, 'profesor_tropicana', 'pareja', 125),
  (5, 'profesor_tropicana', 'grupo', 255),
  (5, 'profesor_externo', 'individual', 210),
  (5, 'profesor_externo', 'pareja', 210),
  (5, 'profesor_externo', 'grupo', 295),
  (5, 'tercero', 'individual', 295),
  (5, 'tercero', 'pareja', 295),
  (5, 'tercero', 'grupo', 335),
  (6, 'alumno', 'individual', 150),
  (6, 'alumno', 'pareja', 150),
  (6, 'alumno', 'grupo', 300),
  (6, 'profesor_tropicana', 'individual', 150),
  (6, 'profesor_tropicana', 'pareja', 150),
  (6, 'profesor_tropicana', 'grupo', 300),
  (6, 'profesor_externo', 'individual', 250),
  (6, 'profesor_externo', 'pareja', 250),
  (6, 'profesor_externo', 'grupo', 350),
  (6, 'tercero', 'individual', 350),
  (6, 'tercero', 'pareja', 350),
  (6, 'tercero', 'grupo', 400),
  (7, 'alumno', 'individual', 175),
  (7, 'alumno', 'pareja', 175),
  (7, 'alumno', 'grupo', 350),
  (7, 'profesor_tropicana', 'individual', 175),
  (7, 'profesor_tropicana', 'pareja', 175),
  (7, 'profesor_tropicana', 'grupo', 350),
  (7, 'profesor_externo', 'individual', 290),
  (7, 'profesor_externo', 'pareja', 290),
  (7, 'profesor_externo', 'grupo', 410),
  (7, 'tercero', 'individual', 410),
  (7, 'tercero', 'pareja', 410),
  (7, 'tercero', 'grupo', 465),
  (8, 'alumno', 'individual', 200),
  (8, 'alumno', 'pareja', 200),
  (8, 'alumno', 'grupo', 400),
  (8, 'profesor_tropicana', 'individual', 200),
  (8, 'profesor_tropicana', 'pareja', 200),
  (8, 'profesor_tropicana', 'grupo', 400),
  (8, 'profesor_externo', 'individual', 330),
  (8, 'profesor_externo', 'pareja', 330),
  (8, 'profesor_externo', 'grupo', 500),
  (8, 'tercero', 'individual', 465),
  (8, 'tercero', 'pareja', 465),
  (8, 'tercero', 'grupo', 530)
)
insert into public.sala_tarifas (sala_id, categoria, tamano, horas_paquete_id, precio, actualizado_en)
select null, o.categoria, o.tamano, p.id, o.precio, now()
  from oficial o
  join public.sala_horas_paquete p on p.horas = o.horas
on conflict on constraint sala_tarifas_coordenada_uk
do update set precio = excluded.precio, actualizado_en = now();

notify pgrst, 'reload schema';

-- ROLLBACK (probar fila por fila contra los respaldos):
--   delete from public.sala_tarifas;
--   insert into public.sala_tarifas select * from public.sala_tarifas_previo_i018;
--   delete from public.sala_horas_paquete
--    where id not in (select id from public.sala_horas_paquete_previo_i018);
-- =====================================================================
-- FIN 0078
-- =====================================================================
