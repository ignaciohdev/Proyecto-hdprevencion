# 🤖 Manual de Uso: Agente Diseñador UI/UX & Frontend (HD Prevención)

Este manual explica cómo ejecutar e interactuar con el agente de Inteligencia Artificial que hemos integrado en el proyecto. Este agente está especializado como **Diseñador Web Principal y Desarrollador Experto en Tailwind CSS**, y está configurado para ayudarte a diseñar y construir los componentes del frontend, tales como los formularios de **Inicio de Sesión (Login)** y **Registro de Usuarios** en Next.js.

---

## 📋 Requisitos Previos

Antes de ejecutar el agente, asegúrate de:
1. Tener configurada tu API Key de Gemini. Debes tener un archivo `.env` en la raíz del proyecto (o dentro de la carpeta `antigravity_agents/`) con la siguiente variable:
   ```env
   GEMINI_API_KEY=tu_api_key_de_gemini_aqui
   ```
2. Tener instalado **Node.js** en tu sistema.
3. Las dependencias necesarias ya se encuentran instaladas en el directorio `antigravity_agents/node_modules/`. Si en algún momento necesitas reinstalarlas, puedes hacerlo ejecutando:
   ```bash
   cd antigravity_agents
   npm install
   ```

---

## 🚀 Cómo Ejecutar el Agente

Para iniciar la consola interactiva del agente, abre tu terminal y ejecuta los siguientes comandos desde la raíz del proyecto:

1. Entra a la carpeta de agentes:
   ```bash
   cd antigravity_agents
   ```
2. Ejecuta el script de inicio:
   ```bash
   node run_agent.js
   ```

Verás una salida similar a esta en tu consola:
```text
🤖 Cargando agente: Agente Diseñador UI/UX & Frontend
🎭 Rol: Diseñador Web Principal y Desarrollador Experto en Tailwind CSS
🛠️ Habilitando herramientas en base al perfil del agente...
💾 Habilitando herramienta de diseño: Escribir/Actualizar archivos de componentes (HTML, CSS, JS)

✨ ¡Agente iniciado con éxito! Escribe tus mensajes a continuación.
Escribe exit o salir para terminar.

👤 Tú: 
```

---

## 🛠️ Herramientas Integradas del Agente
El agente tiene superpoderes (Function Calling) que le permiten interactuar directamente con los archivos locales:
*   `listarArchivos`: Lista los archivos creados en el directorio del agente.
*   `leerArchivo`: Permite al agente leer tus especificaciones o código existente.
*   `crearOActualizarArchivo`: Le permite al agente guardar el código que genere (como componentes `.tsx` de Next.js o archivos HTML/CSS) directamente en la carpeta para que no tengas que copiar y pegar a mano.

---

## 💡 Prompts Recomendados para el Registro y Login

Una vez que el agente te responda con `👤 Tú:`, puedes usar los siguientes prompts para que cree los diseños del frontend:

### 1. Diseñar la Pantalla de Registro (Register)
Copia y pega este comando en el chat del agente:
> **Prompt:**
> *"Necesito que diseñes la interfaz del Formulario de Registro de usuarios (`/registro`) para la plataforma **HD Prevención** usando React, Next.js y Tailwind CSS. El formulario debe pedir: Nombre de usuario, Email, Contraseña, Confirmación de contraseña, Tipo de cuenta (Selector: Individual o Multi-asiento Corporativo) y un campo opcional para la Cuenta Padre (ID de Administrador, solo visible si elige Corporativo). Asegúrate de aplicar un diseño oscuro premium estilo SaaS con bordes redondeados (`rounded-xl`) y botones usando el naranja de acento (`bg-orange-600`). Cuando termines, guarda el componente en un archivo llamado `Registro.tsx` en tu carpeta usando tu herramienta."*

### 2. Diseñar la Pantalla de Inicio de Sesión (Login)
Copia y pega este comando en el chat del agente:
> **Prompt:**
> *"Diseña la pantalla de Inicio de Sesión (`/ingreso`) para la plataforma **HD Prevención** usando Next.js y Tailwind CSS. Debe solicitar el Email y la Contraseña, incluir un enlace a '¿Olvidaste tu contraseña?' y un enlace para redirigir al registro. Mantén la misma línea estética oscura con contrastes grises y el naranja de seguridad corporativo. Guarda el resultado en un archivo llamado `Login.tsx`."*

### 3. Integración con el Backend (JWT)
Si deseas que el componente incluya la lógica de envío de datos:
> **Prompt:**
> *"Modifica el componente `Registro.tsx` (o `Login.tsx`) para incluir la lógica de envío (`fetch`) a la API de Django en `http://localhost:8000/api/auth/register/` (o `/login/`). Debe enviar los datos del formulario mediante una petición POST, recibir los tokens JWT (`access` y `refresh`), guardarlos en el `localStorage` o cookies y redirigir al usuario al dashboard principal."*

---

## 🚪 Salir del Agente
Cuando hayas terminado de interactuar con el agente, simplemente escribe `salir` o `exit` en la consola para cerrar la conexión segura con Gemini.

Los componentes creados por el agente se guardarán en la carpeta `antigravity_agents/`. Desde ahí, podrás moverlos a tu estructura de Next.js en `frontend/src/app/` para integrarlos en las páginas del sitio web.
