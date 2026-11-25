# Registro de Vulneraciones a las Medidas de Seguridad — [COMPLETAR: Razón Social definitiva en trámite con abogada]

> Conforme al **artículo 14 sexies inciso 2° de la Ley N° 21.719** (`sources/ley-21719-texto.txt`, L722–L724), el responsable debe mantener un registro interno de las vulneraciones a las medidas de seguridad (destrucción, filtración, pérdida, alteración o acceso/comunicación no autorizados), **aunque no se notifiquen a la Agencia**.  
> **Documento interno append-only.** Sincronizar este registro con la tabla `RegistroBrechaSeguridad` (`backend/modulo_prevencion/models.py:3422`), ya habilitada en Django Admin (`RegistroBrechaSeguridadAdmin`, `/sst-control-panel/modulo_prevencion/registrobrechaseguridad/`).

| # | Fecha detección (`America/Santiago`) | Quién detecta | Naturaleza de la vulneración | Datos afectados (categorías y rol Responsable/Encargado) | N° titulares aprox. | ¿Riesgo razonable / alto? | ¿Afecta sensibles, económicos/financieros o <14 años? | ¿Notificada a Agencia? (fecha/folio) | ¿Notificada a cliente Responsable (Art. 15 bis)? | ¿Notificada a titulares? | Medidas adoptadas y causa raíz |
|---|---|---|---|---|---|---|---|---|---|---|---|
| — | *(Sin incidentes reales registrados a la fecha 2026-11-25 — etapa demostración / pre-producción)* | — | — | — | — | — | — | — | — | — | — |

## Reglas de uso del registro
1. Registrar **toda** vulneración o incidente confirmado (incluidas pérdidas de disponibilidad en BD/archivos o exposiciones por error de autorización), se notifique o no externamente.
2. Documentar expresamente la fundamentación técnica cuando se concluya que no existe riesgo razonable para los derechos y libertades de los titulares.
3. No eliminar ni sobreescribir filas previas; ante actualizaciones de investigación, agregar una fila de seguimiento o anotar fecha de actualización.
4. Recordar: si afecta datos sensibles (salud laboral, denuncias Ley Karin), datos económicos/financieros/bancarios o menores de 14 años, **la comunicación a titulares es obligatoria** (Art. 14 sexies inc. 3°), y si se actúa como Encargado, debe avisarse al **cliente Responsable** (Art. 15 bis inc. 4°).

---
*Borrador generado con compliance-cl (pack ley-21719). No constituye asesoría legal; revisar con un abogado.*
