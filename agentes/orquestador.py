#!/usr/bin/env python3
"""
orquestador.py — Punto de entrada principal para el sistema de agentes IA
=========================================================================
HD Prevención — Flujo de trabajo recomendado:

    Prevencionista (requisitos legales)
        → DB (diseño de modelos)
            → Backend (API REST)
                → Frontend (UI)
                    → Prevencionista (auditoría final)

Uso:
    python agentes/orquestador.py
    python agentes/orquestador.py --modo interactivo
    python agentes/orquestador.py --modo auditoria --archivo backend/modulo_prevencion/models.py
    python agentes/orquestador.py --modo flujo --modulo "Matriz IPER"
"""
import sys
import os
import time
import argparse
from datetime import datetime

# Forzar codificación UTF-8 en stdout/stderr para evitar fallos con caracteres especiales en Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Asegurar que la carpeta agentes esté en el path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agenteexpertoprevencionista import agente_prevencionista
from agentebackend import agente_backend
from agentebd import agente_db
from agentefrontend import agente_frontend
from gemini_client import leer_archivo, listar_archivos, ruta_raiz

# Mapa de agentes disponibles
AGENTES = {
    "prevencionista": agente_prevencionista,
    "backend":        agente_backend,
    "db":             agente_db,
    "frontend":       agente_frontend,
}

SEPARADOR = "\n" + "=" * 70 + "\n"

# Directorio para persistir resultados
DIR_RESULTADOS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "resultados")


def _guardar_resultado(nombre_modulo: str, paso: str, contenido: str) -> str:
    """
    Guarda el resultado de un paso del flujo en un archivo Markdown.
    Retorna la ruta del archivo creado.
    """
    os.makedirs(DIR_RESULTADOS, exist_ok=True)

    # Nombre seguro para el filesystem
    nombre_seguro = nombre_modulo.lower().replace(" ", "_").replace("/", "_")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M")
    nombre_archivo = f"{nombre_seguro}_{paso}_{timestamp}.md"
    ruta = os.path.join(DIR_RESULTADOS, nombre_archivo)

    with open(ruta, "w", encoding="utf-8") as f:
        f.write(f"# {nombre_modulo} — {paso}\n")
        f.write(f"_Generado: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}_\n\n")
        f.write(contenido)

    return ruta


def _adjuntar_contexto_local(mensaje: str) -> str:
    """
    Forma 2 (Consolidación Local): Detecta si el usuario menciona archivos o carpetas,
    los lee localmente en la máquina (0 llamadas a la API de Google) y los adjunta
    al prompt. Así el agente recibe el código directamente en 1 sola llamada sin bucle AFC.
    """
    # 1. Comandos directos: /leer <ruta> o /listar <ruta>
    if mensaje.startswith("/leer "):
        ruta = mensaje[6:].strip()
        contenido = leer_archivo(ruta)
        print(f"  📂 [Lectura local] Adjuntando '{ruta}' (0 peticiones API)...")
        return f"[Contenido local de '{ruta}']:\n{contenido}\n\nPor favor analiza el archivo anterior."

    if mensaje.startswith("/listar"):
        sub = mensaje[7:].strip()
        arbol = listar_archivos(sub)
        print(f"  🗂️ [Listado local] Adjuntando estructura de '{sub or 'raíz'}'...")
        return f"[Estructura local de '{sub or 'raíz'}']:\n{arbol}\n\nAnaliza la estructura anterior."

    # 2. Búsqueda automática de nombres de archivo del proyecto mencionados en el mensaje
    palabras = mensaje.replace("'", " ").replace('"', " ").replace("`", " ").split()
    archivos_adjuntados: list[str] = []

    for palabra in palabras:
        if ("." in palabra or "/" in palabra or "\\" in palabra) and not palabra.startswith("http"):
            candidata = palabra.strip(".,;:()[]{}")
            ruta_posible = os.path.normpath(os.path.join(ruta_raiz, candidata))
            if os.path.isfile(ruta_posible) and candidata not in archivos_adjuntados:
                print(f"  📂 [Lectura local detectada] Adjuntando '{candidata}' (0 peticiones API)...")
                contenido = leer_archivo(candidata)
                archivos_adjuntados.append(f"\n\n--- CÓDIGO REAL DE {candidata} ---\n{contenido}")

    if archivos_adjuntados:
        return mensaje + "\n\n" + "\n".join(archivos_adjuntados)

    return mensaje


