# 🗺️ MAPA DE ARQUITECTURA Y RUTAS — HD PREVENCIÓN

Este documento es la **fuente única de verdad** para desarrolladores y agentes de IA. Mapea la ubicación exacta de cada vista, módulo, componente y modelo de datos en el monorepositorio.

---

## 1. FRONTEND: GUÍA RÁPIDA DE CONCEPTOS VS ARCHIVOS

| Si buscas... | Ruta URL | Archivo Real en el Código | ¿Qué contiene? |
|---|---|---|---|
| **Página de Inicio / Landing** | `/` | `frontend/src/app/(public)/page.tsx` | Hero principal, servicios destacados, llamada a la acción y footer público. |
| **Navbar / Header Público** | Todas las públicas | `frontend/src/app/components/Header.tsx` | Menú superior (Inicio, Servicios, Planes, Documentos, Login). |
| **Inicio de Sesión (Login)** | `/ingreso` | `frontend/src/app/(auth)/ingreso/page.tsx` | Formulario JWT de login y redirección a `/panel`. |
| **Registro de Usuarios** | `/registro` | `frontend/src/app/(auth)/registro/page.tsx` | Formulario de registro de nuevas empresas/usuarios. |
| **Enrutador del Dashboard** | `/panel` | `frontend/src/app/(dashboard)/panel/page.tsx` | **NO TIENE UI:** Lee el rol del JWT y redirige a la vista correspondiente. |
| **DASHBOARD PRINCIPAL (Cliente)** | `/panel/cliente` | `frontend/src/app/(dashboard)/panel/cliente/page.tsx` | **El Dashboard real**: KPIs de riesgos, accidentes, inspecciones, cumplimiento. |
| **Dashboard Consultora** | `/panel/consultora` | `frontend/src/app/(dashboard)/panel/consultora/page.tsx` | Vista multi-empresa para consultores corporativos. |
| **Dashboard Moderador** | `/panel/admin-moderador` | `frontend/src/app/(dashboard)/panel/admin-moderador/page.tsx` | Gestión de empresas y aprobaciones. |
| **Dashboard Superadmin** | `/panel/superadmin` | `frontend/src/app/(dashboard)/panel/superadmin/page.tsx` | Control total del sistema y métricas globales. |
| **Sidebar & Layout del Panel** | Todas bajo `/panel/*` | `frontend/src/app/(dashboard)/layout.tsx` | Menú lateral izquierdo, cabecera de usuario, modo oscuro y logout. |

---

## 2. MÓDULOS OPERATIVOS DEL DASHBOARD (`frontend/src/app/(dashboard)/panel/`)

| Módulo | Ruta URL | Archivo Principal | Función Legal / Operativa |
|---|---|---|---|
| **Reportes de Riesgo y Hallazgos** | `/panel/reportes-riesgo` | `reportes-riesgo/page.tsx` | Registro de actos/condiciones inseguras en terreno, fotos, severidad y jerarquía de controles. |
| **Inspecciones de Seguridad** | `/panel/inspecciones` | `inspecciones/page.tsx` | Checklists normativos (DS 594, extintores, EPP) y porcentaje de cumplimiento. |
| **Investigación de Accidentes** | `/panel/accidentes` | `accidentes/page.tsx` | Registro de eventos (Trabajo vs Trayecto vs Incidente), informe técnico y causa raíz. |
| **Capacitaciones e Inducciones** | `/panel/capacitaciones` | `capacitaciones/page.tsx` | Registro de asistencia a inducción ODI (Decreto 44), charlas de 5 min y vigencia. |
| **Buzón Digital (Ley Karin)** | `/panel/buzon-digital` | `buzon-digital/page.tsx` | Canal de denuncias anónimas por acoso y violencia (Ley N° 21.643). |
| **Gestión de Contratistas** | `/panel/contratistas` | `contratistas/page.tsx` | Acreditación y control documental según régimen de subcontratación (DS 76). |
| **Perfil de Usuario** | `/panel/perfil` | `perfil/page.tsx` | Datos personales, empresa asociada y rol. |
| **Suscripciones y Planes** | `/panel/planes` | `planes/page.tsx` | Planes activos del cliente y pasarela de pago. |

---

## 3. SECCIÓN PÚBLICA INFORMATIVA (`frontend/src/app/(public)/`)

