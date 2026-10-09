-- ---------------------------------------------------------------------
-- 0068 · Interruptor del menú lateral plegable (I-012, fase 2, commit 9)
--
-- `menu_plegable`: apagado = la barra lateral queda exactamente como antes.
-- Encendido = riel de íconos que se despliega al pasar el mouse o con Tab,
-- con clavo para fijarlo; la preferencia de cada persona vive en su
-- navegador (localStorage) y por defecto arranca fijo (abierto).
-- Global por entorno (regla 14: nada se decide por persona).
--
-- Reversa: delete from public.parametros where clave = 'menu_plegable';
-- ---------------------------------------------------------------------
insert into public.parametros (clave, valor, tipo, nombre, descripcion, grupo)
select 'menu_plegable', 'false', 'booleano',
       'Menú lateral plegable',
       'Si el menú lateral se puede plegar a un riel de íconos (se despliega al pasar el mouse '
       'y se puede fijar con el clavo). Apagado, el menú queda como antes. Cada persona elige '
       'si lo quiere fijo o plegado; por defecto arranca fijo.',
       'Sistema'
where not exists (select 1 from public.parametros where clave = 'menu_plegable');

notify pgrst, 'reload schema';
