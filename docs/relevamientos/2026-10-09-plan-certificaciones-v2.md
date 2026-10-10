# Certificaciones sobre la base común (R20 · entrega 7a) — plan v2

> Extraído de la §6 del plan R20 v2 (`2026-10-09-plan-r20-notificaciones-v2.md`). Reemplaza al plan de la fase 4.

## Certificaciones sobre la base común (entrega 7a)

### 6.1 Qué entiendo por «certificaciones»
**Es una interpretación; si es otra cosa, corregime.** Entiendo que son los documentos emitidos para el alumno o titular con políticas, empezando por el **reporte de la membresía (D06) con su hoja 2 de políticas P01–P03**.

El mockup es `design_handoff_reporte_membresia/Ficha de membresia.dc.html`. Sus ajustes de «Políticas» ya enlazan cada campo con su origen.

### 6.2 Compatibilidad del mockup con la base común
| Campo del mockup | Origen | Encaje |
|---|---|---|
| `plazoCancel` | `parametros.reserva_cancelacion_plazo_horas` | variable del esquema P02/P03, congelada en la emisión |
| `solicitudValidez` | `parametros.reserva_solicitud_validez_horas` | ídem |
| `pruebaAcreditaDias` | `planes.prueba_plazo_dias`, y si no tiene, `parametros.prueba_plazo_dias` (0023) | ídem. El adaptador resuelve el orden. |
| `politicaVersion` | `contenido_versiones.etiqueta` de la política **fijada en la composición** | antes era «la vigente»; ahora es la versión exacta liberada |
| `politicaOficialUrl` | `contenido_versiones.url_oficial` | «Ver política oficial completa» solo si existe |
| Hoja 1 (estado) | `obtenerMembresia` (fichas) | se renderiza y se guarda el **snapshot** en `documentos_emitidos` |

**Cambios visibles que necesitan revisión de Design:**
- la versión y la emisión visibles («Emitido el … · versión …»);
- reimprimir una emisión anterior frente a emitir una nueva;
- la entrada en el historial;
- los estados del envío (preparado, abierto, copiado, declarado), **sin «enviado» al abrir WhatsApp**;
- el estado «sin política liberada para este tipo».

### 6.3 Reglas
- Cada emisión guarda el contenido renderizado, las versiones de la composición y de cada política, y los parámetros resueltos.
- **Reimprimir dibuja el snapshot.** Emitir de nuevo crea otra emisión.
- Las políticas base P01–P03 se cargan como **predeterminado o borrador** con los textos literales de las guías de octubre de 2026 (handoff `referencias/`), en la importación idempotente. Una versión oficial solo existe si la publicás (§6.5).
- **Política aplicable ≠ política vigente al emitir.**
  - La política aplicable es la que rige esa membresía. La vigente al emitir es la última publicada.
  - El documento muestra la **aplicable**.
  - No se aplican condiciones posteriores a membresías anteriores sin una regla expresamente aprobada.
- **Decisión C4 (pendiente, condiciona E7a):** cómo se determina la política aplicable de una membresía. Una opción es la versión liberada a la fecha de la venta, guardada con la membresía. Hoy los parámetros (por ejemplo `reserva_cancelacion_plazo_horas`) son globales y no tienen snapshot por membresía, así que hay que decidir qué valor rige para las anteriores.
- Cada emisión guarda la **copia** de los parámetros y versiones usados. La reimpresión reproduce la emisión original.

### 6.4 Plan viejo de la fase 4: qué queda sin efecto
El plan viejo se marca «antecedente archivado, no ejecutable». Quedan anuladas estas instrucciones:
- las tablas `politicas` y `membresia_eventos`;
- la selección de política por `vigente_desde ≤ hoy`;
- registrar «Reporte enviado por WhatsApp» al tocar el botón.

Siguen valiendo como insumo:
- las respuestas sobre hoja 1, impresión y PDF, y las clases futuras;
- `ImprimirCuenta`/`construirHTMLImpresion` como patrón;
- el e2e por tipo.

### 6.5 Dependencias mínimas
Las certificaciones necesitan:
- de **E4**: el motor, `contenidos`/`contenido_versiones` y `documentos_emitidos`;
- de **E3**: la revisión del mockup;
- para el envío asistido: `avisos` y `aviso_acciones` (también en E4).

**No necesitan** E5 (conectar N09–N10) ni E6 (el editor).

**Publicación oficial sin editor.** Una migración **solo** puede importar contenido como predeterminado o borrador; **nunca lo publica**. Mientras no exista el editor, el procedimiento mínimo y auditable es este:
1. Se presenta la versión exacta (id, hash, texto renderizado con datos ficticios) y los usos a liberar, en el PR o en el turno.
2. Vos aprobás explícitamente **esa versión y esos usos**.
3. Una acción del servidor, `publicarVersion(version_id, usos, evidencia)`, ejecutada con tu sesión:
   - verifica `comunicaciones.publicar` y que el hash coincida con el aprobado;
   - registra en `contenido_usos_historial` el actor, la fecha, el hash y la referencia de la aprobación (PR o fecha del turno).
4. Sin esa fila no hay versión oficial. El control SQL lo verifica.
