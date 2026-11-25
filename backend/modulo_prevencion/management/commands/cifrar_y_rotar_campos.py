"""
Comando de mantenimiento criptográfico para:
1. Cifrar registros históricos en texto plano hacia EncryptedTextField.
2. Rotar registros existentes hacia la llave primaria vigente en FIELD_ENCRYPTION_KEY
   usando FIELD_ENCRYPTION_OLD_KEYS durante ventanas de rotación (Ley 21.719 / sec-rest).
"""
import json
from django.core.management.base import BaseCommand
from django.db import connection, transaction

from modulo_prevencion.crypto import (
    calcular_rut_hmac,
    cifrar_texto,
    normalizar_rut_blind_index,
    rotar_texto_cifrado,
)
from modulo_prevencion.models import (
    DenunciaLeyKarin,
    EntregaEPP,
    InvestigacionAccidente,
    RegistroCapacitacion,
    Usuario,
)

OBJETIVOS = (
    (DenunciaLeyKarin, ('rut_denunciante', 'nombre_denunciante', 'correo_denunciante', 'telefono_denunciante', 'nombre_denunciado', 'cargo_area_denunciado', 'descripcion_circunstanciada', 'testigos_o_evidencias', 'medidas_resguardo_detalle')),
    (InvestigacionAccidente, ('nombre_afectado', 'rut_afectado', 'descripcion_evento', 'tipo_lesion', 'parte_cuerpo_afectada', 'causas_inmediatas', 'causas_basicas', 'analisis_5_porques', 'arbol_de_causas')),
    (RegistroCapacitacion, ('asistentes',)),
    (EntregaEPP, ('firma_digital',)),
    (Usuario, ('mfa_secret', 'mfa_secret_pendiente')),
)

JSON_FIELDS = {
    'causas_inmediatas',
    'causas_basicas',
    'analisis_5_porques',
    'arbol_de_causas',
    'asistentes',
}


class Command(BaseCommand):
    help = (
        "Cifra campos sensibles heredados (incluidos JSON clínicos y asistentes), "
        "backfillea rut_hmac y rota textos cifrados a la llave primaria activa (MultiFernet)."
    )

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Inspecciona cuántos valores requieren cifrado, backfill o rotación sin escribir cambios.')

    def handle(self, *args, **options):
        dry_run = bool(options['dry_run'])
        total_actualizados = 0
        total_hmac = 0

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
                    if raw_val is None or raw_val == '':
                        continue
                    if field in JSON_FIELDS and isinstance(raw_val, (dict, list)):
                        raw_str = json.dumps(raw_val, ensure_ascii=False)
                    else:
                        raw_str = str(raw_val)
                    if not raw_str:
                        continue
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

        # Backfill de blind index HMAC-SHA256 en DenunciaLeyKarin e InvestigacionAccidente
        for model, rut_attr in (
            (InvestigacionAccidente, 'rut_afectado'),
            (DenunciaLeyKarin, 'rut_denunciante'),
        ):
            for obj in model.objects.all().iterator():
                rut_val = getattr(obj, rut_attr, '') or ''
                norm = normalizar_rut_blind_index(rut_val)
                esperado = '' if (not norm or norm.startswith('ANON')) else calcular_rut_hmac(rut_val)
                if (obj.rut_hmac or '') != esperado:
                    total_hmac += 1
                    if not dry_run:
                        model.objects.filter(pk=obj.pk).update(rut_hmac=esperado)

        self.stdout.write(
            self.style.SUCCESS(
                f"{'[DRY-RUN] ' if dry_run else ''}Campos sensibles cifrados/rotados: {total_actualizados}; "
                f"rut_hmac actualizados: {total_hmac}"
            )
        )
