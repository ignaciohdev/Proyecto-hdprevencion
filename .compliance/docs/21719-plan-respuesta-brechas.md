# Plan de Respuesta a Brechas de Datos Personales — [COMPLETAR: Razón Social definitiva en trámite con abogada]

**Empresa:** [COMPLETAR: Razón Social definitiva en trámite con abogada] · **RUT:** [COMPLETAR: RUT empresa tras constitución]  
**Responsable del plan (Art. 50):** [COMPLETAR: Nombre y correo del co-fundador responsable de datos] · **Contacto oficial:** [COMPLETAR: Correo oficial de privacidad, ej. privacidad@hdprevencion.cl]  
**Fecha:** 2026-11-25 · **Versión:** 1.0 (Reemplaza referencias a plazo GDPR de 72 horas contenidas en `PROTOCOLO_BRECHAS_SEGURIDAD_LEY_21719.md`)

> **Plazo legal verificado (Art. 14 sexies Ley N° 21.719, `sources/ley-21719-texto.txt` L715–L736):** El responsable debe reportar a la **Agencia de Protección de Datos Personales** *"por los medios más expeditos posibles y **sin dilaciones indebidas**"* cuando exista un riesgo razonable para los derechos y libertades de los titulares. **La Ley 21.719 NO fija un plazo de 72 horas** (ese límite proviene del estándar europeo GDPR). Asimismo, toda vulneración debe registrarse en `21719-registro-vulneraciones.md` **aunque no se notifique** (`L722-724`), y debe notificarse a los **titulares** cuando afecte **datos sensibles, niños/niñas menores de 14 años, o datos de obligaciones económicas, financieras, bancarias o comerciales** (`L726-733`).  
> **Rol de Encargado (Art. 15 bis inc. 4°, `L811-812`):** Si la brecha afecta datos tratados por cuenta de una empresa cliente, HD Prevención debe **reportar de inmediato al cliente Responsable** (plazo objetivo interno: ≤ 24 horas) para que éste evalúe y notifique a la Agencia y a sus titulares.

---

## 1. Roles del equipo (Microempresa en formación)
- **Coordinador del incidente / Responsable de datos:** [COMPLETAR: Nombre y teléfono/correo del co-fundador responsable]
- **Equipo técnico (contención en Django/Next.js/Render/Vercel):** [COMPLETAR: Nombre del co-fundador CTO / desarrollador]
- **Apoyo legal (opcional / reactivo ante fiscalización):** [COMPLETAR: Abogada de confianza]

---

## 2. Fase 1 — Detección y contención inmediata (0–4 horas)
1. **Registrar hora exacta de detección** (zona horaria `America/Santiago`), quién detecta y sistemas involucrados (`backend/Render`, `PostgreSQL`, `frontend/Vercel`, dispositivo en terreno).
2. **Contener el vector:**
   - Revocar sesiones activas: invalidar tokens en `token_blacklist` y rotar `SECRET_KEY` en Render (**PRECAUCIÓN CRÍTICA:** mientras `crypto.py` derive el cifrado desde `SECRET_KEY`, NO rotar `SECRET_KEY` sin haber migrado antes a una `FIELD_ENCRYPTION_KEY` independiente o recifrado los campos `enc:v1:`, ya que de otro modo se perdería acceso a los relatos Ley Karin y accidentes!).
   - Si hubo compromiso de `FIELD_ENCRYPTION_KEY` o credenciales de BD: generar nuevas credenciales en PostgreSQL/Render y re-cifrar campos sensibles con nueva llave.
   - Bloquear cuentas/IPs comprometidas, deshabilitar temporalmente endpoints afectados (ej. `PortabilidadDatosView`) y revocar llaves/tokens de despliegue en Render/Vercel/GitHub.
3. **Preservar evidencia:** exportar logs de Render, Vercel y `AuditLogAccesoDenuncia` antes de que expiren (en capa gratuita los logs son volátiles). Abrir entrada preliminar en `21719-registro-vulneraciones.md` (y en el modelo `RegistroBrechaSeguridad` una vez habilitado en admin/panel).

---

## 3. Fase 2 — Evaluación de impacto y alcance (4–24 horas)
1. **Naturaleza de la vulneración:** pérdida de **confidencialidad** (fuga, acceso no autorizado), **integridad** (alteración) o **disponibilidad** (destrucción, ransomware, pérdida de BD sin respaldo).
2. **Inventario de datos y volumen:** qué tablas/archivos fueron afectados (`Usuario`, `Trabajador`, `InvestigacionAccidente`, `DenunciaLeyKarin`, `EntregaEPP`, `documentos_contratistas/`), cuántos titulares aproximados y si los campos estaban cifrados (`enc:v1:`) o en texto plano.
3. **Evaluación de riesgo razonable y obligación de notificar:**
   - **¿Afecta datos sensibles** (salud laboral en `InvestigacionAccidente`, denuncias/atención psicológica en `DenunciaLeyKarin`, vulnerabilidades MIPER), **datos económicos/financieros/bancarios** o **menores de 14 años**? -> **Notificación OBLIGATORIA a titulares afectados** (Art. 14 sexies inc. 3°) y a la **Agencia** (si existe riesgo razonable, presumido en estos casos).
   - **¿Afecta datos gestionados como Encargado (Art. 15 bis)?** -> Notificar de inmediato a la empresa cliente Responsable entregando el detalle técnico.
   - **Si se concluye que NO existe riesgo razonable** (ej. incidente contenido antes de exfiltración o datos fuertemente cifrados sin compromiso de llave): documentar la justificación técnica en `21719-registro-vulneraciones.md`.

