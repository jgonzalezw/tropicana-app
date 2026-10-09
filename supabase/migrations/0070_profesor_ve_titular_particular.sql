-- 0070: el Profesor ve al titular de las particulares que dicta y al tutor de sus menores.
-- contacto_visible_por_profesor (0048) cubria el propio contacto y los alumnos de los
-- cursos donde es o fue titular. Faltaba: (a) una particular no tiene curso, su profesor
-- esta en membresias.profesor_id; (b) el tutor de un menor visible. Las politicas de
-- contactos, contacto_redes, contacto_relaciones y consentimientos ya usan la funcion y no cambian.
--
-- contacto_visible_directo_por_profesor = las tres primeras condiciones (propio, alumno de un
-- curso suyo, titular de una particular suya); contacto_visible_por_profesor le suma el tutor
-- de un contacto visible directo (sin recursion). Mismas firmas y permisos que la 0050.
create or replace function public.contacto_visible_directo_por_profesor(p_contacto_id bigint)
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

create or replace function public.contacto_visible_por_profesor(p_contacto_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.contacto_visible_directo_por_profesor(p_contacto_id)
      or exists (
        select 1
          from public.contacto_relaciones r
         where r.tipo = 'tutor_de'
           and r.desde_id = p_contacto_id
           and public.contacto_visible_directo_por_profesor(r.hacia_id)
      );
$$;

revoke execute on function public.contacto_visible_directo_por_profesor(bigint) from public, anon;
grant execute on function public.contacto_visible_directo_por_profesor(bigint) to authenticated;

notify pgrst, 'reload schema';
