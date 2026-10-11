# agentes/test_auditoria.py
from agenteexpertoprevencionista import agente_prevencionista

def auditar_codigo_real():
    # CAMBIA ESTA RUTA por el archivo real que quieras que revise. 
    # Ejemplos: "frontend/src/app/page.tsx", "backend/modulo_prevencion/models.py"
    archivo_a_revisar = "frontend\src\app\(dashboard)\panel\reportes-riesgo" 
    
    instruccion = f"""
    Necesito que audites el modulo de los reportes de riesgo.
    Por favor, usa tu herramienta `leer_archivo` para abrir el archivo: '{archivo_a_revisar}'.
    
    Léelo y dime si los campos que programó el desarrollador cumplen con la 
    normativa chilena o si nos falta algo crucial y todas las mejoras necesarias para dejarlo lo mas completo posible.
    """
    
    print(f"Enviando orden de auditoría para: {archivo_a_revisar}...")
    respuesta = agente_prevencionista.enviar_mensaje(instruccion)
    
    print("\n=== RESULTADO DE LA AUDITORÍA ===")
    print(respuesta)

if __name__ == "__main__":
    auditar_codigo_real()