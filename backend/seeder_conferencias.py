import os
import sys
import django

# Asegurar path de backend
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from modulo_prevencion.management.commands.seed_conferencias import poblar_conferencias

if __name__ == '__main__':
    print("=" * 70)
    print("EJECUTANDO SEEDER DE CONFERENCIAS Y CAPACITACIONES DEDUCIDAS (2026)")
    print("=" * 70)
    poblar_conferencias()
    print("=" * 70)
    print("SEEDER FINALIZADO CON ÉXITO")
    print("=" * 70)
