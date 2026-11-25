"""
Trazabilidad transversal append-only y emisión estructurada de eventos críticos de seguridad
(P2 / sec-logs, sec-monitoring — Art. 14 y 14 quinquies Ley N° 21.719).
"""
import logging
from typing import Any, Optional

security_logger = logging.getLogger('hdprevencion.security')


def registrar_evento_seguridad(
    request: Any,
    *,
    categoria: str,
    accion: str,
    usuario: Any = None,
    actor_identificador: str = "",
    modelo_afectado: str = "",
    recurso_id: Any = "",
    exito: bool = True,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    """
    Persiste un registro inmutable en AuditLogEventoSeguridad y emite log estructurado
    sin incluir secretos, tokens ni PII sensible innecesaria.
    """
    from .models import AuditLogEventoSeguridad
    from .views import get_client_ip

    ip = get_client_ip(request) if request is not None else None
    ua = ""
    if request is not None and hasattr(request, 'META'):
        ua = str(request.META.get('HTTP_USER_AGENT', ''))[:300]

    auth_user = usuario if usuario and getattr(usuario, 'is_authenticated', False) else None
    actor = actor_identificador or (getattr(auth_user, 'username', '') if auth_user else '') or 'anonimo'

    try:
        AuditLogEventoSeguridad.objects.create(
            usuario=auth_user,
            actor_identificador=str(actor)[:150],
            categoria=categoria,
            accion=accion,
            modelo_afectado=str(modelo_afectado or '')[:80],
            recurso_id=str(recurso_id or '')[:64],
            exito=bool(exito),
            ip_origen=ip,
            user_agent=ua,
            metadata=metadata or {},
        )
    except Exception as exc:  # No tumbar la operación principal si fallara el logging secundario
        security_logger.error("Error persistiendo AuditLogEventoSeguridad (%s/%s): %s", categoria, accion, exc)

    nivel = logging.INFO if exito else logging.WARNING
    if accion == 'EXPORT_PORTABILIDAD':
        nivel = logging.WARNING if not exito else logging.INFO
    security_logger.log(
        nivel,
        "security_event categoria=%s accion=%s exito=%s actor=%s modelo=%s recurso=%s ip=%s",
        categoria,
        accion,
        exito,
        actor,
        modelo_afectado or '-',
        recurso_id or '-',
        ip or '-',
    )
