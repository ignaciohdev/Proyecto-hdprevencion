"""
Comando de mantenimiento criptográfico para:
1. Cifrar registros históricos en texto plano hacia EncryptedTextField.
2. Rotar registros existentes hacia la llave primaria vigente en FIELD_ENCRYPTION_KEY
   usando FIELD_ENCRYPTION_OLD_KEYS durante ventanas de rotación (Ley 21.719 / sec-rest).
"""
from django.core.management.base import BaseCommand
from django.db import connection, transaction

from modulo_prevencion.crypto import cifrar_texto, rotar_texto_cifrado
from modulo_prevencion.models import DenunciaLeyKarin, EntregaEPP, InvestigacionAccidente, Usuario

OBJETIVOS = (
    (DenunciaLeyKarin, ('rut_denunciante', 'nombre_denunciante', 'correo_denunciante', 'telefono_denunciante', 'nombre_denunciado', 'cargo_area_denunciado', 'descripcion_circunstanciada', 'testigos_o_evidencias', 'medidas_resguardo_detalle')),
    (InvestigacionAccidente, ('nombre_afectado', 'rut_afectado', 'descripcion_evento', 'tipo_lesion', 'parte_cuerpo_afectada')),
    (EntregaEPP, ('firma_digital',)),
    (Usuario, ('mfa_secret', 'mfa_secret_pendiente')),
)


class Command(BaseCommand):
    help = "Cifra campos sensibles heredados y rota textos cifrados a la llave primaria activa (MultiFernet)."

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Inspecciona cuántos valores requieren cifrado o rotación sin escribir cambios.')

    def handle(self, *args, **options):
        dry_run = bool(options['dry_run'])
        total_actualizados = 0

        for model, fields in OBJETIVOS:
            table = model._meta.db_table
            cols_sql = ', '.join(['id'] + list(fields))
            with connection.cursor() as cursor:
                cursor.execute(f"SELECT {cols_sql} FROM {table}")
                rows = cursor.fetchall()

            for row in rows:
                pk = row[0]
                updates = {}
                for idx, field in enumerate(fields, start=1):
                    raw_val = row[idx]
                    if not raw_val:
                        continue
                    raw_str = str(raw_val)
                    if not raw_str.startswith('enc:v1:'):
                        new_token = cifrar_texto(raw_str)
                    else:
                        new_token = rotar_texto_cifrado(raw_str)
                    if new_token != raw_str:
                        updates[field] = new_token

                if updates:
                    total_actualizados += len(updates)
                    if not dry_run:
                        placeholders = ', '.join(f"{col} = %s" for col in updates.keys())
                        params = list(updates.values()) + [pk]
                        with transaction.atomic():
                            with connection.cursor() as cursor:
                                cursor.execute(f"UPDATE {table} SET {placeholders} WHERE id = %s", params)

        self.stdout.write(
            self.style.SUCCESS(
                f"{'[DRY-RUN] ' if dry_run else ''}Campos sensibles cifrados/rotados: {total_actualizados}"
            )
        )
