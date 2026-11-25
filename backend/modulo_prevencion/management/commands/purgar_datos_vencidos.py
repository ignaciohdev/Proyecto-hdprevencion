"""
Comando de gestión programable (Cron Job) para purga y anonimización automática
al vencer los plazos de conservación declarados en la Política de Privacidad (Art. 7 y 14 ter Ley 21.719).
Protege de forma estricta la retención mínima legal SST de 5 años (1.825 días) y respeta bloqueos ARCO activos.
"""
from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from modulo_prevencion.crypto import calcular_rut_hmac, normalizar_rut_blind_index
from modulo_prevencion.models import (
    Contratista,
    DenunciaLeyKarin,
    Empresa,
    EntregaEPP,
    InvestigacionAccidente,
    MensajeContacto,
    RegistroCapacitacion,
    SolicitudCapacitacion,
    SolicitudDerechoARCO,
    Suscripcion,
    Trabajador,
    Usuario,
)

MIN_RETENCION_SST_DIAS = 1825  # 5 años mínimos legales (Ley 16.744 / Circular SUSESO 3336 / D.S. 44 / Ley 21.643)


def _normalizar_rut(rut: str) -> str:
    return normalizar_rut_blind_index(rut)


class Command(BaseCommand):
    help = (
        "Purga o anonimiza registros cuyo plazo legal de retención haya vencido "
        "(12 meses comerciales, 90 días cuentas inactivas sin deuda/SST, >=5 años SST desvinculados), "
        "respetando bloqueos provisionales ARCO-POL activos."
    )

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Simula y reporta sin modificar ni eliminar registros.')
        parser.add_argument('--dias-comerciales', type=int, default=365, help='Días de retención para consultas y cotizaciones no concretadas (default: 365).')
        parser.add_argument('--dias-cuentas-inactivas', type=int, default=90, help='Días tras desactivación de cuenta sin deber SST/tributario (default: 90).')
        parser.add_argument('--dias-sst', type=int, default=MIN_RETENCION_SST_DIAS, help='Días mínimos para anonimización de trabajadores desvinculados antiguos (mínimo legal 1825).')
        parser.add_argument('--incluir-sst', action='store_true', help='Habilita anonimización de trabajadores desvinculados con antigüedad > dias-sst y sin eventos SST recientes.')

    def handle(self, *args, **options):
        dry_run = bool(options['dry_run'])
        dias_comerciales = int(options['dias_comerciales'])
        dias_inactivas = int(options['dias_cuentas_inactivas'])
        dias_sst = int(options['dias_sst'])
        incluir_sst = bool(options['incluir_sst'])

        if dias_comerciales < 1 or dias_inactivas < 1:
            raise CommandError("Los plazos de retención deben ser mayores a 0 días.")
        if dias_sst < MIN_RETENCION_SST_DIAS:
            raise CommandError(
                f"Infracción legal SST / Art. 7 Ley 21.719: el plazo de retención SST no puede ser inferior a {MIN_RETENCION_SST_DIAS} días (5 años)."
            )

        ahora = timezone.now()
        corte_comercial = ahora - timedelta(days=dias_comerciales)
        corte_cuentas = ahora - timedelta(days=dias_inactivas)
        corte_sst = ahora - timedelta(days=dias_sst)

        # Identificadores protegidos por bloqueo temporal ARCO activo (Art. 11 Ley 21.719)
        bloqueos_activos = SolicitudDerechoARCO.objects.filter(
            bloqueo_provisional_activo=True,
            estado__in=[SolicitudDerechoARCO.ESTADO_PENDIENTE, SolicitudDerechoARCO.ESTADO_EN_TRAMITE],
        )
        emails_bloqueados = {(b.email_titular or '').strip().lower() for b in bloqueos_activos if b.email_titular}
        ruts_bloqueados = {_normalizar_rut(b.rut_titular) for b in bloqueos_activos if b.rut_titular}
        hmacs_bloqueados = {calcular_rut_hmac(r) for r in ruts_bloqueados if r}
        hmacs_bloqueados.discard('')

        # 1. Mensajes de contacto > 12 meses
        contactos_candidatos = MensajeContacto.objects.filter(fecha_creacion__lt=corte_comercial)
        contactos_purgables = [
            m.id for m in contactos_candidatos
            if (m.email or '').strip().lower() not in emails_bloqueados
        ]

        # 2. Cotizaciones de capacitación no concretadas > 12 meses
        estados_no_concretados = [
            SolicitudCapacitacion.ESTADO_PENDIENTE,
            SolicitudCapacitacion.ESTADO_CONTACTADO,
            SolicitudCapacitacion.ESTADO_COTIZADO,
            SolicitudCapacitacion.ESTADO_CANCELADO,
        ]
        cotizaciones_candidatas = SolicitudCapacitacion.objects.filter(
            fecha_creacion__lt=corte_comercial,
            estado__in=estados_no_concretados,
        )
        cotizaciones_purgables = [
            s.id for s in cotizaciones_candidatas
            if (s.contacto_email or '').strip().lower() not in emails_bloqueados
            and _normalizar_rut(s.rut_empresa) not in ruts_bloqueados
        ]

        # 3. Cuentas desactivadas > 90 días sin suscripción activa ni registros SST propios
        cuentas_candidatas = Usuario.objects.filter(
            is_active=False,
            is_staff=False,
            is_superuser=False,
            date_joined__lt=corte_cuentas,
        ).exclude(username__startswith='anon_user_')
        cuentas_anonimizables = []
        for u in cuentas_candidatas:
            if (u.email or '').strip().lower() in emails_bloqueados:
                continue
            if u.last_login and u.last_login >= corte_cuentas:
                continue
            tiene_dependencias_sst = (
                Empresa.objects.filter(prevencionista=u).exists()
                or InvestigacionAccidente.objects.filter(usuario=u).exists()
                or Contratista.objects.filter(usuario=u).exists()
                or RegistroCapacitacion.objects.filter(usuario=u).exists()
                or EntregaEPP.objects.filter(responsable_entrega=u).exists()
                or Suscripcion.objects.filter(usuario=u, estado=Suscripcion.ESTADO_ACTIVA).exists()
            )
            if not tiene_dependencias_sst:
                cuentas_anonimizables.append(u)

        # 4. Trabajadores, accidentes, denuncias Ley Karin finalizadas y nóminas de capacitación > 5 años SST
        trabajadores_anonimizables = []
        accidentes_anonimizables = []
        denuncias_karin_anonimizables = []
        capacitaciones_anonimizables = []

        if incluir_sst:
            trab_candidatos = Trabajador.objects.filter(
                estado=Trabajador.ESTADO_DESVINCULADO,
                fecha_creacion__lt=corte_sst,
            ).exclude(nombres='Titular Anonimizado')
            for t in trab_candidatos:
                if _normalizar_rut(t.rut) in ruts_bloqueados:
                    continue
                if (t.correo or '').strip().lower() in emails_bloqueados:
                    continue
                tiene_recientes = (
                    t.accidentes_sufridos.filter(fecha_hora_evento__gte=corte_sst).exists()
                    or t.entregas_epp.filter(fecha_hora_entrega__gte=corte_sst).exists()
                )
                if not tiene_recientes:
                    trabajadores_anonimizables.append(t)

            acc_candidatos = InvestigacionAccidente.objects.filter(
                fecha_hora_evento__lt=corte_sst,
            )
            for acc in acc_candidatos:
                rut_norm_acc = _normalizar_rut(acc.rut_afectado)
                if not rut_norm_acc or rut_norm_acc.startswith('ANON'):
                    continue
                if rut_norm_acc in ruts_bloqueados or (acc.rut_hmac and acc.rut_hmac in hmacs_bloqueados):
                    continue
                accidentes_anonimizables.append(acc)

            karin_candidatos = DenunciaLeyKarin.objects.filter(
                fecha_hora_ingreso__lt=corte_sst,
                estado_tramite__in=[
                    DenunciaLeyKarin.ESTADO_DERIVADA_DT,
                    DenunciaLeyKarin.ESTADO_FINALIZADA,
                ],
            )
            for dk in karin_candidatos:
                rut_norm_dk = _normalizar_rut(dk.rut_denunciante)
                if not rut_norm_dk or rut_norm_dk.startswith('ANON'):
                    continue
                if (
                    rut_norm_dk in ruts_bloqueados
                    or (dk.rut_hmac and dk.rut_hmac in hmacs_bloqueados)
                    or (dk.correo_denunciante or '').strip().lower() in emails_bloqueados
                ):
                    continue
                denuncias_karin_anonimizables.append(dk)

            cap_candidatos = RegistroCapacitacion.objects.filter(
                Q(fecha_realizacion__lt=corte_sst)
                | Q(fecha_realizacion__isnull=True, fecha_creacion__lt=corte_sst)
            )
            for cap in cap_candidatos:
                if not isinstance(cap.asistentes, list) or not cap.asistentes:
                    continue
                requiere_cambio = False
                for a in cap.asistentes:
                    if not isinstance(a, dict):
                        continue
                    rut_a = _normalizar_rut(str(a.get('rut', '')))
                    if rut_a and not rut_a.startswith('ANON') and rut_a not in ruts_bloqueados:
                        requiere_cambio = True
                        break
                if requiere_cambio:
                    capacitaciones_anonimizables.append(cap)

        if not dry_run:
            with transaction.atomic():
                if contactos_purgables:
                    MensajeContacto.objects.filter(id__in=contactos_purgables).delete()
                if cotizaciones_purgables:
                    SolicitudCapacitacion.objects.filter(id__in=cotizaciones_purgables).delete()
                for u in cuentas_anonimizables:
                    u.username = f"anon_user_{u.id}"
                    u.email = f"anon_{u.id}@anonimizado.invalid"
                    u.first_name = ""
                    u.last_name = ""
                    u.mfa_enabled = False
                    u.mfa_secret = ""
                    u.mfa_secret_pendiente = ""
                    u.mfa_backup_codes_hashes = []
                    u.save()
                for t in trabajadores_anonimizables:
                    t.rut = f"ANON-{t.id}"
                    t.nombres = "Titular Anonimizado"
                    t.apellidos = ""
                    t.correo = ""
                    t.telefono = ""
                    t.save(update_fields=['rut', 'nombres', 'apellidos', 'correo', 'telefono'])
                for acc in accidentes_anonimizables:
                    acc.nombre_afectado = "Titular Anonimizado"
                    acc.rut_afectado = f"ANON-{acc.id}"
                    acc.rut_hmac = ""
                    acc.save(update_fields=['nombre_afectado', 'rut_afectado', 'rut_hmac'])
                for dk in denuncias_karin_anonimizables:
                    dk.rut_denunciante = f"ANON-{dk.id}"
                    dk.rut_hmac = ""
                    dk.nombre_denunciante = "Denunciante Anonimizado"
                    dk.correo_denunciante = f"anon-{dk.id}@suprimido.invalid"
                    dk.telefono_denunciante = ""
                    dk.save(update_fields=[
                        'rut_denunciante', 'rut_hmac', 'nombre_denunciante',
                        'correo_denunciante', 'telefono_denunciante',
                    ])
                for cap in capacitaciones_anonimizables:
                    nuevos = []
                    for idx, a in enumerate(cap.asistentes, start=1):
                        if not isinstance(a, dict):
                            nuevos.append(a)
                            continue
                        rut_a = _normalizar_rut(str(a.get('rut', '')))
                        if rut_a and not rut_a.startswith('ANON') and rut_a not in ruts_bloqueados:
                            copia = dict(a)
                            copia['nombre'] = "Asistente Anonimizado"
                            copia['rut'] = f"ANON-{cap.id}-{idx}"
                            nuevos.append(copia)
                        else:
                            nuevos.append(a)
                    cap.asistentes = nuevos
                    cap.save(update_fields=['asistentes'])

        resumen = (
            f"{'[DRY-RUN] ' if dry_run else ''}"
            f"contactos={len(contactos_purgables)}, "
            f"cotizaciones={len(cotizaciones_purgables)}, "
            f"cuentas_anonimizadas={len(cuentas_anonimizables)}, "
            f"trabajadores_anonimizados={len(trabajadores_anonimizables)}, "
            f"accidentes_anonimizados={len(accidentes_anonimizables)}, "
            f"denuncias_karin_anonimizadas={len(denuncias_karin_anonimizables)}, "
            f"capacitaciones_anonimizadas={len(capacitaciones_anonimizables)}"
        )
        self.stdout.write(self.style.SUCCESS(f"Purga de retención completada: {resumen}"))
