# Ajustes al orquestador de agentes — HD Prevención

**Base:** `agentes/orquestador.py` completo (1.265 líneas). **Motor por defecto:** Ollama `qwen2.5-coder:7b`, contexto de 16.384 tokens. Por eso los bloques de abajo son cortos y en forma de checklist: un modelo de 7B sigue mejor reglas breves y concretas que prosa larga.

**Cómo aplicarlo:** cada bloque se pega al final de su prompt, antes de `## FORMATO DE RESPUESTA` en el prevencionista. Donde dice "reemplazar", cambia la línea indicada.

---

## 0. Antes de tocar los prompts: tres problemas en las herramientas

Estos afectan más la calidad de las respuestas que cualquier texto del prompt.

### 0.1 `leer_archivo` puede dejar sin contexto al modelo y también leer secretos
- **Tamaño:** devuelve el archivo completo. `reportes-riesgo/page.tsx` (~1.800 líneas) ocupa más de lo que cabe en 16.384 tokens junto con el prompt, y el modelo pierde el inicio de la conversación.
- **Secretos:** `normpath` no impide salir de la raíz (`../`) y el agente puede pedir `.env` (claves de Gemini, `DATABASE_URL`, `SECRET_KEY`). Con el motor Gemini ese contenido se envía a la nube.

Cambio sugerido:

```python
BLOQUEADOS = {"db.sqlite3"}
EXT_BLOQUEADAS = (".pem", ".key", ".sqlite3")

def _ruta_segura(ruta_relativa: str) -> str | None:
    raiz = os.path.realpath(ruta_raiz)
    ruta = os.path.realpath(os.path.join(raiz, ruta_relativa))
    try:
        if os.path.commonpath([raiz, ruta]) != raiz:
            return None
    except ValueError:  # distinta unidad en Windows
        return None
    nombre = os.path.basename(ruta).lower()
    if nombre.startswith(".env") or nombre in BLOQUEADOS or nombre.endswith(EXT_BLOQUEADAS):
        return None
    return ruta
```

Y que `leer_archivo(ruta_relativa, inicio_linea=1, fin_linea=300)` lea como máximo 300 líneas por llamada y termine con "Líneas X–Y de TOTAL. Continúa con inicio_linea=Y+1". Es el mismo patrón que ya usas en `leer_documento_normativo`.

### 0.2 `comando_git` no es de solo lectura
La lista permite `branch`, y `git branch -D <rama>` borra ramas. `diff` y `log` aceptan `--output=<archivo>`, que escribe a disco. Bloquear estos argumentos:

```python
ARGS_PROHIBIDOS = {"--output", "-d", "-D", "-m", "-M", "-c", "-C", "--delete",
                   "--move", "--copy", "-f", "--force", "--set-upstream"}
if any(a.split("=")[0] in ARGS_PROHIBIDOS for a in partes[1:]):
    return "Error: argumento no permitido en modo solo lectura."
```
(Algún falso positivo, como `log -c`, es aceptable.)

### 0.3 `buscar_en_normativa` devuelve ruido
La condición `all(...) or any(...)` equivale a `any`. Con una búsqueda como "artículo 18", casi cualquier línea del decreto coincide con "artículo", y la función devuelve las primeras 3–4 que encuentra, no las mejores. Un modelo de 7B las tomará como la cita.

Cambio sugerido:
- Ignorar palabras vacías (`los`, `las`, `del`, `por`, `para`, `con`, `una`, `que`).
- Puntuar cada línea por cuántas palabras coinciden y ordenar de mayor a menor (primero las que contienen **todas**).
- Devolver hasta 5 bloques, con el nombre del archivo y la línea.

**Por qué importa ahora:** necesitas esta herramienta fiable para confirmar contra `Decreto-44.md` lo que quedó pendiente: umbrales de CPHS, Departamento de Prevención y delegado SST, y el artículo de la ODI.

---

## 1. Agente Prevencionista

### Reemplazar en el marco legal
- Cambiar "Vigencia 2025" por: "vigente desde el 1-feb-2025".
- **Agregar como marco complementario** (decisión deliberada, fuera de la lista original): Ley 19.799 (firma electrónica) y Ley 21.719 (datos personales, vigente desde el 1-dic-2026).

### Pegar antes de `## FORMATO DE RESPUESTA`

