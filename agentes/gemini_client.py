import sys
import os
import re
import time
import subprocess

# Forzar codificación UTF-8 y autoflush en stdout/stderr para evitar fallos con emojis en Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)

from dotenv import load_dotenv
from google import genai
from google.genai import types

# Cargar variables de entorno
ruta_actual = os.path.dirname(os.path.abspath(__file__))
ruta_raiz = os.path.join(ruta_actual, "..")
ruta_env = os.path.join(ruta_raiz, ".env")
load_dotenv(ruta_env)

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("¡No se encontró GEMINI_API_KEY en el archivo .env!")

client = genai.Client(api_key=api_key)

# Modelo por defecto (configurable via GEMINI_MODEL en .env)
MODELO_GEMINI = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

# ==========================================
# 🛠️ HERRAMIENTAS AUTÓNOMAS (FUNCTION CALLING)
# ==========================================

def leer_archivo(ruta_relativa: str) -> str:
    """
    Lee y retorna el contenido de un archivo específico del proyecto.
    Usa esta herramienta cuando necesites auditar código, ver modelos o componentes.
    
    Args:
        ruta_relativa: Ruta relativa desde la raíz del proyecto. Ej: 'backend/modulo_prevencion/models.py'
    
    Returns:
        El contenido del archivo como texto, o un mensaje de error.
    """
    ruta_absoluta = os.path.normpath(os.path.join(ruta_raiz, ruta_relativa))
    print(f"  📂 [Herramienta] Leyendo archivo: '{ruta_relativa}'...", flush=True)
    try:
        with open(ruta_absoluta, 'r', encoding='utf-8') as f:
            contenido = f.read()
            return f"--- CONTENIDO DE {ruta_relativa} ---\n{contenido}"
    except FileNotFoundError:
        return f"Error: El archivo '{ruta_relativa}' no existe. Verifica la ruta con listar_archivos()."
    except UnicodeDecodeError:
        return f"Error: El archivo '{ruta_relativa}' no es legible como texto (puede ser binario)."
    except Exception as e:
        return f"Error leyendo el archivo: {str(e)}"


def listar_archivos(subdirectorio: str = "") -> str:
    """
    Lista recursivamente los archivos y carpetas de un directorio del proyecto.
    Ignora node_modules, .next, __pycache__, .git, venv y .venv automáticamente.
    Úsala para explorar la estructura del proyecto antes de leer archivos específicos.

    Args:
        subdirectorio: Ruta relativa desde la raíz del proyecto. Usa "" para la raíz.
                       Ejemplos: "backend/modulo_prevencion", "frontend/src/app"
    
    Returns:
        Árbol de archivos como texto, o un mensaje de error.
    """
    IGNORADOS = {
        "node_modules", ".next", "__pycache__", ".git",
        "venv", ".venv", "migrations", ".mypy_cache", "dist", "build"
    }
    
    ruta_objetivo = os.path.normpath(os.path.join(ruta_raiz, subdirectorio))
    print(f"  🗂️ [Herramienta] Listando directorio: '{subdirectorio or 'raíz del proyecto'}'...", flush=True)
    
    if not os.path.exists(ruta_objetivo):
        return f"Error: El directorio '{subdirectorio}' no existe."
    if not os.path.isdir(ruta_objetivo):
        return f"Error: '{subdirectorio}' es un archivo, no un directorio. Usa leer_archivo() para leerlo."
    
    lineas: list[str] = [f"[Estructura de: {subdirectorio or 'raiz del proyecto'}]\n"]
    
    for raiz, dirs, archivos in os.walk(ruta_objetivo):
        # Filtrar directorios ignorados en su lugar (modifica dirs in-place)
        dirs[:] = sorted([d for d in dirs if d not in IGNORADOS])
        
        nivel = raiz.replace(ruta_objetivo, "").count(os.sep)
        indent = "  " * nivel
        nombre_carpeta = os.path.basename(raiz)
        
        lineas.append(f"{indent}[DIR] {nombre_carpeta}/")
        
        sub_indent = "  " * (nivel + 1)
        for archivo in sorted(archivos):
            lineas.append(f"{sub_indent}- {archivo}")
    
    return "\n".join(lineas)


def comando_git(args: str) -> str:
    """
    Ejecuta un comando Git de solo lectura en el repositorio del proyecto.
    Solo se permiten comandos seguros: status, log, diff, branch, show.
    Úsala para analizar el historial reciente, cambios pendientes o ramas activas.

    Args:
        args: Argumentos del comando git (sin la palabra 'git').
              Ejemplos: "status", "log --oneline -10", "diff HEAD~1", "branch -a"
    
    Returns:
        La salida del comando git, o un mensaje de error.
    """
    COMANDOS_PERMITIDOS = ["status", "log", "diff", "branch", "show", "shortlog"]
    
    partes = args.strip().split()
    if not partes:
        return "Error: No se proporcionó ningún argumento."
    
    subcomando = partes[0].lower()
    print(f"  💻 [Herramienta] Ejecutando: git {args}...", flush=True)
    if subcomando not in COMANDOS_PERMITIDOS:
        return (
            f"Error: El comando 'git {subcomando}' no está permitido por seguridad. "
            f"Solo se permiten: {', '.join(COMANDOS_PERMITIDOS)}"
        )
    
    try:
        resultado = subprocess.run(
            ["git"] + partes,
            cwd=ruta_raiz,
            capture_output=True,
            text=True,
            timeout=15,
            encoding="utf-8"
        )
        salida = resultado.stdout.strip()
        errores = resultado.stderr.strip()
        
        if resultado.returncode != 0:
            return f"Error git (código {resultado.returncode}):\n{errores}"
        
        return salida if salida else "(El comando no produjo salida)"
    
    except subprocess.TimeoutExpired:
        return "Error: El comando git tardó demasiado (timeout 15s)."
    except FileNotFoundError:
        return "Error: Git no está instalado o no está en el PATH del sistema."
    except Exception as e:
        return f"Error ejecutando git: {str(e)}"