def modo_interactivo():
    """Sesión de chat interactiva con el agente de tu elección."""
    print(SEPARADOR)
    print("ORQUESTADOR HD PREVENCION - Modo Interactivo (Forma 2: Contexto Local)")
    print(SEPARADOR)
    print("Agentes disponibles:")
    for nombre, agente in AGENTES.items():
        print(f"  - {nombre} ({agente.rol_nombre})")

    nombre_agente = input("\nCon que agente quieres trabajar? ").strip().lower()

    if nombre_agente not in AGENTES:
        print(f"Agente '{nombre_agente}' no encontrado. Opciones: {list(AGENTES.keys())}")
        sys.exit(1)

    agente = AGENTES[nombre_agente]
    print(f"\nConectado con: {agente.rol_nombre}")
    print("Tip: Puedes mencionar rutas de archivos (ej. 'revisa backend/modulo_prevencion/models.py')")
    print("     o usar '/leer <archivo>' y se cargarán localmente sin gastar cuota de API.")
    print("Escribe 'salir' para terminar.\n")

    while True:
        try:
            mensaje = input("Tu: ").strip()
            if not mensaje:
                continue
            if mensaje.lower() in ("salir", "exit", "quit"):
                print("Cerrando sesion.")
                break

            mensaje_final = _adjuntar_contexto_local(mensaje)
            respuesta = agente.enviar_mensaje(mensaje_final)
            print(f"\n{agente.rol_nombre}:\n{respuesta}\n")

        except KeyboardInterrupt:
            print("\nSesion interrumpida.")
            break


def modo_auditoria(ruta_archivo: str):
    """
    Flujo completo de auditoría legal para un archivo o módulo específico.
    Forma 2: Lee el archivo localmente en la máquina y se lo envía consolidado
    al Prevencionista en exactamente 1 sola llamada a la API.
    """
    print(SEPARADOR)
    print("AUDITORIA LEGAL - HD Prevencion (Forma 2: Consolidación Local)")
    print(f"Archivo objetivo: {ruta_archivo}")
    print(SEPARADOR)

    ruta_absoluta = os.path.normpath(os.path.join(ruta_raiz, ruta_archivo))
    if os.path.isdir(ruta_absoluta):
        print(f"  🗂️ [Lectura local] Explorando directorio '{ruta_archivo}'...")
        contexto_archivos = listar_archivos(ruta_archivo)
    elif os.path.isfile(ruta_absoluta):
        print(f"  📂 [Lectura local] Leyendo '{ruta_archivo}'...")
        contexto_archivos = leer_archivo(ruta_archivo)
    else:
        contexto_archivos = f"Advertencia: No se encontró la ruta '{ruta_archivo}' en el proyecto local."

    instruccion = f"""
    Necesito que realices una auditoría legal completa según la normativa chilena para: '{ruta_archivo}'.

    {contexto_archivos}

    Evalúa si el código y sus modelos cumplen con la normativa chilena:
    - Ley 16.744: Distinción legal entre accidente del trabajo, de trayecto y enfermedad profesional (DIAT/DIEP).
    - Decreto Supremo N° 594: Condiciones sanitarias y ambientales básicas.
    - Decreto Supremo N° 40: Obligación de Informar los Riesgos (ODI / DAS).
    - Decreto Supremo N° 54 (CPHS) y Decreto Supremo N° 76 (Gestión en faenas).
    - Protocolos MINSAL (TMERT, PREXOR, etc.) y directrices SUSESO.

    Entrega tu informe completo con:
    - 🔴 Hallazgos Críticos Legales (lo que está mal o viola la ley).
    - 🟡 Recomendaciones de Mejora (cómo hacer el módulo más útil).
    - 🟢 Aprobación / Visto Bueno (lo que está correctamente planteado).
    """

    resultado = agente_prevencionista.enviar_mensaje(instruccion)

    print("\n=== RESULTADO DE LA AUDITORIA ===")
    print(resultado)

    # Persistir resultado
    ruta_guardado = _guardar_resultado(ruta_archivo, "auditoria", resultado)
    print(f"\n[Resultado guardado en: {ruta_guardado}]")