```
## REGLAS DE VERACIDAD (PRIORIDAD ALTA)
1. Cita un artículo SOLO si lo leíste en esta conversación con `buscar_en_normativa` o `leer_documento_normativo`. Si no lo encuentras, escribe "No verificado en doc_agents". Si dudas del número, cita solo el decreto (ej. "DS 44").
2. DS 40 y DS 54 están DEROGADOS desde el 1-feb-2025. Nunca los uses como base legal vigente. Si los ves en código o textos, repórtalo como hallazgo con archivo y línea.
3. PENDIENTE DE VALIDACIÓN POR ABOGADO LABORAL (decláralo así, no lo des por resuelto): anonimato y requisitos formales de la denuncia Ley Karin (Art. 211-B del Código del Trabajo) y si los plazos son hábiles o corridos.
4. Si una herramienta falla o no devuelve resultados, dilo. Nunca rellenes con suposiciones. Esta regla prima sobre "nunca digas que no puedes".

## CHECKLIST DE AUDITORÍA (aplica según el módulo)
- Ley Karin: sugerencias/avisos separados de denuncias formales; denuncia con receptor designado por la empresa; medidas de resguardo; remisión a la DT en 3 días cuando corresponda; acceso restringido y registrado.
- Accidentes: DIAT/DIEP; alerta de 24 h; grave/fatal = suspensión de faena y aviso inmediato a Seremi de Salud e Inspección del Trabajo; registro de incidentes y sucesos peligrosos; índices (frecuencia, gravedad, accidentabilidad, siniestralidad).
- CPHS: se rige por DS 44, no DS 54. Constitución, elecciones, actas, sesiones y vencimiento de mandatos. Umbrales: verifícalos en Decreto-44.md.
- Firma electrónica: es firma simple (Ley 19.799). Exige RUT válido (módulo 11), timestamp de servidor, IP, user-agent, hash y no duplicidad.
- Contratistas (DS 76): no solo documentos; programa de trabajo, reglamento especial y coordinación.
- Datos personales: salud y denuncias son datos sensibles; verifica política de privacidad, retención y acceso restringido.
```

---

## 2. Agente Base de Datos

### Reemplazar
- "Django 4.2 LTS" → "Django 4.2 (en migración a 5.2 LTS; sin APIs deprecadas)".
- En "Contexto del SaaS": quitar "Empresas, Faenas, Puestos de Trabajo, Peligros, Medidas de Control y Auditorías" como si ya existieran. Esas entidades todavía no están; el prompt hoy puede llevar al agente a asumirlas.

### Pegar al final

```
## ACTUALIZACIÓN DE ARQUITECTURA (VIGENTE)
- Estado actual: casi todo cuelga del usuario prevencionista. Objetivo: EmpresaCliente -> CentroTrabajo -> Trabajador. Todo registro operativo (riesgos, inspecciones, accidentes, capacitaciones, EPP) lleva FK a EmpresaCliente y, cuando aplique, a CentroTrabajo. Asistentes y firmas referencian a Trabajador.
- Multi-tenant: todo modelo operativo lleva la cuenta propietaria. Las consultas siempre filtran por tenant; nunca un queryset global.
- Acceso público (QR): toda tabla accesible por QR usa un campo `token_publico` (UUID4 o secrets.token_urlsafe), único e indexado. El `id` autoincremental nunca se expone. El token de una charla caduca al cerrarla; el del prevencionista debe poder rotarse.
- Migración a UUID en 3 pasos: (1) campo nullable, (2) RunPython que rellena por lotes, (3) único y no nulo. No cambies el PK existente.
- Compatibilidad: el desarrollo puede usar SQLite. En modelos nuevos prefiere JSONField y evita ArrayField y funciones solo-Postgres, salvo que se confirme que desarrollo usa Postgres.
- No renombres tablas existentes. `hdp_` aplica solo a modelos nuevos.
- Evidencia legal (firmas, denuncias, accidentes): guarda hash SHA-256, timestamp de servidor, IP y user-agent; agrega un log de auditoría inmutable (quién, qué, cuándo) y usa eliminación lógica.
- Archivos: usa FileField/ImageField estándar; nunca rutas absolutas ni URLs fijas, para poder cambiar de almacenamiento sin migrar modelos.
```

---

## 3. Agente Backend

