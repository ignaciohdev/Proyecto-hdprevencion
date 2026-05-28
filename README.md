# Agente Diseñador UI/UX & Frontend - Antigravity Prevención

Este proyecto te permite ejecutar el agente definido en [agent_designer.json](file:///c:/Users/Ignac/.gemini/antigravity/scratch/Proyecto-hdprevencion/agent_designer.json) interactuando con él desde la consola de comandos de Node.js. El script utiliza el SDK oficial de **Gemini** (`@google/generative-ai`) para simular la personalidad, el rol, la historia de fondo y los objetivos configurados.

## Características Soportadas

1. **Personalidad y Rol**: Se configuran como `systemInstruction` en Gemini para asegurar que el agente actúe como tu Diseñador Web Principal y Desarrollador Frontend experto en Tailwind CSS.
2. **Herramientas (Tools)**:
   - **Intérprete de Código (`code_interpreter`)**: Habilita la ejecución de código nativa de Gemini (`codeExecution`), permitiéndole simular y estructurar lógica de layouts o componentes.
   - **Búsqueda de Archivos (`file_search`)**: Se implementa mediante *Function Calling* nativo para que el agente pueda explorar y leer archivos del proyecto usando las funciones personalizadas `listarArchivos` y `leerArchivo`.

## Requisitos Previos

- Tener instalado **Node.js** (versión 18 o superior recomendada).
- Configurar tu API Key de Gemini en el archivo `.env` (ya hemos copiado el de tu otro proyecto).

## Cómo Ejecutar el Agente

1. **Instalar Dependencias**:
   Abre una terminal en esta carpeta (`c:/Users/Ignac/.gemini/antigravity/scratch/Proyecto-hdprevencion`) y ejecuta:
   ```bash
   npm install
   ```

2. **Iniciar el Agente**:
   Ejecuta el siguiente comando para iniciar el chat interactivo en consola:
   ```bash
   npm start
   ```

3. **Interactuar con el Agente**:
   Una vez iniciado, escribe tus instrucciones o preguntas directamente en la terminal. Para salir del chat, escribe `exit` o `salir`.

### Ejemplo de interacción:
- *Tú:* "¿Puedes listar los archivos del proyecto para ver qué especificaciones tenemos?"
- *Agente:* (Automáticamente ejecutará la herramienta `listarArchivos`, verá la estructura de carpetas y te la describirá en base a su rol).
- *Tú:* "¿Cómo diseñarías el layout del portal público de Antigravity Prevención usando Tailwind?"
