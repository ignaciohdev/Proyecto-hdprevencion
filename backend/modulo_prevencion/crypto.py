"""
Módulo criptográfico para protección y cifrado de datos sensibles en reposo.
Conforme a la Ley N° 21.719 (Arts. 14 quinquies, 16 y 16 bis sobre datos sensibles y de salud).
Utiliza Fernet (AES-128-CBC + HMAC-SHA256) con prefijo de versionado `enc:v1:` y compatibilidad hacia atrás.
"""

import base64
import hashlib
from django.conf import settings
from django.db import models
from cryptography.fernet import Fernet, InvalidToken


def _get_fernet() -> Fernet:
    key = getattr(settings, 'FIELD_ENCRYPTION_KEY', None)
    if not key:
        # Si no existe una clave de campo separada, derivar una clave criptográfica de 32 bytes de SECRET_KEY
        secret_bytes = settings.SECRET_KEY.encode('utf-8')
        digest = hashlib.sha256(secret_bytes).digest()
        key = base64.urlsafe_b64encode(digest)
    elif isinstance(key, str):
        key = key.encode('utf-8')
    return Fernet(key)


def cifrar_texto(texto: str) -> str:
    """Cifra una cadena de texto en claro y le antepone el prefijo `enc:v1:`."""
    if not texto:
        return texto
    if str(texto).startswith("enc:v1:"):
        return str(texto)
    f = _get_fernet()
    token = f.encrypt(str(texto).encode('utf-8')).decode('utf-8')
    return f"enc:v1:{token}"


def descifrar_texto(valor: str) -> str:
    """Descifra una cadena si tiene prefijo `enc:v1:`, de lo contrario retorna el valor tal cual (compatibilidad)."""
    if not valor or not str(valor).startswith("enc:v1:"):
        return valor
    f = _get_fernet()
    raw = str(valor)[7:]
    try:
        return f.decrypt(raw.encode('utf-8')).decode('utf-8')
    except (InvalidToken, Exception):
        return valor


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
