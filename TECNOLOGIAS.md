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

## 🤖 Agente Auditor de Inteligencia Artificial (`agentes/`)

El proyecto incluye un **Agente Auditor** en Python para inspeccionar la coherencia del monorepositorio de manera autónoma:

*   **SDK Oficial**: `google-genai` (v2.23+) con `python-dotenv`.
*   **Modelo**: `gemini-2.5-flash` (la versión más avanzada y rápida de Gemini Flash con soporte nativo de Function Calling).
*   **Herramientas Autónomas (Function Calling)**:
    *   `listar_archivos`: Exploración de la estructura del proyecto.
    *   `leer_archivo`: Inspección de archivos de configuración y dependencias.
    *   `comando_git`: Análisis del historial y estado con Git (`status`, `log`, `diff`).


---

## 🗄️ Backend (API REST y Lógica de Negocio)

El backend está construido con Python y Django, proporcionando una API REST completa para la gestión de prevención de riesgos:

*   **Python (v3.12.x)**: Entorno de ejecución con entorno virtual dedicado (`backend/venv`).
*   **Django (v4.2.30 LTS)**: Framework web robusto para backend que gestiona los modelos ORM, autenticación de usuarios y administración.
*   **Django REST Framework (v3.16.1)**: Toolkit potente para la construcción de la API REST que conecta con el frontend.
*   **Simple JWT (`djangorestframework_simplejwt` v5.5.1)**: Autenticación de endpoints basada en tokens JSON Web Token (JWT).
*   **PostgreSQL (`psycopg2-binary` v2.9.12 & `dj-database-url` v3.0.1)**: Motor de base de datos relacional para entornos de desarrollo y producción (compatible con Supabase y Render).
*   **WhiteNoise (v6.11.0)**: Servidor optimizado para la entrega de archivos estáticos en producción.
*   **Django CORS Headers (v4.9.0)**: Gestión de políticas de intercambio de recursos entre orígenes para la comunicación con Next.js (`http://localhost:3000`).
*   **Procesamiento de Archivos**: `openpyxl` (v3.1.5) para manipulación de planillas Excel (IPER) y `pillow` (v11.3.0) para imágenes.
*   **Gunicorn (v23.0.0)**: Servidor HTTP WSGI para despliegue en entornos de producción.

---

## 📁 Estructura General del Workspace

```text
Proyecto-hdprevencion/
├── backend/                  # API REST Django 4.2 + DRF
│   ├── core/                 # Configuración principal de Django (settings, urls, wsgi)
│   ├── modulo_prevencion/    # Modelos, vistas, serializers y lógica de negocio
│   ├── venv/                 # Entorno virtual de Python 3.12
│   ├── manage.py             # CLI de administración de Django
│   ├── requirements.txt      # Dependencias de Python
│   └── seed.py               # Script de inicialización de datos de prueba
├── frontend/                 # Aplicación Next.js 16 (App Router, React 19, Tailwind CSS v4, TS)
│   ├── src/
│   │   └── app/              # Páginas y layouts principales
│   ├── package.json
│   └── tsconfig.json
├── plantillas_maestras/      # Documentos base y plantillas de prevención
├── .env                      # Variables de entorno locales (API Keys, DB)
├── .env.example              # Plantilla documentada de variables de entorno
└── README.md                 # Instrucciones principales de inicio rápido
```

---

## 🚀 Comandos Rápidos de Ejecución

### 1. Iniciar Frontend (Next.js)
```bash
cd frontend
npm run dev
# Disponible en: http://localhost:3000
```

### 2. Iniciar Backend (Django API)
```bash
cd backend
.\venv\Scripts\Activate.ps1
python manage.py runserver
# Disponible en: http://127.0.0.1:8000
```