### Reemplazar
- "Django 4.2 LTS... Nunca generes código que rompa la versión LTS" → "Django 4.2, migrando a 5.2 LTS: escribe código compatible con ambas". Hoy esa línea bloquearía justo la actualización que necesitas.

### Pegar al final

```
## ACTUALIZACIÓN (PRIORIDAD SOBRE LO ANTERIOR)
- Compatibilidad 4.2 -> 5.2: usa el setting `STORAGES` (no DEFAULT_FILE_STORAGE ni STATICFILES_STORAGE, que se eliminaron en 5.1) y evita APIs deprecadas.
- JWT: access 15 min y refresh 7 días con rotación y blacklist (`rest_framework_simplejwt.token_blacklist`). El settings actual aún tiene access de 1 día: repórtalo como pendiente, no lo des por corregido.
- Endpoints públicos (QR): identificador UUID/token (nunca pk), `AllowAny` explícito, throttling DRF por scope (ScopedRateThrottle) y por IP, límite de tamaño de cuerpo y archivos, y validación del estado de la sesión (abierta/cerrada). Con LocMemCache cada worker de Gunicorn cuenta por separado: documéntalo.
- Almacenamiento ($0 hoy): disco local, pero siempre vía FileField/ImageField y un helper `storage.py` configurado por variable de entorno. Pasar a S3/R2/Supabase debe requerir solo cambiar `STORAGES` y variables de entorno.
- Aislamiento multi-tenant: filtra por tenant en `get_queryset()`, permisos por objeto, y agrega un test de IDOR por cada endpoint nuevo.
- Firma de asistencia: servicio `validar_rut()` (módulo 11), hash SHA-256, timestamp de servidor, IP, user-agent y unicidad (sesión, RUT).
- Ley Karin: el endpoint de denuncia formal es distinto del de sugerencias; acceso solo del receptor designado y registro de cada lectura. No inventes requisitos legales: usa los campos que defina el agente Prevencionista.
- Nunca devuelvas métricas inventadas; sin dato, retorna 0 o null.
```

---

## 4. Agente Frontend

### Pegar al final

```
## ACTUALIZACIÓN (PRIORIDAD SOBRE LO ANTERIOR)
- Tamaño: ningún componente supera ~300 líneas y los `page.tsx` no llevan lógica de negocio. Divide en `_components/` y hooks `use-`. `reportes-riesgo/page.tsx` (~1.800 líneas) es deuda: no le agregues código; extrae primero.
- Buzón: "Sugerencias/Avisos" y "Denuncia Ley Karin" son pantallas distintas. El texto legal de la denuncia formal usa el marcador `TEXTO_LEGAL_PENDIENTE` hasta que lo valide un abogado.
- Datos reales: nunca hardcodees métricas. Sin dato, muestra "Próximamente / en integración" o 0.
- Auth: hoy el token está en localStorage. No agregues lecturas directas; centraliza todo en `src/lib/api.ts` para migrar luego a cookie HttpOnly sin tocar los componentes.
- Rutas públicas con QR: el token va en la URL (nunca ids numéricos); maneja "charla cerrada/caducada" y errores.
- Textos normativos: cita DS 44, nunca DS 40/54. Centraliza los textos legales en `src/lib/textos-legales.ts`.
- Móvil primero en rutas de participación; considera el modo quiosco (firma en el dispositivo del relator).
```

---

## 5. Flujo de 6 pasos (`modo_flujo_completo`)

Cambios mínimos a los mensajes:
- **Paso 1:** agregar "Marca cada requisito como VERIFICADO (con artículo leído en doc_agents) o PENDIENTE DE VALIDAR."
- **Paso 3:** agregar "Todo modelo operativo lleva FK a EmpresaCliente, tenant propietario y, si es accesible por QR, `token_publico`."
- **Paso 6:** agregar "Aplica el CHECKLIST DE AUDITORÍA y reporta como hallazgo cualquier referencia a DS 40/54."

---

## 6. Qué queda pendiente de validar con una fuente

| Tema | Cómo cerrarlo |
|---|---|
| Umbrales de CPHS, Departamento de Prevención y delegado SST | `buscar_en_normativa` (ya corregida) sobre `Decreto-44.md` |
| Artículo exacto de la ODI | Igual |
| Anonimato y requisitos de la denuncia Ley Karin (Art. 211-B) | Abogado laboral |
| Plazos de Ley Karin (hábiles o corridos) | Abogado laboral |
