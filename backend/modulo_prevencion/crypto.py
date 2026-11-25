"""
Módulo criptográfico para protección y cifrado de datos sensibles en reposo,
blind index determinístico HMAC-SHA256 y soporte de estructuras JSON cifradas.
Conforme a la Ley N° 21.719 (Arts. 14 quinquies, 16 y 16 bis sobre datos sensibles y de salud).
"""

import base64
import hashlib
import hmac
import json
import logging
from django import forms
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
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
        fernets.append(Fernet(_normalize_fernet_key(primary)))
        for old_k in old_keys:
            fernets.append(Fernet(_normalize_fernet_key(old_k)))
        # Respaldo de solo lectura para registros cifrados antes del desacoplamiento
        fernets.append(_legacy_secret_fernet())
    else:
        if not getattr(settings, 'DEBUG', False):
            raise ImproperlyConfigured(
                "FIELD_ENCRYPTION_KEY es obligatoria cuando DEBUG=False (prohibido fallback silencioso a SECRET_KEY)."
            )
        logger.warning(
            "[SEGURIDAD] Modo DEBUG: FIELD_ENCRYPTION_KEY no configurada; usando derivación temporal "
            "desde SECRET_KEY. Configure FIELD_ENCRYPTION_KEY antes de pasar a producción."
        )
        fernets.append(_legacy_secret_fernet())
        for old_k in old_keys:
            fernets.append(Fernet(_normalize_fernet_key(old_k)))

    return MultiFernet(fernets)


def _get_blind_index_key() -> bytes:
    """
    Obtiene la clave dedicada para blind index HMAC-SHA256.
    Prioriza BLIND_INDEX_KEY explícita; si no está configurada en entornos previos,
    deriva una subclave con separación de dominio desde FIELD_ENCRYPTION_KEY (o SECRET_KEY solo en DEBUG).
    """
    dedicated = getattr(settings, 'BLIND_INDEX_KEY', None)
    if dedicated:
        raw = dedicated.encode('utf-8') if isinstance(dedicated, str) else bytes(dedicated)
        return hashlib.sha256(b'hdprevencion:blind_index:dedicated:' + raw).digest()

    primary = getattr(settings, 'FIELD_ENCRYPTION_KEY', None)
    if primary:
        raw_p = primary.encode('utf-8') if isinstance(primary, str) else bytes(primary)
        return hmac.new(raw_p, b'hdprevencion:blind_index:subkey:v1', hashlib.sha256).digest()

    if not getattr(settings, 'DEBUG', False):
        raise ImproperlyConfigured(
            "Se requiere BLIND_INDEX_KEY o FIELD_ENCRYPTION_KEY cuando DEBUG=False."
        )
    return hmac.new(
        settings.SECRET_KEY.encode('utf-8'),
        b'hdprevencion:blind_index:debug_fallback:v1',
        hashlib.sha256,
    ).digest()


def normalizar_rut_blind_index(rut: str) -> str:
    """Normaliza RUT chileno eliminando puntos, guiones y espacios en mayúsculas."""
    return (rut or '').upper().replace('.', '').replace('-', '').replace(' ', '').strip()


def calcular_rut_hmac(rut: str) -> str:
    """
    Calcula blind index HMAC-SHA256 (hex 64 chars) para búsqueda indexada de RUTs cifrados.
    Retorna '' para valores vacíos o ya anonimizados (`ANON-*`).
    """
    norm = normalizar_rut_blind_index(rut)
    if not norm or norm.startswith('ANON'):
        return ''
    key = _get_blind_index_key()
    return hmac.new(key, norm.encode('utf-8'), hashlib.sha256).hexdigest()


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


class EncryptedJSONField(models.TextField):
    """
    Campo JSON cifrado en reposo con MultiFernet (`enc:v1:...`).
    Compatible transparentemente con dicts/lists en Python, DRF y valores JSON legados en texto plano.
    """
    description = "Campo JSON cifrado en reposo para datos sensibles y clínicos SST (Ley 21.719)"

    def _empty_default(self):
        default = self.default
        if callable(default):
            return default()
        if isinstance(default, (dict, list)):
            return default.copy()
        return {}

    def _decode_value(self, value):
        if value is None:
            return None if self.null else self._empty_default()
        if isinstance(value, (dict, list)):
            return value
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return self._empty_default()
            if stripped.startswith("enc:v1:"):
                decrypted = descifrar_texto(stripped)
                if decrypted.startswith("enc:v1:"):
                    return self._empty_default()
                stripped = decrypted
            try:
                return json.loads(stripped)
            except (ValueError, TypeError):
                return self._empty_default()
        return value

    def from_db_value(self, value, expression, connection):
        return self._decode_value(value)

    def to_python(self, value):
        return self._decode_value(value)

    def get_prep_value(self, value):
        if value is None:
            if self.null:
                return None
            value = self._empty_default()
        elif isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("enc:v1:"):
                return stripped
            if stripped:
                try:
                    value = json.loads(stripped)
                except (ValueError, TypeError):
                    pass
        serialized = json.dumps(value, ensure_ascii=False)
        return cifrar_texto(serialized)

    def value_to_string(self, obj):
        val = self.value_from_object(obj)
        return json.dumps(val, ensure_ascii=False)

    def formfield(self, **kwargs):
        defaults = {'form_class': forms.JSONField}
        defaults.update(kwargs)
        return super().formfield(**defaults)
