# Instructivo Operativo — Ley 21.719 (HD Prevención)

Manual práctico para consulta rápida del responsable de datos (`[COMPLETAR: Nombre y correo del co-fundador responsable de datos]`) ante eventos operativos de privacidad y seguridad. Basado en el pack activo **`ley-21719`** y verificado contra `sources/ley-21719-texto.txt`.

> **Nota sobre rol dual (Art. 15 bis):** HD Prevención actúa como **Responsable** respecto de usuarios/prevencionistas de la plataforma y contactos comerciales, y como **Encargado** respecto de trabajadores, capacitaciones, EPP, accidentes y denuncias Ley Karin de las empresas clientes. Ante derechos o brechas de datos de trabajadores, **coordina siempre con la empresa cliente Responsable**.

---

## A. Llega una solicitud de derechos del titular (ARCO-POL o Bloqueo)
**Plazo general (Art. 11):** **30 días corridos**, prorrogable **una sola vez hasta por 30 días corridos** más (avisando al titular antes del vencimiento).  
**Plazo especial de Bloqueo Temporal (Art. 11 inc. 6°):** **2 días hábiles** siguientes a la recepción de una solicitud fundada vinculada a rectificación, supresión u oposición.  
**Gratuidad (Art. 10):** Rectificación, supresión y oposición son **siempre gratuitas**. El acceso es gratuito **al menos una vez por trimestre** (solo se pueden cobrar costos directos si solicita acceso/portabilidad más de una vez en el mismo trimestre).

1. **Registra y acusa recibo:** verifica que la solicitud esté en `SolicitudDerechoARCO` (o ingrésala si llegó por correo a `[COMPLETAR: Correo oficial de privacidad]`), anotando fecha, titular y derecho pedido.
2. **Verifica identidad (Art. 11 a):** **NUNCA entregues datos ni ejecutes cambios solo por el RUT.** Valida sesión autenticada o confirmación por correo/OTP o validación junto a la empresa cliente Responsable (si eres Encargado, avisa al cliente en ≤ 48h).
3. **Ubica los datos:** revisa las tablas Django asociadas (`Usuario`, `DocumentoUsuario`, `MensajeContacto`, `SolicitudCapacitacion`, `Trabajador`, `EntregaEPP`, `RegistroCapacitacion`, `InvestigacionAccidente`, `DenunciaLeyKarin`, `ReporteRiesgo`, `SugerenciaLaboral`, `TrabajadorSubcontratado`), archivos en `MEDIA_ROOT` y copias en respaldos.
4. **Ejecuta según derecho:**
   - **Acceso (Art. 5):** entrega copia comprensible + origen, finalidad, destinatarios y plazo de conservación (sin revelar secretos de terceros ni vulnerar reserva Ley Karin Art. 211-B CT).
   - **Portabilidad (Art. 9):** exporta en JSON estructurado o CSV tras autenticar identidad.
   - **Rectificación (Art. 6):** corrige el dato y comunica el cambio a destinatarios si corresponde.
   - **Supresión (Art. 7):** verifica si hay deber legal de conservación:
     - *Retener obligatoriamente 5 años:* `InvestigacionAccidente`, `DenunciaLeyKarin`, `EntregaEPP`, `RegistroCapacitacion` (Ley 16.744 / SUSESO / Ley 21.643 / D.S. 44) y datos contables/tributarios **3–6 años** (Código Tributario arts. 17 inc. 2° y 200).
     - *Suprimir o anonimizar en transacción:* todo dato sin causal legal vigente o cuyo plazo ya venció (poner PII en `NULL`/anonimizado, no solo soft-delete).
   - **Oposición (Art. 8):** detén el tratamiento objetado (comunicaciones, marketing, interés legítimo).
   - **Bloqueo temporal (Art. 8 ter / Art. 11):** congela el tratamiento (sin borrar almacenamiento) en ≤ 2 días hábiles mientras se resuelve el fondo. Si lo rechazas, fundamenta y **comunica electrónicamente el rechazo a la Agencia**.
5. **Responde por escrito y guarda evidencia:** remite respuesta escrita al correo/domicilio fijado y conserva copia íntegra y comprobante de envío (Art. 11 inc. 3°). Si deniegas total o parcialmente, cita la ley exacta e informa el plazo de **30 días hábiles** para reclamar ante la Agencia (Art. 11 inc. 4°).

---

## B. Ocurre una brecha de seguridad (fuga, acceso no autorizado, pérdida o alteración)
**Plazo legal (Art. 14 sexies):** Notificar a la Agencia **sin dilaciones indebidas** cuando exista riesgo razonable para los derechos de los titulares (**la Ley 21.719 NO fija 72 horas**; 72h es estándar GDPR).  
**Si afecta datos de clientes (Encargado, Art. 15 bis):** Avisa al **cliente Responsable** en **≤ 24 horas**.

