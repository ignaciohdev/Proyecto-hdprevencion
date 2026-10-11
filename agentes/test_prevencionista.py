# agentes/test_prevencionista.py
"""
Test de auditoría legal con el Agente Prevencionista.
Apunta a un archivo real del proyecto para que el agente lo lea y evalúe.

Uso:
    python agentes/test_prevencionista.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agenteexpertoprevencionista import agente_prevencionista


def auditar_codigo_real():
    # Cambia esta ruta por el archivo que quieras que revise.
    # Debe ser una ruta RELATIVA a la raíz del proyecto.
    # Ejemplos válidos:
    #   "backend/modulo_prevencion/models.py"
    #   "backend/modulo_prevencion/views.py"
    #   "backend/modulo_prevencion/serializers.py"
    archivo_a_revisar = "backend/modulo_prevencion/models.py"

    instruccion = f"""
    Necesito que audites el archivo de modelos del backend.
    Por favor, usa tu herramienta `leer_archivo` para abrir: '{archivo_a_revisar}'.

    Luego usa `listar_archivos` con "backend/modulo_prevencion" para ver el contexto completo.

    Evalúa si los modelos definidos cumplen con la normativa chilena de prevención de riesgos:
    - ¿Los campos de accidentes distinguen entre accidente de trayecto, del trabajo y EP (Ley 16.744)?
    - ¿Existe el modelo para DIAT/DIEP?
    - ¿Las matrices IPER siguen la jerarquía de control de riesgos (DS 40)?
    - ¿Qué mejoras propones para que el sistema sea más útil para un prevencionista real?
    """

    print(f"📋 Enviando orden de auditoría para: {archivo_a_revisar}...")
    respuesta = agente_prevencionista.enviar_mensaje(instruccion)

    print("\n=== RESULTADO DE LA AUDITORÍA ===")
    print(respuesta)


if __name__ == "__main__":
    auditar_codigo_real()