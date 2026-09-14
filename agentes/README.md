# 🔍 Agente Auditor - HD Prevención

Este módulo contiene el **Agente Auditor** del monorepositorio, desarrollado con el SDK oficial de **Google Gemini (`google-genai`)** utilizando el modelo **`gemini-3.8-flash`**.

---

## 🛠️ Herramientas Integradas (Function Calling)

El agente dispone de 3 herramientas nativas que ejecuta de forma autónoma durante su inspección:

1. **`listar_archivos(subdirectorio)`**: Explora la estructura de directorios y archivos de la raíz del monorepositorio o cualquier subcarpeta, ignorando cachés y `node_modules`.
2. **`leer_archivo(ruta_relativa)`**: Lee el contenido de archivos clave (como `requirements.txt`, `package.json`, etc.).
3. **`comando_git(args)`**: Ejecuta comandos seguros de Git (`status`, `log`, `diff`, `branch`) para analizar el historial reciente de desarrollo.

---

## 🚀 Cómo Ejecutar el Agente

### 1. Requisitos Previos
Asegúrate de contar con la variable `GEMINI_API_KEY` en el archivo `.env` de la raíz del proyecto.

Las dependencias requeridas son:
```bash
pip install -r requirements.txt
```

### 2. Ejecutar la Auditoría
Desde la raíz del proyecto:
```bash
python agentes/auditor.py
```
O desde la carpeta `agentes`:
```bash
cd agentes
python auditor.py
```
