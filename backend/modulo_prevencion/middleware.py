"""
Middleware transversal de bloqueo provisional ARCO-POL (Art. 11 Ley N° 21.719).

Cuando existe una `SolicitudDerechoARCO` activa (`PENDIENTE` o `EN_TRAMITE`) con
`bloqueo_provisional_activo=True`, bloquea con HTTP 423 Locked cualquier operación de
mutación (`POST`, `PUT`, `PATCH`, `DELETE`) sobre recursos operativos que afecten al
titular bloqueado (identificado por correo, RUT o `rut_hmac` del payload, token JWT o
registro objetivo en URL), dejando una traza inmutable en `AuditLogEventoSeguridad`.
"""

import json
import re
from typing import Any

from django.http import JsonResponse

from .auditoria import registrar_evento_seguridad
from .crypto import calcular_rut_hmac, normalizar_rut_blind_index
from .models import (
    AuditLogEventoSeguridad,
    Contratista,
    DenunciaLeyKarin,
    EntregaEPP,
    Inspeccion,
    InvestigacionAccidente,
    MiembroCPHS,
    RegistroCapacitacion,
    ReporteRiesgo,
    SolicitudDerechoARCO,
    SugerenciaConsulta,
    SugerenciaLaboral,
    Trabajador,
    TrabajadorSubcontratado,
    Usuario,
)


METODOS_MUTANTES = {'POST', 'PUT', 'PATCH', 'DELETE'}
PREFIJOS_EXENTOS = (
    '/api/privacidad/',
    '/api/auth/login/',
    '/api/auth/mfa/verify/',
    '/api/auth/token/refresh/',
    '/api/auth/logout/',
    '/api/auth/session/',
    '/api/auth/register/',
)
RE_DETALLE_API = re.compile(r'^/api/([a-z0-9-]+)/([^/]+)/?(?:$|\?)')


def _extraer_usuario_request(request) -> Usuario | None:
    user = getattr(request, 'user', None)
    if user and getattr(user, 'is_authenticated', False):
        return user

    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if not auth_header.startswith('Bearer '):
        return None
    try:
        from rest_framework_simplejwt.authentication import JWTAuthentication
        auth_res = JWTAuthentication().authenticate(request)
        if auth_res:
            return auth_res[0]
    except Exception:
        return None
    return None


def _extraer_identificadores_payload(request) -> tuple[set[str], set[str], int | None]:
    """Retorna (ruts_norm, emails_lower, trabajador_id) desde JSON o form-data."""
    data: dict[str, Any] = {}
    content_type = (request.META.get('CONTENT_TYPE') or '').lower()

    if 'application/json' in content_type:
        try:
            body = request.body
            if body:
                parsed = json.loads(body.decode('utf-8'))
                if isinstance(parsed, dict):
                    data = parsed
        except Exception:
            data = {}
    elif content_type:
        try:
            data = request.POST.dict()
        except Exception:
            data = {}

    if not data:
        return set(), set(), None

    ruts: set[str] = set()
    emails: set[str] = set()
    for campo_rut in ('rut', 'rut_afectado', 'rut_denunciante', 'rut_reportante', 'firma_rut', 'rut_titular'):
        val = str(data.get(campo_rut) or '').strip()
        norm = normalizar_rut_blind_index(val)
        if norm and not norm.startswith('ANON'):
            ruts.add(norm)

    for campo_email in ('email', 'correo', 'correo_denunciante', 'email_contacto', 'contacto_reportante', 'contacto_remitente'):
        val = str(data.get(campo_email) or '').strip().lower()
        if val and '@' in val:
            emails.add(val)

    # Inspección de asistentes si viene lista en payload de RegistroCapacitacion
    asistentes = data.get('asistentes')
    if isinstance(asistentes, list):
        for item in asistentes:
            if isinstance(item, dict):
                norm = normalizar_rut_blind_index(str(item.get('rut') or ''))
                if norm and not norm.startswith('ANON'):
                    ruts.add(norm)

    trabajador_id = None
    raw_trab = data.get('trabajador')
    if isinstance(raw_trab, int) or (isinstance(raw_trab, str) and raw_trab.isdigit()):
        trabajador_id = int(raw_trab)

    return ruts, emails, trabajador_id


