"""
Módulo criptográfico para protección y cifrado de datos sensibles en reposo.
Conforme a la Ley N° 21.719 (Arts. 14 quinquies, 16 y 16 bis sobre datos sensibles y de salud).
Utiliza MultiFernet (AES-128-CBC + HMAC-SHA256) con clave independiente `FIELD_ENCRYPTION_KEY`,
soporte de rotación mediante `FIELD_ENCRYPTION_OLD_KEYS`, y compatibilidad de lectura heredada.
"""

import base64
import hashlib
import logging
from django.conf import settings
from django.db import models
from cryptography.fernet import Fernet, InvalidToken, MultiFernet

logger = logging.getLogger(__name__)


def _normalize_fernet_key(raw_key: str | bytes) -> bytes:
    """Convierte una llave Fernet base64 válida o secreto arbitrario a clave Fernet de 32 bytes."""
    key_bytes = raw_key.encode('utf-8') if isinstance(raw_key, str) else raw_key
    try:
        Fernet(key_bytes)
        return key_bytes
    except Exception:
        digest = hashlib.sha256(key_bytes).digest()
        return base64.urlsafe_b64encode(digest)


def _legacy_secret_fernet() -> Fernet:
    """Llave heredada derivada de SECRET_KEY solo para migración/lectura de datos históricos."""
    digest = hashlib.sha256(settings.SECRET_KEY.encode('utf-8')).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def _get_cipher() -> MultiFernet:
    primary = getattr(settings, 'FIELD_ENCRYPTION_KEY', None)
    old_keys = getattr(settings, 'FIELD_ENCRYPTION_OLD_KEYS', []) or []

    fernets: list[Fernet] = []
    if primary:
        # Cifra siempre con FIELD_ENCRYPTION_KEY independiente de SECRET_KEY
        fernets.append(Fernet(_normalize_fernet_key(primary)))
        for old_k in old_keys:
            fernets.append(Fernet(_normalize_fernet_key(old_k)))
        # Respaldo de solo lectura para registros cifrados antes del desacoplamiento
        fernets.append(_legacy_secret_fernet())
    else:
        logger.warning(
            "[SEGURIDAD] FIELD_ENCRYPTION_KEY no está configurada; usando derivación temporal "
            "desde SECRET_KEY. Configure FIELD_ENCRYPTION_KEY independiente antes de producción."
        )
        fernets.append(_legacy_secret_fernet())
        for old_k in old_keys:
            fernets.append(Fernet(_normalize_fernet_key(old_k)))

    return MultiFernet(fernets)


def cifrar_texto(texto: str) -> str:
    """Cifra una cadena de texto en claro y le antepone el prefijo `enc:v1:`."""
    if not texto:
        return texto
    if str(texto).startswith("enc:v1:"):
        return str(texto)
    cipher = _get_cipher()
    token = cipher.encrypt(str(texto).encode('utf-8')).decode('utf-8')
    return f"enc:v1:{token}"


def descifrar_texto(valor: str) -> str:
    """Descifra una cadena si tiene prefijo `enc:v1:`, registrando advertencia si falla la llave."""
    if not valor or not str(valor).startswith("enc:v1:"):
        return valor
    cipher = _get_cipher()
    raw = str(valor)[7:]
    try:
        return cipher.decrypt(raw.encode('utf-8')).decode('utf-8')
    except InvalidToken:
        logger.warning(
            "[SEGURIDAD] InvalidToken al descifrar campo `enc:v1:`: verifique FIELD_ENCRYPTION_KEY "
            "o incluya la llave previa en FIELD_ENCRYPTION_OLD_KEYS."
        )
        return valor
    except Exception as exc:
        logger.warning("[SEGURIDAD] Error inesperado al descifrar campo `enc:v1:`: %s", type(exc).__name__)
        return valor


def rotar_texto_cifrado(valor: str) -> str:
    """Re-cifra un token `enc:v1:` existente con la clave primaria vigente (MultiFernet)."""
    if not valor or not str(valor).startswith("enc:v1:"):
        return cifrar_texto(valor)
    cipher = _get_cipher()
    raw = str(valor)[7:]
    rotated = cipher.rotate(raw.encode('utf-8')).decode('utf-8')
    return f"enc:v1:{rotated}"


class EncryptedTextField(models.TextField):
    """
    Campo de texto con cifrado simétrico en reposo transparente.
    Cifra al persistir en base de datos y descifra al recuperar el registro.
    """
    description = "Campo de texto cifrado en reposo para datos sensibles (Ley 21.719)"

    def from_db_value(self, value, expression, connection):
        if value is None:
            return value
        return descifrar_texto(value)

    def to_python(self, value):
        if value is None:
            return value
        return descifrar_texto(value)

    def get_prep_value(self, value):
        val = super().get_prep_value(value)
        if val is None or val == '':
            return val
        return cifrar_texto(val)
