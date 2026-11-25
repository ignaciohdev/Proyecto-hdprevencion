"""
Utilidades de Autenticación Multifactor (MFA) TOTP según RFC 6238 / RFC 4226
y códigos de respaldo de un solo uso para cumplimiento Ley N° 21.719 (sec-mfa).
"""
import base64
import hashlib
import hmac
import re
import secrets
import struct
import time
from typing import Optional
from urllib.parse import quote

from django.contrib.auth.hashers import check_password, make_password
from django.core import signing

TOTP_PERIOD_SECONDS = 30
TOTP_DIGITS = 6
TOTP_ALLOWED_SKEW = 1
MFA_CHALLENGE_SALT = 'hdprevencion.mfa.login.challenge'
MFA_CHALLENGE_MAX_AGE_SECONDS = 300  # 5 minutos

_BACKUP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  # Sin 0/O/1/I ambiguos


def generar_secreto_totp(num_bytes: int = 20) -> str:
    """Genera un secreto aleatorio Base32 sin padding para TOTP."""
    raw = secrets.token_bytes(num_bytes)
    return base64.b32encode(raw).decode('ascii').rstrip('=')


def _decodificar_base32(secret_b32: str) -> bytes:
    cleaned = re.sub(r'\s+', '', (secret_b32 or '')).upper()
    if not cleaned:
        raise ValueError("Secreto TOTP vacío.")
    pad_len = (-len(cleaned)) % 8
    return base64.b32decode(cleaned + ('=' * pad_len), casefold=True)


def generar_uri_totp(secret_b32: str, account_name: str, issuer: str = "HD Prevencion") -> str:
    """Construye la URI otpauth:// estándar compatible con apps autenticadoras."""
    label = quote(f"{issuer}:{account_name}", safe=":")
    issuer_q = quote(issuer)
    return (
        f"otpauth://totp/{label}"
        f"?secret={secret_b32}&issuer={issuer_q}&algorithm=SHA1&digits={TOTP_DIGITS}&period={TOTP_PERIOD_SECONDS}"
    )


def calcular_totp(secret_b32: str, step_counter: int) -> str:
    """Calcula el código HOTP/TOTP de 6 dígitos para un contador de ventana."""
    key = _decodificar_base32(secret_b32)
    msg = struct.pack('>Q', step_counter)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code_int = struct.unpack('>I', digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return str(code_int % (10 ** TOTP_DIGITS)).zfill(TOTP_DIGITS)


def verificar_codigo_totp(
    secret_b32: str,
    code: str,
    last_used_step: Optional[int] = None,
    skew: int = TOTP_ALLOWED_SKEW,
    now_ts: Optional[float] = None,
) -> Optional[int]:
    """
    Valida un código TOTP de 6 dígitos con tolerancia de reloj (±skew ventanas).
    Bloquea reutilización (replay) comprobando `step > last_used_step`.
    Retorna el entero `step` coincidente si es válido, o None si falla.
    """
    if not secret_b32 or not isinstance(code, str):
        return None
    cleaned_code = re.sub(r'\s+', '', code)
    if not re.fullmatch(r'\d{6}', cleaned_code):
        return None

    ts = time.time() if now_ts is None else now_ts
    current_step = int(ts // TOTP_PERIOD_SECONDS)

    for offset in range(-skew, skew + 1):
        step = current_step + offset
        if step < 0:
            continue
        if last_used_step is not None and step <= last_used_step:
            continue
        try:
            expected = calcular_totp(secret_b32, step)
        except ValueError:
            return None
        if hmac.compare_digest(expected, cleaned_code):
            return step
    return None


def generar_codigos_respaldo(cantidad: int = 8) -> tuple[list[str], list[str]]:
    """
    Genera códigos de respaldo legibles (XXXX-XXXX) y sus hashes PBKDF2.
    El texto plano se entrega por única vez al titular.
    """
    plaintext: list[str] = []
    hashed: list[str] = []
    for _ in range(cantidad):
        raw = ''.join(secrets.choice(_BACKUP_ALPHABET) for _ in range(8))
        formatted = f"{raw[:4]}-{raw[4:]}"
        plaintext.append(formatted)
        hashed.append(make_password(raw))
    return plaintext, hashed


def consumir_codigo_respaldo(usuario, raw_code: str) -> bool:
    """
    Verifica si `raw_code` coincide con algún código de respaldo del usuario.
    Si coincide, lo consume (elimina el hash de un solo uso) y retorna True.
    """
    if not raw_code or not isinstance(raw_code, str):
        return False
    normalized = re.sub(r'[^A-Za-z0-9]', '', raw_code).upper()
    if len(normalized) != 8:
        return False

    hashes = list(getattr(usuario, 'mfa_backup_codes_hashes', None) or [])
    for idx, stored_hash in enumerate(hashes):
        if check_password(normalized, stored_hash):
            del hashes[idx]
            usuario.mfa_backup_codes_hashes = hashes
            usuario.save(update_fields=['mfa_backup_codes_hashes'])
            return True
    return False


def verificar_segundo_factor_usuario(usuario, raw_code: str) -> bool:
    """Valida código TOTP (con bloqueo anti-replay) o consume código de respaldo de un solo uso."""
    code = (raw_code or '').strip()
    if not code or not getattr(usuario, 'mfa_enabled', False):
        return False
    secret = getattr(usuario, 'mfa_secret', '')
    if secret:
        step = verificar_codigo_totp(secret, code, last_used_step=getattr(usuario, 'mfa_last_used_step', None))
        if step is not None:
            usuario.mfa_last_used_step = step
            usuario.save(update_fields=['mfa_last_used_step'])
            return True
    return consumir_codigo_respaldo(usuario, code)


def crear_challenge_mfa(user_id: int) -> str:
    """Firma un token temporal (5 min) que identifica al usuario pendiente de 2do factor."""
    signer = signing.TimestampSigner(salt=MFA_CHALLENGE_SALT)
    return signer.sign_object({'uid': int(user_id), 'nonce': secrets.token_hex(8)})


def verificar_challenge_mfa(token: str, max_age: int = MFA_CHALLENGE_MAX_AGE_SECONDS) -> Optional[int]:
    """Verifica firma y vigencia del token de desafío MFA y retorna el user_id o None."""
    if not token or not isinstance(token, str):
        return None
    signer = signing.TimestampSigner(salt=MFA_CHALLENGE_SALT)
    try:
        payload = signer.unsign_object(token, max_age=max_age)
        uid = payload.get('uid') if isinstance(payload, dict) else None
        return int(uid) if uid is not None else None
    except (signing.BadSignature, signing.SignatureExpired, ValueError, TypeError):
        return None
