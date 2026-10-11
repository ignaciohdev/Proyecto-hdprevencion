import os
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Cargar variables de entorno
ruta_actual = os.path.dirname(os.path.abspath(__file__))
ruta_raiz = os.path.join(ruta_actual, "..")
ruta_env = os.path.join(ruta_raiz, ".env")
load_dotenv(ruta_env)

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("¡No se encontró GEMINI_API_KEY en el archivo .env!")

client = genai.Client(api_key=api_key)
MODELO_GEMINI = "gemini-3.8-flash"

# ==========================================
# 🛠️ HERRAMIENTA AUTÓNOMA (FUNCTION CALLING)
# ==========================================
def leer_archivo(ruta_relativa: str) -> str:
    """
    Lee y retorna el contenido de un archivo específico del proyecto.
    Usa esta herramienta cuando necesites auditar código, ver modelos o componentes.
    """
    # Construimos la ruta absoluta basada en la raíz del proyecto
    ruta_absoluta = os.path.join(ruta_raiz, ruta_relativa)
    try:
        with open(ruta_absoluta, 'r', encoding='utf-8') as f:
            contenido = f.read()
            return f"--- CONTENIDO DE {ruta_relativa} ---\n{contenido}"
    except FileNotFoundError:
        return f"Error: El archivo '{ruta_relativa}' no existe."
    except Exception as e:
        return f"Error leyendo el archivo: {str(e)}"

# ==========================================
# CLASE BASE DEL AGENTE
# ==========================================
class AgenteExperto:
    def __init__(self, rol_nombre: str, system_prompt: str, temperatura: float = 0.2):
        self.rol_nombre = rol_nombre
        
        # AQUÍ INYECTAMOS LA HERRAMIENTA AL AGENTE
        self.config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=temperatura,
            tools=[leer_archivo]  # <--- MAGIA: El agente ahora puede usar esta función
        )
        
        self.chat_session = client.chats.create(
            model=MODELO_GEMINI,
            config=self.config
        )

    def enviar_mensaje(self, mensaje: str) -> str:
        try:
            print(f"🤖 [{self.rol_nombre}] Analizando...")
            response = self.chat_session.send_message(mensaje)
            
            # Verificamos que no sea None para satisfacer el tipado estricto
            if response.text is not None:
                return response.text
                
            return "⚠️ Advertencia: El modelo no devolvió texto (posible bloqueo de seguridad)."
            
        except Exception as e:
            return f"❌ Error en el agente {self.rol_nombre}: {str(e)}"