def _extraer_identificadores_recurso_url(path: str) -> tuple[set[str], set[str], set[str]]:
    """Retorna (ruts_norm, rut_hmacs, emails_lower) del recurso objetivo en la URL."""
    match = RE_DETALLE_API.match(path or '')
    if not match:
        return set(), set(), set()

    recurso, pk_val = match.group(1), match.group(2)
    ruts: set[str] = set()
    hmacs: set[str] = set()
    emails: set[str] = set()

    def _add_rut(val: str | None) -> None:
        norm = normalizar_rut_blind_index(val or '')
        if norm and not norm.startswith('ANON'):
            ruts.add(norm)

    def _add_email(val: str | None) -> None:
        clean = (val or '').strip().lower()
        if clean:
            emails.add(clean)

    try:
        if recurso == 'trabajadores' and pk_val.isdigit():
            obj = Trabajador.objects.filter(pk=int(pk_val)).first()
            if obj:
                _add_rut(obj.rut)
                _add_email(obj.correo)
        elif recurso == 'accidentes' and pk_val.isdigit():
            obj = InvestigacionAccidente.objects.filter(pk=int(pk_val)).select_related('trabajador').first()
            if obj:
                if obj.rut_hmac:
                    hmacs.add(obj.rut_hmac)
                _add_rut(obj.rut_afectado)
                if obj.trabajador:
                    _add_rut(obj.trabajador.rut)
                    _add_email(obj.trabajador.correo)
        elif recurso == 'entregas-epp' and pk_val.isdigit():
            obj = EntregaEPP.objects.filter(pk=int(pk_val)).select_related('trabajador').first()
            if obj and obj.trabajador:
                _add_rut(obj.trabajador.rut)
                _add_email(obj.trabajador.correo)
        elif recurso == 'registro-capacitacion' and pk_val.isdigit():
            obj = RegistroCapacitacion.objects.filter(pk=int(pk_val)).first()
            if obj and isinstance(obj.asistentes, list):
                for item in obj.asistentes:
                    if isinstance(item, dict):
                        _add_rut(str(item.get('rut') or ''))
        elif recurso == 'reportes-riesgo' and pk_val.isdigit():
            obj = ReporteRiesgo.objects.filter(pk=int(pk_val)).first()
            if obj:
                _add_rut(obj.rut_reportante)
                _add_email(obj.contacto_reportante)
        elif recurso == 'inspecciones' and pk_val.isdigit():
            obj = Inspeccion.objects.filter(pk=int(pk_val)).first()
            if obj:
                _add_rut(obj.firma_rut)
        elif recurso == 'denuncias-ley-karin' and pk_val.isdigit():
            obj = DenunciaLeyKarin.objects.filter(pk=int(pk_val)).first()
            if obj:
                if obj.rut_hmac:
                    hmacs.add(obj.rut_hmac)
                _add_email(obj.correo_denunciante)
        elif recurso == 'miembros-cphs' and pk_val.isdigit():
            obj = MiembroCPHS.objects.filter(pk=int(pk_val)).select_related('trabajador').first()
            if obj:
                _add_rut(obj.rut)
                if obj.trabajador:
                    _add_email(obj.trabajador.correo)
        elif recurso == 'trabajadores-subcontratados' and pk_val.isdigit():
            obj = TrabajadorSubcontratado.objects.filter(pk=int(pk_val)).first()
            if obj:
                _add_rut(obj.rut)
        elif recurso == 'contratistas' and pk_val.isdigit():
            obj = Contratista.objects.filter(pk=int(pk_val)).first()
            if obj:
                _add_rut(obj.rut)
                _add_email(obj.email_contacto)
        elif recurso == 'sugerencias-laborales' and pk_val.isdigit():
            obj = SugerenciaLaboral.objects.filter(pk=int(pk_val)).first()
            if obj and not obj.es_anonimo:
                _add_email(obj.contacto_remitente)
        elif recurso == 'buzon' and pk_val.isdigit():
            obj = SugerenciaConsulta.objects.filter(pk=int(pk_val)).first()
            if obj and not obj.anonimo:
                _add_email(obj.contacto_remitente)
        elif recurso == 'usuarios' and pk_val.isdigit():
            obj = Usuario.objects.filter(pk=int(pk_val)).first()
            if obj:
                _add_email(obj.email)
    except Exception:
        pass

    return ruts, hmacs, emails


