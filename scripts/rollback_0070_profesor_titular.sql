-- Rollback de la 0070: vuelve la funcion a su definicion de la 0048 y borra el ayudante
-- contacto_visible_directo_por_profesor. No toca datos.
create or replace function public.contacto_visible_por_profesor(p_contacto_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.profesores pr
       where pr.usuario_id = auth.uid() and pr.contacto_id = p_contacto_id
    )
    or exists (
      select 1
        from public.profesores pr
        join public.asignaciones asg on asg.profesor_id = pr.id
        join public.membresia_cursos mc on mc.curso_id = asg.curso_id
        join public.membresias m on m.id = mc.membresia_id
        join public.alumnos al on al.id = m.alumno_id
       where pr.usuario_id = auth.uid() and al.contacto_id = p_contacto_id
    );
$$;
drop function if exists public.contacto_visible_directo_por_profesor(bigint);
notify pgrst, 'reload schema';
