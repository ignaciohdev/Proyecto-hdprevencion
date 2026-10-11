import os
import subprocess
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

MODELO_GEMINI = "gemini-3.8-flash"

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


# ==========================================
# CLASE BASE DEL AGENTE
# ==========================================
class AgenteExperto:
    def __init__(self, rol_nombre: str, system_prompt: str, temperatura: float = 0.2):
        self.rol_nombre = rol_nombre
        
        self.config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=temperatura,
            
            # --- CONFIGURACIONES DE MODO MÁXIMO ---
            max_output_tokens=8192,  # Permite respuestas largas de código (~8000 palabras)
            top_p=0.95,              # Mejora la coherencia del razonamiento lógico
            top_k=40,                # Evita alucinaciones con vocabulario extraño
            
            tools=HERRAMIENTAS_AGENTE  # Todas las herramientas disponibles
        )
        
        self.chat_session = client.chats.create(
            model=MODELO_GEMINI,
            config=self.config
        )

    def enviar_mensaje(self, mensaje: str) -> str:
        try:
            print(f"🤖 [{self.rol_nombre}] Analizando...")
            response = self.chat_session.send_message(mensaje)
            
            if response.text is not None:
                return response.text
                
            return "⚠️ Advertencia: El modelo no devolvió texto (posible bloqueo de seguridad)."
            
        except Exception as e:
            return f"❌ Error en el agente {self.rol_nombre}: {str(e)}"