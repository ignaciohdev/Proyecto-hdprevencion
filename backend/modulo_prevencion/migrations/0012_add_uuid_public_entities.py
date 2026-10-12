import uuid
from django.db import migrations, models


def gen_unique_uuids(apps, schema_editor):
    """
    Asigna un UUID único a cada registro existente en la base de datos
    antes de aplicar la restricción unique=True y null=False.
    """
    for model_name in ['Usuario', 'ReporteRiesgo', 'RegistroCapacitacion', 'SugerenciaConsulta']:
        Model = apps.get_model('modulo_prevencion', model_name)
        for obj in Model.objects.all():
            obj.uuid = uuid.uuid4()
            obj.save(update_fields=['uuid'])


class Migration(migrations.Migration):

    dependencies = [
        ('modulo_prevencion', '0011_plan_acceso_servicios'),
    ]

    operations = [
        # Paso 1: Agregar campos uuid como null=True (sin default estático para evitar colisiones en SQLite)
        migrations.AddField(
            model_name='usuario',
            name='uuid',
            field=models.UUIDField(null=True, editable=False, verbose_name='Identificador Único (UUID)'),
        ),
        migrations.AddField(
            model_name='reporteriesgo',
            name='uuid',
            field=models.UUIDField(null=True, editable=False, verbose_name='Identificador Único (UUID)'),
        ),
        migrations.AddField(
            model_name='registrocapacitacion',
            name='uuid',
            field=models.UUIDField(null=True, editable=False, verbose_name='Identificador Único (UUID)'),
        ),
        migrations.AddField(
            model_name='sugerenciaconsulta',
            name='uuid',
            field=models.UUIDField(null=True, editable=False, verbose_name='Identificador Único (UUID)'),
        ),

        # Paso 2: Poblar UUIDs únicos en datos existentes
        migrations.RunPython(gen_unique_uuids, reverse_code=migrations.RunPython.noop),

        # Paso 3: Aplicar restricción de unicidad, no nulo e indexación
        migrations.AlterField(
            model_name='usuario',
            name='uuid',
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, help_text='UUID público seguro para códigos QR y portal de participación.', unique=True, verbose_name='Identificador Único (UUID)'),
        ),
        migrations.AlterField(
            model_name='reporteriesgo',
            name='uuid',
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, help_text='UUID público seguro para reportes de condiciones y actos inseguros.', unique=True, verbose_name='Identificador Único (UUID)'),
        ),
        migrations.AlterField(
            model_name='registrocapacitacion',
            name='uuid',
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, help_text='UUID público seguro para firma de charlas vía código QR.', unique=True, verbose_name='Identificador Único (UUID)'),
        ),
        migrations.AlterField(
            model_name='sugerenciaconsulta',
            name='uuid',
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, help_text='UUID público seguro para el buzón digital de sugerencias y denuncias.', unique=True, verbose_name='Identificador Único (UUID)'),
        ),
    ]
