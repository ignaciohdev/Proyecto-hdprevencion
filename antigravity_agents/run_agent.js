const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenvPath = fs.existsSync(path.join(__dirname, '.env')) ? path.join(__dirname, '.env') : path.join(__dirname, '../.env');
require('dotenv').config({ path: dotenvPath });

// 1. Cargar la configuración del agente
const agentConfigPath = path.join(__dirname, 'agent_designer.json');
if (!fs.existsSync(agentConfigPath)) {
  console.error('❌ Error: No se encontró el archivo agent_designer.json');
  process.exit(1);
}

const agentConfig = JSON.parse(fs.readFileSync(agentConfigPath, 'utf8'));
console.log(`🤖 Cargando agente: \x1b[36m${agentConfig.name}\x1b[0m`);
console.log(`🎭 Rol: ${agentConfig.role}`);

// 2. Construir las instrucciones del sistema (System Instruction)
const systemInstruction = `
Eres un asistente de IA con la siguiente identidad y directrices:

IDENTIDAD:
- Nombre: ${agentConfig.name}
- Rol: ${agentConfig.role}
- Objetivo (Goal): ${agentConfig.goal}
- Historia de fondo (Backstory): ${agentConfig.backstory}

DIRECTRICES DE DISEÑO Y COMPORTAMIENTO:
${agentConfig.system_prompt}

IMPORTANTE: Responde siempre en español y mantén tu rol en todo momento.
`;

// 3. Configurar las herramientas (Tools) basadas en el JSON del agente
const tools = [];
const functionRegistry = {};

const hasCodeInterpreter = agentConfig.tools.some(t => t.type === 'code_interpreter');
const hasFileSearch = agentConfig.tools.some(t => t.type === 'file_search');

if (hasCodeInterpreter || hasFileSearch) {
  console.log('🛠️  Habilitando herramientas en base al perfil del agente...');
  
  const functionDeclarations = [];

  // Registrar listar y leer archivos
  functionDeclarations.push({
    name: 'listarArchivos',
    description: 'Lista recursivamente todos los archivos en el proyecto para ver qué recursos, especificaciones o archivos HTML/CSS existen.',
    parameters: { type: 'OBJECT', properties: {} }
  });

  functionDeclarations.push({
    name: 'leerArchivo',
    description: 'Lee el contenido de un archivo específico del proyecto para obtener detalles técnicos o especificaciones.',
    parameters: {
      type: 'OBJECT',
      properties: {
        rutaRelativa: {
          type: 'STRING',
          description: 'Ruta relativa del archivo a leer (ej. especificaciones.txt).'
        }
      },
      required: ['rutaRelativa']
    }
  });

  // Habilitar escritura de archivos (sirve como reemplazo superior para el code_interpreter del diseñador)
  if (hasCodeInterpreter) {
    console.log('💾 Habilitando herramienta de diseño: Escribir/Actualizar archivos de componentes (HTML, CSS, JS)');
    functionDeclarations.push({
      name: 'crearOActualizarArchivo',
      description: 'Crea un nuevo archivo o actualiza uno existente en el proyecto con el código o diseño generado (ej. un componente HTML o archivo CSS).',
      parameters: {
        type: 'OBJECT',
        properties: {
          rutaRelativa: {
            type: 'STRING',
            description: 'Ruta relativa del archivo a escribir (ej. Agentes/Boton.html).'
          },
          contenido: {
            type: 'STRING',
            description: 'El contenido de texto completo que se escribirá en el archivo.'
          }
        },
        required: ['rutaRelativa', 'contenido']
      }
    });
  }

  tools.push({ functionDeclarations });

  // Registro de la implementación de las funciones
  functionRegistry['listarArchivos'] = () => {
    try {
      const getFilesRecursively = (dir) => {
        let results = [];
        const list = fs.readdirSync(dir);
        list.forEach(file => {
          // Ignorar node_modules y carpetas ocultas/del sistema
          if (file === 'node_modules' || file.startsWith('.')) return;
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat && stat.isDirectory()) {
            results = results.concat(getFilesRecursively(fullPath));
          } else {
            results.push(path.relative(__dirname, fullPath));
          }
        });
        return results;
      };
      const files = getFilesRecursively(__dirname);
      return { archivos: files };
    } catch (error) {
      return { error: `No se pudieron listar los archivos: ${error.message}` };
    }
  };

  functionRegistry['leerArchivo'] = ({ rutaRelativa }) => {
    try {
      const safePath = path.resolve(__dirname, rutaRelativa);
      if (!safePath.startsWith(__dirname)) {
        return { error: 'Acceso denegado: El archivo solicitado está fuera del proyecto.' };
      }
      if (!fs.existsSync(safePath)) {
        return { error: `El archivo "${rutaRelativa}" no existe.` };
      }
      const content = fs.readFileSync(safePath, 'utf8');
      return { contenido: content };
    } catch (error) {
      return { error: `Error al leer el archivo: ${error.message}` };
    }
  };

  if (hasCodeInterpreter) {
    functionRegistry['crearOActualizarArchivo'] = ({ rutaRelativa, contenido }) => {
      try {
        const safePath = path.resolve(__dirname, rutaRelativa);
        if (!safePath.startsWith(__dirname)) {
          return { error: 'Acceso denegado: No se pueden escribir archivos fuera del proyecto.' };
        }
        
        const dir = path.dirname(safePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(safePath, contenido, 'utf8');
        console.log(`\n💾 [Herramienta] Archivo guardado con éxito: \x1b[32m${rutaRelativa}\x1b[0m`);
        return { success: true, mensaje: `Archivo "${rutaRelativa}" guardado correctamente.` };
      } catch (error) {
        return { error: `Error al escribir el archivo: ${error.message}` };
      }
    };
  }
}


