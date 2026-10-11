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
import argparse
from datetime import datetime

# Asegurar que la carpeta agentes esté en el path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agenteexpertoprevencionista import agente_prevencionista
from agentebackend import agente_backend
from agentebd import agente_db
from agentefrontend import agente_frontend

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


def modo_interactivo():
    """Sesión de chat interactiva con el agente de tu elección."""
    print(SEPARADOR)
    print("ORQUESTADOR HD PREVENCION - Modo Interactivo")
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
    print("Escribe 'salir' para terminar.\n")

    while True:
        try:
            mensaje = input("Tu: ").strip()
            if not mensaje:
                continue
            if mensaje.lower() in ("salir", "exit", "quit"):
                print("Cerrando sesion.")
                break

            respuesta = agente.enviar_mensaje(mensaje)
            print(f"\n{agente.rol_nombre}:\n{respuesta}\n")

        except KeyboardInterrupt:
            print("\nSesion interrumpida.")
            break


def modo_auditoria(ruta_archivo: str):
    """
    Flujo completo de auditoría legal para un archivo o módulo específico.
    El Prevencionista audita el archivo y reporta hallazgos legales.
    """
    print(SEPARADOR)
    print("AUDITORIA LEGAL - HD Prevencion")
    print(f"Archivo objetivo: {ruta_archivo}")
    print(SEPARADOR)

    instruccion = f"""
    Necesito que realices una auditoría legal completa del módulo en: '{ruta_archivo}'.

    Por favor:
    1. Usa tu herramienta `listar_archivos` para explorar la estructura del directorio si es una carpeta.
    2. Usa `leer_archivo` para leer el o los archivos relevantes.
    3. Evalúa si los campos, formularios y flujos cumplen con la normativa chilena.
    4. Entrega tu informe completo con: Hallazgos Criticos, Recomendaciones y Aprobados.
    """

    resultado = agente_prevencionista.enviar_mensaje(instruccion)

    print("\n=== RESULTADO DE LA AUDITORIA ===")
    print(resultado)

    # Persistir resultado
    ruta_guardado = _guardar_resultado(ruta_archivo, "auditoria", resultado)
    print(f"\n[Resultado guardado en: {ruta_guardado}]")


def modo_flujo_completo(nombre_modulo: str):
    """
    Ejecuta el flujo de trabajo completo de 6 pasos para construir un módulo nuevo:
    
    1. Prevencionista: requisitos legales
    2. Prevencionista: lee código actual (contexto real del repo)
    3. DB: diseña modelos (recibe requisitos + contexto)
    4. Backend: genera API (recibe modelos + requisitos)
    5. Frontend: genera UI (recibe API specs)
    6. Prevencionista: auditoría final (lee código real)
    """
    print(SEPARADOR)
    print(f"FLUJO COMPLETO - Modulo: {nombre_modulo}")
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
    # PASO 2: Contexto del código actual
    # =====================================================================
    print(f"\n[PASO 2/6] Agente DB - Leyendo modelos existentes del proyecto...")
    resultados["contexto"] = agente_db.enviar_mensaje(
        "Antes de diseñar algo nuevo, necesito entender qué modelos ya existen. "
        "Usa tu herramienta `leer_archivo` para leer 'backend/modulo_prevencion/models.py'. "
        "Luego usa `listar_archivos` con 'backend/modulo_prevencion' para ver la estructura actual. "
        "Dame un resumen conciso de: qué modelos existen, sus campos principales y sus relaciones."
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

    if args.modo == "interactivo":
        modo_interactivo()

    elif args.modo == "auditoria":
        if not args.archivo:
            print("--modo auditoria requiere --archivo <ruta_relativa>")
            sys.exit(1)
        modo_auditoria(args.archivo)

    elif args.modo == "flujo":
        if not args.modulo:
            print("--modo flujo requiere --modulo <nombre>")
            sys.exit(1)
        modo_flujo_completo(args.modulo)


if __name__ == "__main__":
    main()
