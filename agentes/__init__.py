"""
agentes/ — Paquete de Agentes IA para HD Prevención
=====================================================
Exporta los 4 agentes especializados listos para usar.

Uso desde la raíz del proyecto:
    from agentes import agente_prevencionista, agente_backend, agente_db, agente_frontend
"""
import sys
import os

# Asegurar que el directorio agentes esté en el path para imports internos
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agenteexpertoprevencionista import agente_prevencionista
from agentebackend import agente_backend
from agentebd import agente_db
from agentefrontend import agente_frontend

__all__ = [
    "agente_prevencionista",
    "agente_backend",
    "agente_db",
    "agente_frontend",
]
