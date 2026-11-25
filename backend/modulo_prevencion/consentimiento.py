"""
Utilidades para registro probatorio append-only del consentimiento (Carga de la prueba - Art. 12 Ley N° 21.719).
"""
import hashlib
from typing import Any, Iterable, Optional

VERSION_POLITICA_ACTUAL = "1.0"


def calcular_hash_texto(texto: str) -> str:
    """Genera el digest SHA-256 del texto informado o aceptado por el titular."""
    return hashlib.sha256((texto or "").strip().encode("utf-8")).hexdigest()


def registrar_consentimiento(
    request: Any,
    *,
    flujo: str,
    identificador_titular: str,
    otorgado: bool = True,
    usuario: Any = None,
    categorias: Optional[Iterable[str]] = None,
    texto_aceptado: str = "",
    version_politica: str = VERSION_POLITICA_ACTUAL,
):
    """
    Crea una nueva fila append-only en RegistroConsentimiento para acreditar
    otorgamiento o revocación de consentimiento sin sobrescribir historial previo.
    """
    from .models import RegistroConsentimiento
    from .views import get_client_ip

    ip = get_client_ip(request) if request is not None else None
    ua = ""
    if request is not None and hasattr(request, "META"):
        ua = str(request.META.get("HTTP_USER_AGENT", ""))[:300]

    texto_base = texto_aceptado or f"Politica de Privacidad HD Prevencion v{version_politica} ({flujo})"
    return RegistroConsentimiento.objects.create(
        usuario=usuario if usuario and getattr(usuario, "is_authenticated", False) else None,
        identificador_titular=(identificador_titular or "")[:255],
        flujo=flujo,
        version_politica=version_politica,
        hash_politica=calcular_hash_texto(texto_base),
        otorgado=bool(otorgado),
        categorias=list(categorias or []),
        ip_origen=ip,
        user_agent=ua,
    )
