# HD Prevención - Sistema Integral de Prevención de Riesgos

Portal web moderno y plataforma integral para la gestión de seguridad y salud en el trabajo, con módulo de prevención, backend en Django REST Framework, interfaz en Next.js y un agente de asistencia de diseño con Gemini.

---

## 🛠️ Stack Tecnológico Rápido

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4.
- **Backend**: Python 3.12, Django 4.2 LTS, Django REST Framework, JWT, PostgreSQL.
- **Agente de IA**: Python 3.12, `google-genai`, Gemini 3.8 Flash.

Consulta todos los detalles técnicos en [TECNOLOGIAS.md](file:///c:/Users/Ignacio/Documents/Proyectos/Proyecto-hdprevencion/TECNOLOGIAS.md).

---

## 🚀 Inicio Rápido

### 1. Variables de Entorno
Copia el archivo de ejemplo o edita tu `.env` en la raíz del proyecto:
```bash
cp .env.example .env
```

### 2. Frontend (Next.js)
```bash
cd frontend
npm install   # ya instalado
npm run dev
```
Accede a [http://localhost:3000](http://localhost:3000).

### 3. Backend (Django API)
```bash
cd backend
.\venv\Scripts\Activate.ps1
python manage.py runserver
```
Accede a la API en [http://127.0.0.1:8000](http://127.0.0.1:8000).

### 4. Agente Auditor (Gemini)
```bash
python agentes/auditor.py
```