---

## 4. Fase 3 — Notificación (sin dilaciones indebidas)

### 4.1. A la Agencia de Protección de Datos Personales (Art. 14 sexies inc. 1° y 2°)
Enviar por el canal oficial más expedito disponible, **sin dilaciones indebidas** (meta operativa interna: primer reporte dentro de 24–48 horas o en cuanto se confirme la brecha, complementable por etapas):
1. Naturaleza de la vulneración sufrida (confidencialidad, integridad o disponibilidad).
2. Categorías de datos personales y número aproximado de titulares afectados.
3. Efectos y consecuencias probables para los titulares.
4. Medidas técnicas y organizativas adoptadas para contenerla, gestionarla y precaver incidentes futuros.
5. Datos de contacto del Responsable de datos (`[COMPLETAR: Nombre y correo]`).

### 4.2. A los clientes Responsables (cuando HD Prevención actúa como Encargado — Art. 15 bis inc. 4°)
Comunicar por escrito dentro de **≤ 24 horas** a la contraparte de la empresa cliente con el detalle de la tabla afectada, trabajadores/registros comprometidos y acciones de contención ejecutadas.

### 4.3. A los titulares afectados (Art. 14 sexies inc. 3°)
Obligatoria cuando exista riesgo razonable y afecte **datos sensibles**, **niños/niñas < 14 años**, o **datos económicos/financieros/bancarios/comerciales**. Comunicación directa a cada titular (por correo/aviso en lenguaje claro y sencillo; si no fuera posible contactar individualmente, mediante publicación en medio de comunicación social masivo de alcance nacional).

---

## 5. Fase 4 — Cierre, lecciones aprendidas y prevención
1. Determinar causa raíz (ej. endpoint sin autenticación, secreto filtrado, falta de MFA, pérdida de BD en capa gratuita).
2. Implementar corrección técnica definitiva y pruebas de no-regresión.
3. Completar el cierre en `21719-registro-vulneraciones.md` y en `RegistroBrechaSeguridad`.
4. Actualizar el RAT (`21719-rat.md`), la EIPD (`21719-eipd.md`) y re-correr la auditoría de cumplimiento.
5. *(Nota legal Art. 34 quáter letra f)*: Omitir en forma **deliberada** la comunicación de vulneraciones constituye **infracción gravísima** (sancionable con hasta 20.000 UTM según Art. 35).

---

## 6. Plantillas de comunicación (borradores listos)

### A. Aviso a la Agencia de Protección de Datos Personales
> **De:** [COMPLETAR: Razón Social definitiva en trámite], RUT [COMPLETAR: RUT]  
> **Contacto:** [COMPLETAR: Nombre y correo del responsable de datos]  
> **Asunto:** Reporte de vulneración a las medidas de seguridad — Art. 14 sexies Ley N° 21.719  
>
> Con fecha [FECHA Y HORA DETECCIÓN], detectamos una vulneración de seguridad de tipo [confidencialidad / integridad / disponibilidad] consistente en [DESCRIPCIÓN CLARA]. Los datos personales involucrados corresponden a [CATEGORÍAS, indicando si hay datos sensibles de salud o denuncias] respecto de aproximadamente [N] titulares. Consecuencias probables evaluadas: [RIESGOS]. Medidas inmediatas adoptadas para contener el incidente y precaver recurrencias: [MEDIDAS]. [Si aplica: Se ha procedido/procederá a comunicar a los titulares afectados y/o clientes responsables]. Quedamos a disposición de la Agencia para ampliar antecedentes.

### B. Aviso a Titulares Afectados (lenguaje claro y sencillo — Art. 14 sexies inc. 3°)
> Estimado/a [NOMBRE]:  
> El [FECHA] detectamos un incidente de seguridad en nuestra plataforma HD Prevención que afectó [DESCRIPCIÓN EN LENGUAJE SENCILLO]. Específicamente, los datos involucrados fueron: [LISTA EXACTA DE CATEGORÍAS DE DATOS].  
> **Posibles consecuencias:** [EJ. posible exposición de información de contacto / antecedentes de salud laboral].  
> **Qué hicimos de inmediato:** [EJ. bloqueamos el acceso no autorizado, rotamos credenciales y reforzamos controles].  
> **Qué te recomendamos hacer:** [EJ. cambiar tu contraseña si la reutilizas en otros servicios, estar atento a correos sospechosos / phishing].  
> Puedes contactarnos ante cualquier duda o para ejercer tus derechos en [COMPLETAR: Correo oficial de privacidad] o en `/derechos-arco`.

---
*Borrador generado con compliance-cl (pack ley-21719). No constituye asesoría legal; revisar con un abogado.*