*Nota: Estas páginas son informativas para clientes que visitan la web antes de loguearse.*

| Sección | Ruta URL | Archivo | Propósito |
|---|---|---|---|
| **Catálogo de Servicios** | `/servicios` | `servicios/page.tsx` | Detalle de asesorías y servicios ofrecidos. |
| **Planes de Precios** | `/planes` | `planes/page.tsx` | Tabla comparativa de planes SaaS. |
| **Catálogo de Capacitaciones** | `/capacitaciones` | `capacitaciones/page.tsx` | Oferta pública de cursos disponibles. |
| **Descargas y Formatos** | `/documentos` | `documentos/page.tsx` | Plantillas descargables (reglamentos, formatos ODI). |
| **Contacto** | `/contacto` | `contacto/page.tsx` | Formulario de contacto comercial. |
| **Noticias y Blog** | `/noticias` | `noticias/page.tsx` | Artículos de prevención y cambios normativos. |

---

## 4. BACKEND DJANGO (`backend/modulo_prevencion/`)

| Archivo | Responsabilidad Principal |
|---|---|
| `models.py` | Definición de las entidades en PostgreSQL: `Empresa`, `Trabajador`, `PuestoTrabajo`, `MatrizIPER`, `Peligro`, `Inspeccion`, `AccidenteInvestigacion`, `BuzonDenunciaKarin`, `SuscripcionPlan`. |
| `views.py` | Controladores y ViewSets DRF: Autenticación JWT, CRUD de riesgos, auditorías, estadísticas de dashboards. |
| `serializers.py` | Serializadores DRF para validación de datos de entrada/salida y formatos JSON. |
| `urls.py` | Mapeo de endpoints de la API (ej: `/api/usuarios/perfil/`, `/api/riesgos/`, `/api/accidentes/`). |
| `admin.py` | Configuración del panel de administración nativo de Django. |

---

## 5. DOCUMENTOS NORMATIVOS Y AGENTES IA (`agentes/`)

| Archivo / Carpeta | Función |
|---|---|
| `agentes/orquestador.py` | Sistema unificado de agentes (Prevencionista, DB, Backend, Frontend). Motor híbrido (Ollama local RTX 3050 / Gemini nube). |
| `agentes/doc_agents/` | Carpeta de legislación oficial chilena (Decreto Supremo N° 44, Ley 16.744, DS 594). Los agentes buscan en estos textos para citar artículos exactos. |
| `agentes/resultados/` | Informes de auditoría y código generado exportados en Markdown. |

---

## 6. DIAGNÓSTICO DE DESORDEN Y PROPUESTA DE MEJORA EN EL FRONTEND

### ¿Por qué se siente desordenado actualmente?
1. **Doble conjunto de nombres idénticos**: Hay `/capacitaciones`, `/servicios` y `/planes` en la sección pública y también dentro de `/panel/`.
2. **Dashboard fragmentado**: El archivo `/panel/page.tsx` no tiene diseño (es solo un redirector). El verdadero dashboard está en `/panel/cliente/page.tsx`.
3. **Layout monolítico gigante**: `frontend/src/app/(dashboard)/layout.tsx` mide 20 KB y contiene toda la barra lateral, navbar, menú móvil y decodificación de JWT en un solo bloque.

### Estructura Recomendada (Modular y Limpia):
```text
frontend/src/
├── app/
│   ├── (auth)/                  # Login y Registro
│   ├── (public)/                # Landing y páginas informativas públicas
│   └── (dashboard)/             # Portal SaaS autenticado
│       ├── layout.tsx           # Layout limpio que solo importa <Sidebar /> y <Navbar />
│       └── panel/
│           ├── page.tsx         # Redirige según rol
│           ├── cliente/         # Dashboard Cliente
│           ├── consultora/      # Dashboard Consultora
│           ├── reportes-riesgo/ # Hallazgos
│           ├── inspecciones/    # Inspecciones
│           └── ...
└── components/                  # Componentes reutilizables bien clasificados
    ├── ui/                      # Botones, Modales, Badges, Inputs
    ├── landing/                 # Header, Hero, Footer, Testimonios
    └── dashboard/               # Sidebar, DashboardNavbar, StatCard, ChartCard
```
