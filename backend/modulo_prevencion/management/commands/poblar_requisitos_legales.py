from django.core.management.base import BaseCommand
from modulo_prevencion.seeder_requisitos import asegurar_requisitos_base

class Command(BaseCommand):
    help = "Puebla el catálogo de Requisitos Legales Base SST de Chile si no existen"

    def handle(self, *args, **options):
        total = asegurar_requisitos_base()
        self.stdout.write(self.style.SUCCESS(f"Se poblaron/actualizaron exitosamente {total} requisitos legales oficiales."))