class ARCOBloqueoProvisionalMiddleware:
    """
    Impide mutaciones de datos operativos mientras rija un bloqueo provisional ARCO-POL activo
    sobre los datos del titular afectado (Art. 11 Ley N° 21.719).
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path or ''
        if (
            request.method not in METODOS_MUTANTES
            or not path.startswith('/api/')
            or any(path.startswith(prefix) for prefix in PREFIJOS_EXENTOS)
        ):
            return self.get_response(request)

        bloqueos = list(
            SolicitudDerechoARCO.objects.filter(
                bloqueo_provisional_activo=True,
                estado__in=[
                    SolicitudDerechoARCO.ESTADO_PENDIENTE,
                    SolicitudDerechoARCO.ESTADO_EN_TRAMITE,
                ],
            ).values('uuid', 'rut_titular', 'email_titular')
        )
        if not bloqueos:
            return self.get_response(request)

        blocked_ruts: set[str] = set()
        blocked_hmacs: set[str] = set()
        blocked_emails: set[str] = set()
        uuids_por_rut: dict[str, str] = {}
        uuids_por_hmac: dict[str, str] = {}
        uuids_por_email: dict[str, str] = {}

        for blq in bloqueos:
            uid = str(blq['uuid'])
            norm = normalizar_rut_blind_index(blq.get('rut_titular') or '')
            if norm and not norm.startswith('ANON'):
                blocked_ruts.add(norm)
                uuids_por_rut[norm] = uid
                h = calcular_rut_hmac(norm)
                if h:
                    blocked_hmacs.add(h)
                    uuids_por_hmac[h] = uid
            mail = (blq.get('email_titular') or '').strip().lower()
            if mail:
                blocked_emails.add(mail)
                uuids_por_email[mail] = uid

        ruts_req, emails_req, trabajador_id = _extraer_identificadores_payload(request)
        ruts_url, hmacs_url, emails_url = _extraer_identificadores_recurso_url(path)
        ruts_req |= ruts_url
        emails_req |= emails_url

        if trabajador_id is not None:
            trab = Trabajador.objects.filter(pk=trabajador_id).values('rut', 'correo').first()
            if trab:
                norm_t = normalizar_rut_blind_index(trab.get('rut') or '')
                if norm_t and not norm_t.startswith('ANON'):
                    ruts_req.add(norm_t)
                mail_t = (trab.get('correo') or '').strip().lower()
                if mail_t:
                    emails_req.add(mail_t)

        actor = _extraer_usuario_request(request)
        if actor and actor.email:
            # Si el propio titular con bloqueo provisional intenta modificar datos operativos (ej. perfil/reportes)
            # o si coincide email en payload/URL, queda sujeto al bloqueo mientras no sea resolución ARCO.
            emails_req.add(actor.email.strip().lower())

        hmacs_req = {calcular_rut_hmac(r) for r in ruts_req if r} | hmacs_url
        hmacs_req.discard('')

        rut_hits = ruts_req & blocked_ruts
        hmac_hits = hmacs_req & blocked_hmacs
        email_hits = emails_req & blocked_emails

        if rut_hits or hmac_hits or email_hits:
            solicitudes_bloqueantes = sorted({
                *(uuids_por_rut[r] for r in rut_hits),
                *(uuids_por_hmac[h] for h in hmac_hits),
                *(uuids_por_email[e] for e in email_hits),
            })
            registrar_evento_seguridad(
                request,
                categoria=AuditLogEventoSeguridad.CATEGORIA_ARCO,
                accion='ARCO_BLOQUEO_IMPEDIMENTO',
                usuario=actor,
                actor_identificador=(actor.email if actor else '') or next(iter(email_hits | rut_hits), ''),
                modelo_afectado=path.strip('/'),
                recurso_id=','.join(solicitudes_bloqueantes),
                exito=False,
                metadata={
                    'metodo': request.method,
                    'ruta': path,
                    'solicitudes_bloqueantes': solicitudes_bloqueantes,
                },
            )
            return JsonResponse(
                {
                    'detail': (
                        'Operación bloqueada temporalmente por solicitud de bloqueo provisional '
                        'ARCO-POL vigente (Art. 11 Ley N° 21.719).'
                    ),
                    'codigo': 'ARCO_BLOQUEO_PROVISIONAL',
                    'solicitudes_bloqueantes': solicitudes_bloqueantes,
                },
                status=423,
            )

        return self.get_response(request)