# Lista de todas las herramientas disponibles para inyectar en los agentes
HERRAMIENTAS_AGENTE = [leer_archivo, listar_archivos, comando_git]


def extraer_tiempo_espera_429(error: Exception, intento: int) -> float:
    """
    Extrae los segundos a esperar a partir del error 429 RESOURCE_EXHAUSTED de Gemini.
    Si la API no provee el dato exacto, aplica un backoff progresivo (mínimo 10s).
    """
    texto_error = str(error)

    # 1. Intentar buscar en los detalles estructurados de la excepción
    if hasattr(error, "details") and isinstance(error.details, dict):
        detalles_lista = error.details.get("error", {}).get("details", [])
        for d in detalles_lista:
            if isinstance(d, dict) and "retryDelay" in d:
                raw_delay = str(d["retryDelay"]).rstrip("s")
                try:
                    return max(float(raw_delay) + 1.5, 10.0)
                except ValueError:
                    pass

    # 2. Intentar buscar con expresión regular en el mensaje de error (ej: 'retry in 27.55s')
    coincidencia = re.search(r"retry in ([0-9]+(?:\.[0-9]+)?)s", texto_error, re.IGNORECASE)
    if coincidencia:
        try:
            return max(float(coincidencia.group(1)) + 1.5, 10.0)
        except ValueError:
            pass

    # 3. Fallback: backoff progresivo (15s, 30s, 45s, 60s)
    return float(15 * intento)


# ==========================================
# CLASE BASE DEL AGENTE
# ==========================================
class AgenteExperto:
    def __init__(
        self,
        rol_nombre: str,
        system_prompt: str,
        temperatura: float = 0.2,
        usar_herramientas: bool = False
    ):
        self.rol_nombre = rol_nombre
        self.system_prompt = system_prompt
        self.temperatura = temperatura
        self.usar_herramientas = usar_herramientas

        # Solo inyectar herramientas si se solicita explícitamente (evita el bucle AFC)
        tools = HERRAMIENTAS_AGENTE if usar_herramientas else None

        self.config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=temperatura,
            # --- CONFIGURACIONES DE MODO MÁXIMO ---
            max_output_tokens=8192,  # Permite respuestas largas de código (~8000 palabras)
            top_p=0.95,              # Mejora la coherencia del razonamiento lógico
            top_k=40,                # Evita alucinaciones con vocabulario extraño
            tools=tools,
        )

        self.chat_session = client.chats.create(
            model=MODELO_GEMINI,
            config=self.config
        )

    def reiniciar_sesion(self, historial: list | None = None):
        """Reinicia la sesión de chat, preservando opcionalmente el historial existente."""
        self.chat_session = client.chats.create(
            model=MODELO_GEMINI,
            config=self.config,
            history=historial if historial else []
        )

    def enviar_mensaje(self, mensaje: str, max_reintentos: int = 4) -> str:
        """
        Envía un mensaje al modelo con manejo automático de cuotas y reintentos.
        Si la API retorna 429 RESOURCE_EXHAUSTED (límite del Free Tier: 5 req/min),
        espera el tiempo indicado por Google y reintenta automáticamente.
        """
        for intento in range(1, max_reintentos + 1):
            # Guardamos snapshot del historial antes del turno por si ocurre un fallo
            # durante la ejecución de herramientas (AFC), evitando estados corruptos.
            historial_previo = list(self.chat_session.get_history())

            try:
                print(f"🤖 [{self.rol_nombre}] Analizando...")
                response = self.chat_session.send_message(mensaje)

                if response.text is not None:
                    return response.text

                return "⚠️ Advertencia: El modelo no devolvió texto (posible bloqueo de seguridad)."

            except Exception as e:
                texto_error = str(e)
                es_429 = (
                    "429" in texto_error
                    or "RESOURCE_EXHAUSTED" in texto_error
                    or "quota" in texto_error.lower()
                )

                if es_429 and intento < max_reintentos:
                    segundos_espera = extraer_tiempo_espera_429(e, intento)
                    print(
                        f"\n⏳ [{self.rol_nombre}] Cuota por minuto alcanzada (Free Tier: 5 req/min).\n"
                        f"   Esperando {segundos_espera:.1f}s antes de reintentar automáticamente "
                        f"(intento {intento}/{max_reintentos})..."
                    )
                    # Restauramos la sesión limpia con el historial previo
                    self.reiniciar_sesion(historial_previo)

                    # Esperar antes del siguiente intento
                    time.sleep(segundos_espera)
                    continue
                else:
                    return f"❌ Error en el agente {self.rol_nombre}: {texto_error}"

        return f"❌ Error en el agente {self.rol_nombre}: Se agotaron los {max_reintentos} reintentos tras alcanzar el límite de cuota."