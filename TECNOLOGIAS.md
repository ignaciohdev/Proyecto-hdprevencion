# Tecnologías del Proyecto - HD Prevención

Este documento detalla el stack tecnológico y las herramientas utilizadas en el desarrollo del proyecto **HD Prevención**, el cual consta de un portal web frontend moderno y una integración con agentes de Inteligencia Artificial (Gemini).

---

## 💻 Frontend (Interfaz de Usuario)

El frontend está diseñado como una aplicación web moderna, rápida y altamente interactiva utilizando las siguientes tecnologías:

*   **Next.js (v16.2.6)**: Framework de React para producción que gestiona el enrutamiento (App Router), renderizado en el servidor (SSR) y optimización estática.
*   **React (v19.2.4)**: Biblioteca principal para la construcción de interfaces de usuario interactivas basadas en componentes.
*   **TypeScript (v5.x)**: Superset de JavaScript que añade tipado estático, mejorando la robustez del código y la experiencia de desarrollo.
*   **Tailwind CSS (v4.0)**: Framework de CSS enfocado en utilidades para el diseño rápido, responsivo y personalizado directamente en el marcado HTML, junto con `@tailwindcss/postcss`.
*   **PostCSS**: Herramienta para transformar CSS con plugins JS.
*   **ESLint (v9.x)**: Herramienta de análisis estático para identificar y corregir problemas en el código de forma automática.

---

## 🤖 Agente de Inteligencia Artificial (Antigravity Agents)

El proyecto incluye un agente interactivo integrado que asiste en el diseño UX/UI y desarrollo frontend utilizando la API de Gemini:

*   **Node.js**: Entorno de ejecución para JavaScript en el servidor que ejecuta el script del agente.
*   **SDK de Gemini (`@google/generative-ai` v0.24.1)**: Biblioteca oficial para interactuar con los modelos de lenguaje generativo de Google.
*   **dotenv (v17.4.2)**: Módulo para cargar variables de entorno desde un archivo `.env` de forma segura (por ejemplo, claves de API).
*   **Funcionalidades del Agente**:
    *   *System Instructions*: Define el rol del agente como Diseñador Web Principal y Desarrollador Frontend experto en Tailwind CSS.
    *   *Code Interpreter (Ejecución de código)*: Permite al agente procesar y estructurar lógica dinámica.
    *   *File Search (Function Calling)*: Herramientas personalizadas para listar y leer archivos dentro del proyecto.

---

## 🗄️ Backend

*   **Estado Actual**: Directorio `/backend` preparado como estructura base para albergar las APIs y la lógica del lado del servidor en futuras fases del proyecto.

---

## 📁 Estructura General del Workspace

```text
Proyecto-hdprevencion/
├── backend/                  # Estructura para servicios del lado del servidor
├── frontend/                 # Aplicación Next.js (App Router, Tailwind CSS, TS)
│   ├── src/
│   │   └── app/              # Páginas y layouts principales
│   ├── package.json
│   └── tsconfig.json
├── antigravity_agents/       # Scripts y configuración del agente de IA
│   ├── agent_designer.json   # Definición del perfil del agente
│   └── run_agent.js          # Consola interactiva del agente de Gemini
├── .env                      # Variables de entorno (API Keys, etc.)
└── README.md                 # Instrucciones principales de inicio rápido
```
