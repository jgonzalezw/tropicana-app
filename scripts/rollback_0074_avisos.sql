-- =====================================================================
-- TROPICANA - rollback de la 0074 (R20 E4b/E5: registro de avisos).
-- Es un rollback de INSTALACION VACIA: aborta si ya hay avisos o acciones
-- (el historial de avisos no se descarta). Solo ASCII.
-- =====================================================================
do $$
begin
  if (select count(*) from public.avisos) > 0 or (select count(*) from public.aviso_acciones) > 0 then
    raise exception 'Rollback 0074 abortado: hay avisos o acciones registrados (no se descartan)';
  end if;
end $$;

drop function if exists public.acciones_de_aviso(bigint);
drop function if exists public.leer_avisos_de_evento(bigint, text, text);
drop function if exists public.usar_respaldo_aviso(bigint, text);
drop function if exists public.registrar_aviso_accion(bigint, text, text, bigint);
drop function if exists public.reintentar_aviso(bigint, text, text, jsonb, text, text);
drop function if exists public.registrar_aviso(text, text, text, text, text, text, bigint, bigint, text, text, jsonb, text, text);
drop function if exists public.puede_registrar_aviso(bigint);
drop function if exists public.puede_operar_membresia_reserva(bigint, text);

drop table if exists public.aviso_acciones;
drop table if exists public.avisos;
drop function if exists public.aviso_acciones_solo_insert();
drop function if exists public.avisos_guardia();

drop trigger if exists contactos_revision_destino on public.contactos;
drop function if exists public.contactos_revision_destino();
alter table public.contactos drop column if exists whatsapp_revision, drop column if exists email_revision;

-- Valores de catalogo: solo si ninguna fila los usa.
delete from public.catalogo_valores v
 using public.catalogos c
 where v.catalogo_id = c.id and c.clave = 'finalidad_consentimiento'
   and v.valor in ('servicio', 'comercial', 'todas')
   and not exists (select 1 from public.consentimientos k where k.finalidad = v.valor);

notify pgrst, 'reload schema';
