# agentes/test_prevencionista.py
"""
Test de auditoría legal con el Agente Prevencionista.
Apunta a un archivo real del proyecto para que el agente lo lea y evalúe.

Uso:
    python agentes/test_prevencionista.py
"""
import sys
import os

# Forzar codificación UTF-8 en stdout/stderr para evitar fallos con emojis en Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agenteexpertoprevencionista import agente_prevencionista
from gemini_client import leer_archivo, listar_archivos


def auditar_codigo_real():
    # Ruta del archivo a auditar en local
    archivo_a_revisar = "backend/modulo_prevencion/models.py"

    print(f"📂 [Lectura local] Leyendo '{archivo_a_revisar}' en tu máquina...")
    contenido = leer_archivo(archivo_a_revisar)
    estructura = listar_archivos("backend/modulo_prevencion")

    instruccion = f"""
    Necesito que audites el archivo de modelos del backend bajo la normativa chilena.

    ESTRUCTURA DEL MÓDULO:
    {estructura}

    CÓDIGO DEL ARCHIVO '{archivo_a_revisar}':
    {contenido}

    Evalúa si los modelos definidos cumplen con la normativa chilena de prevención de riesgos:
    - ¿Los campos de accidentes distinguen entre accidente de trayecto, del trabajo y EP (Ley 16.744)?
    - ¿Existe el modelo para DIAT/DIEP?
    - ¿Las matrices IPER siguen la jerarquía de control de riesgos (DS 40)?
    - ¿Qué mejoras propones para que el sistema sea más útil para un prevencionista real?

    Entrega tu informe completo con:
    - 🔴 Hallazgos Críticos Legales
    - 🟡 Recomendaciones de Mejora
    - 🟢 Aprobación / Visto Bueno
    """

    print(f"📋 Enviando orden de auditoría en 1 sola llamada directa a la IA...")
    respuesta = agente_prevencionista.enviar_mensaje(instruccion)

    print("\n=== RESULTADO DE LA AUDITORÍA ===")
    print(respuesta)


if __name__ == "__main__":
    auditar_codigo_real()