// 4. Inicializar Gemini
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('\n❌ Error: GEMINI_API_KEY no está configurada en el archivo .env');
  console.log('Por favor, crea un archivo .env en esta carpeta con tu API Key:\nGEMINI_API_KEY=tu_api_key_aqui\n');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
// Usamos gemini-2.5-flash ya que está disponible y soporta ejecución de código y llamadas a funciones.
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: systemInstruction,
  tools: tools.length > 0 ? tools : undefined
});

// 5. Iniciar la sesión de chat interactiva
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const chat = model.startChat();

console.log('\n✨ \x1b[32m¡Agente iniciado con éxito!\x1b[0m Escribe tus mensajes a continuación.');
console.log('Escribe \x1b[33mexit\x1b[0m o \x1b[33msalir\x1b[0m para terminar.\n');

// Función helper para procesar la interacción con el agente y resolver tool calls (llamadas a funciones)
async function enviarMensajeYProcesarHerramientas(mensaje) {
  let response = await chat.sendMessage(mensaje);

  // Loop para manejar llamadas a funciones consecutivas si las hay
  while (response.response.functionCalls && response.response.functionCalls.length > 0) {
    const calls = response.response.functionCalls;
    const functionResponses = [];

    for (const call of calls) {
      const { name, args } = call;
      console.log(`⚙️  [Llamada a Herramienta] Ejecutando: \x1b[35m${name}\x1b[0m con argumentos:`, args);

      let fnResult;
      if (functionRegistry[name]) {
        fnResult = functionRegistry[name](args);
      } else {
        fnResult = { error: `Función "${name}" no está registrada en el cliente.` };
      }

      functionResponses.push({
        functionResponse: {
          name: name,
          response: fnResult
        }
      });
    }

    // Enviar las respuestas de las funciones de vuelta al agente
    response = await chat.sendMessage(functionResponses);
  }

  return response.response.text();
}

function promptUser() {
  rl.question('\x1b[34m👤 Tú:\x1b[0m ', async (input) => {
    const trimmedInput = input.trim();
    if (trimmedInput.toLowerCase() === 'exit' || trimmedInput.toLowerCase() === 'salir') {
      console.log('\n👋 ¡Hasta luego!');
      rl.close();
      return;
    }

    if (trimmedInput === '') {
      promptUser();
      return;
    }

    try {
      process.stdout.write(`\n🤖 \x1b[36m${agentConfig.name}:\x1b[0m Pensando...`);
      const responseText = await enviarMensajeYProcesarHerramientas(trimmedInput);

      // Borrar la línea de "Pensando..." y mostrar la respuesta real
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      console.log(`🤖 \x1b[36m${agentConfig.name}:\x1b[0m\n${responseText}\n`);
    } catch (error) {
      console.error(`\n❌ Error al comunicarse con Gemini:`, error.message);
    }

    promptUser();
  });
}

promptUser();
