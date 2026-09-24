-- =====================================================================
-- TROPICANA - 0051: plantilla de URL de perfil por red social
-- ---------------------------------------------------------------------
-- PARA QUE. Javier pidio que el "@usuario" de una red social abra el
-- perfil real en una pestana nueva, y que el WhatsApp de un contacto abra
-- el chat. `redes_sociales.patron_url` existe desde la 0048 pero estaba
-- vacio: sin plantilla no hay de donde armar el link (regla de negocio 13
-- -- las plantillas van al catalogo, no al codigo).
--
-- QUE HACE. Siembra `patron_url` de las 4 redes ya cargadas, con
-- `{usuario}` como marcador. Es un UPDATE condicionado a `is null`: si
-- alguien ya cargo una plantilla propia (desde la pantalla de catalogos o
-- a mano), esta migracion no la pisa.
--
-- WHATSAPP COMO RED (distinto del whatsapp propio del contacto): usa
-- wa.me igual que el chat, para quien cargue un WhatsApp de la academia o
-- de un tercero como "red social" en vez de como su numero de contacto.
-- =====================================================================

update public.redes_sociales set patron_url = 'https://www.instagram.com/{usuario}'
 where clave = 'instagram' and patron_url is null;

update public.redes_sociales set patron_url = 'https://www.facebook.com/{usuario}'
 where clave = 'facebook' and patron_url is null;

update public.redes_sociales set patron_url = 'https://www.tiktok.com/@{usuario}'
 where clave = 'tiktok' and patron_url is null;

update public.redes_sociales set patron_url = 'https://wa.me/{usuario}'
 where clave = 'whatsapp' and patron_url is null;

notify pgrst, 'reload schema';