def modo_flujo_completo(nombre_modulo: str):
    """
    Ejecuta el flujo de trabajo completo de 6 pasos para construir un módulo nuevo.
    Forma 2 (Consolidación Local): Cada paso pasa su resultado directamente al siguiente,
    y el contexto existente del repo se lee en local con 0 llamadas a herramientas remotas.
    
    1. Prevencionista: requisitos legales
    2. DB: analiza código actual (leído en local por Python)
    3. DB: diseña modelos (recibe requisitos + contexto)
    4. Backend: genera API (recibe modelos + requisitos)
    5. Frontend: genera UI (recibe API specs)
    6. Prevencionista: auditoría final (recibe código generado)
    """
    print(SEPARADOR)
    print(f"FLUJO COMPLETO - Modulo: {nombre_modulo} (Forma 2)")
    print(SEPARADOR)

    resultados: dict[str, str] = {}

    # =====================================================================
    # PASO 1: Requisitos legales
    # =====================================================================
    print("\n[PASO 1/6] Agente Prevencionista - Definiendo requisitos legales...")
    resultados["requisitos"] = agente_prevencionista.enviar_mensaje(
        f"Define todos los campos y datos obligatorios por ley chilena para el módulo '{nombre_modulo}'. "
        f"Sé específico: qué campos deben estar en los formularios, qué registros exige la ley, "
        f"qué leyes/decretos aplican y qué alertas o vencimientos son necesarios. "
        f"Recuerda: tu rol es definir la lógica del negocio, no el código técnico."
    )
    print(resultados["requisitos"])
    ruta = _guardar_resultado(nombre_modulo, "1_requisitos_legales", resultados["requisitos"])
    print(f"[Guardado: {ruta}]")

    # =====================================================================
    # PASO 2: Contexto del código actual (Lectura Local Consolidada)
    # =====================================================================
    print(f"\n[PASO 2/6] Agente DB - Analizando modelos existentes del proyecto...")
    contexto_repo = listar_archivos("backend/modulo_prevencion")
    modelos_existentes = leer_archivo("backend/modulo_prevencion/models.py")

    resultados["contexto"] = agente_db.enviar_mensaje(
        f"Antes de diseñar algo nuevo, analiza los modelos que ya existen en el proyecto.\n\n"
        f"ESTRUCTURA DEL MÓDULO:\n{contexto_repo}\n\n"
        f"MODELOS EXISTENTES:\n{modelos_existentes}\n\n"
        f"Dame un resumen conciso de: qué modelos existen, sus campos principales y sus relaciones."
    )
    print(resultados["contexto"])
    ruta = _guardar_resultado(nombre_modulo, "2_contexto_actual", resultados["contexto"])
    print(f"[Guardado: {ruta}]")

    # =====================================================================
    # PASO 3: Modelo de datos
    # =====================================================================
    print(f"\n[PASO 3/6] Agente DB - Diseñando modelos Django...")
    resultados["modelos"] = agente_db.enviar_mensaje(
        f"Ahora diseña los modelos Django para el módulo '{nombre_modulo}'.\n\n"
        f"REQUISITOS LEGALES (del Agente Prevencionista):\n{resultados['requisitos']}\n\n"
        f"CONTEXTO ACTUAL DEL PROYECTO (modelos que ya existen):\n{resultados['contexto']}\n\n"
        f"Instrucciones:\n"
        f"- Diseña SOLO los modelos nuevos necesarios para este módulo.\n"
        f"- Reutiliza modelos existentes cuando corresponda (ej. Empresa, Trabajador, PuestoTrabajo).\n"
        f"- Usa ForeignKey hacia modelos existentes, no los dupliques.\n"
        f"- Incluye created_at / updated_at, Meta.db_table con prefijo 'hdp_', Meta.indexes.\n"
        f"- Usa DecimalField para valores numéricos de riesgo.\n"
        f"- Incluye docstrings en cada modelo."
    )
    print(resultados["modelos"])
    ruta = _guardar_resultado(nombre_modulo, "3_modelos_django", resultados["modelos"])
    print(f"[Guardado: {ruta}]")

    # =====================================================================
    # PASO 4: API REST
    # =====================================================================
    print(f"\n[PASO 4/6] Agente Backend - Generando endpoints DRF...")
    resultados["api"] = agente_backend.enviar_mensaje(
        f"Basándote en estos modelos Django para el módulo '{nombre_modulo}':\n\n"
        f"{resultados['modelos']}\n\n"
        f"Y estos requisitos legales:\n{resultados['requisitos']}\n\n"
        f"Genera:\n"
        f"- Serializers con validaciones apropiadas\n"
        f"- ViewSets DRF completos con filtros y permisos\n"
        f"- services.py con la lógica de negocio separada\n"
        f"- urls.py con el router registrado\n"
        f"- Asegúrate de que los endpoints respeten las reglas del proyecto "
        f"(IsAuthenticated por defecto, manejo de errores normalizado)."
    )
    print(resultados["api"])
    ruta = _guardar_resultado(nombre_modulo, "4_api_drf", resultados["api"])
    print(f"[Guardado: {ruta}]")

    # =====================================================================
    # PASO 5: Frontend
    # =====================================================================
    print(f"\n[PASO 5/6] Agente Frontend - Generando componentes Next.js...")
    resultados["frontend"] = agente_frontend.enviar_mensaje(
        f"Basándote en la API DRF para el módulo '{nombre_modulo}':\n\n"
        f"{resultados['api']}\n\n"
        f"Genera los componentes Next.js 16 con App Router, TypeScript y Tailwind v4:\n"
        f"- Página principal del módulo con tabla de listado y filtros\n"
        f"- Formularios con validación del lado del cliente\n"
        f"- Manejo de errores con toasts/banners\n"
        f"- Hooks personalizados para las llamadas a API\n"
        f"- Tipos TypeScript que reflejen los serializers del backend\n"
        f"- Usa Server Components por defecto, 'use client' solo donde sea necesario."
    )
    print(resultados["frontend"])
    ruta = _guardar_resultado(nombre_modulo, "5_frontend_nextjs", resultados["frontend"])
    print(f"[Guardado: {ruta}]")

    # =====================================================================
    # PASO 6: Auditoría final
    # =====================================================================
    print(f"\n[PASO 6/6] Agente Prevencionista - Auditoria del codigo generado...")
    resultados["auditoria"] = agente_prevencionista.enviar_mensaje(
        f"El equipo de desarrollo implementó el módulo '{nombre_modulo}'. "
        f"Audita la lógica de negocio del código generado:\n\n"
        f"MODELOS DE DATOS:\n{resultados['modelos']}\n\n"
        f"API / ENDPOINTS:\n{resultados['api']}\n\n"
        f"Compara contra tus requisitos legales originales:\n{resultados['requisitos']}\n\n"
        f"Preguntas clave:\n"
        f"- ¿Se implementaron TODOS los campos que definiste como obligatorios?\n"
        f"- ¿Falta algún registro o flujo exigido por la normativa chilena?\n"
        f"- ¿La jerarquía de control de riesgos está correctamente implementada?\n"
        f"- ¿El vocabulario técnico es el correcto para Chile?\n\n"
        f"Entrega tu informe con: Hallazgos Criticos, Recomendaciones y Aprobados."
    )
    print(resultados["auditoria"])
    ruta = _guardar_resultado(nombre_modulo, "6_auditoria_legal", resultados["auditoria"])
    print(f"[Guardado: {ruta}]")

    # =====================================================================
    # Resumen final
    # =====================================================================
    print(SEPARADOR)
    print(f"FLUJO COMPLETO FINALIZADO - {nombre_modulo}")
    print(f"Todos los resultados guardados en: {DIR_RESULTADOS}")
    print(SEPARADOR)

    return resultados