1. **Contén (0–4h):** revoca sesiones (`token_blacklist`), bloquea acceso comprometido, desactiva endpoint vulnerable, cambia credenciales de BD y preserva logs antes de rotar nada. *(Cuidado: no rotar `SECRET_KEY` mientras `crypto.py` derive la llave de cifrado desde ella sin recifrar primero.)*
2. **Evalúa (4–24h):** qué tablas/archivos, cuántos titulares aprox., si los campos estaban cifrados (`enc:v1:`) o en texto plano, y si hubo datos sensibles / económicos / <14 años. Si fue en Render/Vercel, solicita reporte técnico al proveedor.
3. **Notifica (sin dilaciones indebidas):**
   - A la **Agencia de Protección de Datos Personales:** naturaleza, categorías, volumen aproximado, consecuencias probables, medidas tomadas y contacto.
   - Al **cliente Responsable** (si eres Encargado).
   - A los **titulares afectados** en lenguaje claro y sencillo cuando haya riesgo alto o afecte **datos sensibles** (salud laboral, Ley Karin), **datos económicos/financieros/bancarios** o **niños < 14 años** (Art. 14 sexies inc. 3°).
4. **Registra:** anota el incidente en `.compliance/docs/21719-registro-vulneraciones.md` (y en `RegistroBrechaSeguridad`) **aunque decidas no notificar** por ausencia de riesgo razonable.
5. **Cierra:** documenta causa raíz, despliega parche definitivo y actualiza RAT, EIPD y Plan de Brechas. *(Omitir deliberadamente la notificación es infracción gravísima, Art. 34 quáter f.)*

---

## C. Fiscalización o requerimiento de la Agencia de Protección de Datos Personales
> **Nota sobre abogado (único caso reactivo recomendado):** Para contestar un procedimiento formal o pliego de cargos ante la Agencia o tribunales (patrocinio legal), acude a **[ABOGADO]** usando el expediente ya armado en `.compliance/`.

1. Designa un contacto único (`[COMPLETAR: Responsable de datos]` + apoyo legal si escala). Toda respuesta por escrito.
2. Identifica la etapa: solicitud preliminar de antecedentes vs. formulación de cargos (procedimiento sancionatorio).
3. Reúne el expediente desde `.compliance/`: `21719-rat.md`, `21719-politica-privacidad.md`, `21719-dpa.md`, `21719-anexo-transferencias.md`, `21719-eipd.md`, `21719-registro-vulneraciones.md`, `21719-plan-respuesta-brechas.md`, evidencia de consentimientos y logs.
4. Responde en plazo cargo por cargo acreditando diligencia y remediación rápida.
5. **Atenuantes y régimen MIPYME:** recuerda invocar el **Art. sexto transitorio** (amonestación escrita en los primeros 12 meses de vigencia 1-dic-2026 → 1-dic-2027 para empresas de menor tamaño Ley 20.416) y atenuantes del **Art. 36** (autodenuncia, colaboración, reparación, ausencia de sanciones previas).
6. **Nunca:** ocultar ni destruir documentos ni dejar vencer plazos.

---

## D. Cambios normativos o técnicos (drift)
1. Si se publican reglamentos de la Ley 21.719 (ej. DS 662/2025 del MPI o instrucciones generales de la Agencia) o se agregan modelos/proveedores externos (ej. API de correo o IA en runtime), actualiza fuentes y vuelve a correr la auditoría `compliance-cl` para comparar contra `.compliance/state.json`.

---

## E. Calendario de revisión (Ley 21.719)
| Cuándo | Qué | Responsable |
|---|---|---|
| **Antes de salir a producción real** | Migrar de capa gratuita a BD/Storage de pago, completar `[COMPLETAR]` tras escritura, cerrar brechas técnicas críticas (`PortabilidadDatosView`, `FIELD_ENCRYPTION_KEY`, `sw.js`, MFA) y suscribir DPAs + Cláusulas Modelo con Render/Vercel | Co-fundadores (CTO + Responsable de datos) |
| **Al firmar con cada empresa cliente** | Incorporar/aceptar DPA (Art. 15 bis) y verificar deber de información en su portal QR | Responsable comercial / legal |
| **Al sumar proveedor externo o feature con PII** | Actualizar RAT, Anexo de Transferencias (RAEX202503748 si es fuera de Chile) y EIPD si cambia el riesgo | CTO + Responsable de datos |
| **Cada release relevante / mensual** | Re-correr auditoría `compliance-cl` (detectar *drift*) y watcher de secretos/alertas | CTO / Dev |
| **Anual (cada 12 meses)** | Revisión integral del RAT, pruebas de restauración de backups, purga/anonimización de plazos vencidos y simulacro de brecha | Responsable de datos |

---
*Guía operativa generada con compliance-cl (pack ley-21719). No constituye asesoría legal.*
