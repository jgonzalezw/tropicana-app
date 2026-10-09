-- 0070: el Profesor ve al titular de las particulares que dicta.
-- contacto_visible_por_profesor (0048) cubria el propio contacto y los alumnos de los
-- cursos donde es o fue titular. Una particular no tiene curso: su profesor esta en
-- membresias.profesor_id. Se agrega esa condicion; las politicas de contactos,
-- contacto_redes, contacto_relaciones y consentimientos ya usan la funcion y no cambian.
-- Misma firma: los permisos de ejecucion (0050) se conservan.
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
    )
    or exists (
      select 1
        from public.profesores pr
        join public.membresias m on m.profesor_id = pr.id
       where pr.usuario_id = auth.uid() and m.contacto_id = p_contacto_id
    );
$$;

notify pgrst, 'reload schema';