def main():
    parser = argparse.ArgumentParser(
        description="Orquestador de Agentes IA - HD Prevencion",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos:
  python agentes/orquestador.py --modo interactivo
  python agentes/orquestador.py --modo auditoria --archivo backend/modulo_prevencion/models.py
  python agentes/orquestador.py --modo flujo --modulo "Matriz IPER"
        """
    )

    parser.add_argument(
        "--modo",
        choices=["interactivo", "auditoria", "flujo"],
        default="interactivo",
        help="Modo de ejecucion (default: interactivo)"
    )
    parser.add_argument(
        "--archivo",
        type=str,
        help="Ruta relativa del archivo/carpeta a auditar (solo para --modo auditoria)"
    )
    parser.add_argument(
        "--modulo",
        type=str,
        help="Nombre del modulo a construir con flujo completo (solo para --modo flujo)"
    )

    args = parser.parse_args()

    # Si el usuario pasó --modulo pero olvidó poner --modo flujo, inferirlo automáticamente
    if args.modulo and args.modo == "interactivo":
        args.modo = "flujo"

    if args.modo == "interactivo":
        modo_interactivo()

    elif args.modo == "auditoria":
        if not args.archivo:
            args.archivo = input("\n¿Qué archivo deseas auditar? (ej: backend/modulo_prevencion/models.py): ").strip()
            if not args.archivo:
                args.archivo = "backend/modulo_prevencion/models.py"
        modo_auditoria(args.archivo)

    elif args.modo == "flujo":
        # Si no especificó el nombre del módulo o escribió "flujo", preguntarlo en consola
        if not args.modulo or args.modulo.lower() == "flujo":
            nombre = input("\n¿Qué módulo deseas construir en flujo completo? (ej: Matriz IPER): ").strip()
            args.modulo = nombre if nombre else "Matriz IPER"
        modo_flujo_completo(args.modulo)


if __name__ == "__main__":
    main()
