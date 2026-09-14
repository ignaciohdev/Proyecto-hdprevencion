import os
import sys
import shutil
import subprocess
from dotenv import load_dotenv

# Asegurar compatibilidad de salida UTF-8 en consola de Windows
if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
if sys.stderr.encoding != "utf-8":
    try:
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from google import genai
from google.genai import types


# Carpeta raíz del proyecto (un nivel arriba de la carpeta 'agentes')
PROYECTO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

# Cargar variables de entorno desde .env en la raíz del proyecto
dotenv_path = os.path.join(PROYECTO_ROOT, ".env")
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)
else:
    load_dotenv()

# Asegurar que Git esté en el PATH en Windows si está en C:\Program Files\Git\cmd
git_cmd_dir = r"C:\Program Files\Git\cmd"
if os.path.exists(git_cmd_dir) and git_cmd_dir not in os.environ.get("PATH", ""):
    os.environ["PATH"] = git_cmd_dir + os.pathsep + os.environ.get("PATH", "")

def listar_archivos(subdirectorio: str = "") -> str:
    """Lista archivos a partir de la raíz del proyecto o un subdirectorio específico."""
    if subdirectorio:
        ruta_base = os.path.normpath(os.path.join(PROYECTO_ROOT, subdirectorio.strip("/\\")))
    else:
        ruta_base = PROYECTO_ROOT
        
    ignorar = {".git", "node_modules", "venv", "__pycache__", ".venv", "dist", "build", ".next", "staticfiles", "media"}
    estructura = []
    
    for raiz, carpetas, archivos in os.walk(ruta_base):
        carpetas[:] = [c for c in carpetas if c not in ignorar]
        rel_path = os.path.relpath(raiz, PROYECTO_ROOT)
        nivel = 0 if rel_path == "." else rel_path.count(os.sep) + 1
        if nivel > 3:
            continue
        indent = " " * 4 * (nivel - 1 if nivel > 0 else 0)
        estructura.append(f"{indent}{os.path.basename(raiz) or '.'}/")
        sub_indent = " " * 4 * nivel
        for f in archivos[:20]:
            estructura.append(f"{sub_indent}{f}")
            
    return "\n".join(estructura)

def leer_archivo(ruta_relativa: str) -> str:
    """Lee un archivo relativo a la raíz (ej: 'backend/requirements.txt' o 'TECNOLOGIAS.md')."""
    ruta_limpia = ruta_relativa.strip("/\\")
    ruta_completa = os.path.normpath(os.path.join(PROYECTO_ROOT, ruta_limpia))
    if not os.path.exists(ruta_completa):
        return f"Error: {ruta_relativa} no existe."
    try:
        with open(ruta_completa, "r", encoding="utf-8", errors="ignore") as f:
            return "".join(f.readlines()[:250])
    except Exception as e:
        return f"Error al leer: {str(e)}"

def comando_git(args: str) -> str:
    """Ejecuta git en la raíz del proyecto."""
    comandos_ok = ["status", "log", "diff", "branch"]
    if not any(args.strip().startswith(cmd) for cmd in comandos_ok):
        return "Comando no permitido. Solo se permiten: status, log, diff, branch."
    try:
        git_bin = shutil.which("git") or "git"
        res = subprocess.run(f'"{git_bin}" {args}', cwd=PROYECTO_ROOT, shell=True, capture_output=True, text=True)
        return res.stdout if res.stdout else res.stderr
    except Exception as e:
        return f"Error al ejecutar git: {str(e)}"

# Inicializar cliente Gemini
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("❌ Error: GEMINI_API_KEY no está configurada en el archivo .env")
    exit(1)

client = genai.Client(api_key=api_key)

prompt_sistema = """
Eres un auditor de software. Estás inspeccionando un monorepositorio con 'backend', 'frontend' y 'plantillas_maestras'.
El README.md y TECNOLOGIAS.md están desactualizados.

Pasos obligatorios:
1. Revisa qué frameworks hay dentro de 'backend/' (busca requirements.txt, pyproject.toml, etc.).
2. Revisa qué frameworks hay dentro de 'frontend/' (busca package.json).
3. Revisa qué contiene 'plantillas_maestras/'.
4. Ejecuta `git log -n 5 --stat` y `git status` para ver qué se estuvo programando recientemente.
5. Genera un informe resumiendo el estado real y las discrepancias con TECNOLOGIAS.md y README.md.
"""

chat = client.chats.create(
    model="gemini-2.5-flash",
    config=types.GenerateContentConfig(
        system_instruction=prompt_sistema,
        tools=[listar_archivos, leer_archivo, comando_git],
        temperature=0.1
    )
)

if __name__ == "__main__":
    print("🔍 Iniciando auditoría de tu monorepositorio con Gemini 2.5 Flash...")
    respuesta = chat.send_message("Comienza la inspección de backend, frontend y el historial reciente.")
    print("\n" + "="*50)
    print(respuesta.text)
