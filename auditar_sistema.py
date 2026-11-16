#!/usr/bin/env python
"""
Lanzador rápido para la Suite de Auditoría y Evaluación Forense Ley N° 21.719
Uso:
    python auditar_sistema.py
"""
import os
import sys
import subprocess

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.join(root_dir, "backend")

    # Detectar el ejecutable de Python del entorno virtual si existe
    venv_python_win = os.path.join(root_dir, ".venv", "Scripts", "python.exe")
    venv_python_unix = os.path.join(root_dir, ".venv", "bin", "python")

    if os.path.exists(venv_python_win):
        python_exe = venv_python_win
    elif os.path.exists(venv_python_unix):
        python_exe = venv_python_unix
    else:
        python_exe = sys.executable

    manage_py = os.path.join(backend_dir, "manage.py")

    cmd = [python_exe, manage_py, "auditar_ley21719", "--output-dir", root_dir]
    
    # Pasar argumentos adicionales si se proporcionan
    if len(sys.argv) > 1:
        cmd.extend(sys.argv[1:])

    print(f"\n[*] Iniciando Evaluación de Seguridad y Protección de Datos Ley N° 21.719...")
    print(f"[*] Ejecutable: {python_exe}\n")

    try:
        res = subprocess.run(cmd, cwd=root_dir)
        sys.exit(res.returncode)
    except KeyboardInterrupt:
        print("\n[!] Auditoría interrumpida por el usuario.")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] Error al ejecutar la auditoría: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
