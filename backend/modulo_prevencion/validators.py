"""
Validadores criptográficos de contraseñas para cumplimiento Ley N° 21.719 / NIST SP 800-63B.
Implementa verificación Have I Been Pwned (HIBP) mediante k-anonymity SHA-1 sin exponer la clave.
"""
import hashlib
import logging
import urllib.error
import urllib.request

from django.conf import settings
from django.core.exceptions import ValidationError

logger = logging.getLogger('hdprevencion.security')


class HIBPPasswordValidator:
    """
    Comprueba mediante k-anonymity (primeros 5 hex del hash SHA-1) si la contraseña
    figura en brechas públicas conocidas de Have I Been Pwned (P2 / sec-passwords).
    Solo se ejecuta cuando settings.HIBP_CHECK_ENABLED es True.
    """

    api_url = "https://api.pwnedpasswords.com/range/{prefix}"
    timeout_seconds = 2.0

    def validate(self, password, user=None):
        if not getattr(settings, 'HIBP_CHECK_ENABLED', False):
            return

        sha1_hex = hashlib.sha1((password or '').encode('utf-8')).hexdigest().upper()
        prefix, suffix = sha1_hex[:5], sha1_hex[5:]

        req = urllib.request.Request(
            self.api_url.format(prefix=prefix),
            headers={"User-Agent": "HDPrevencion-SecurityCheck/1.0"},
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout_seconds) as resp:
                body = resp.read().decode('utf-8', errors='ignore')
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            logger.warning("HIBP k-anonymity lookup omitido por error de red/timeout: %s", exc)
            return

        for line in body.splitlines():
            parts = line.strip().split(':')
            if len(parts) == 2 and parts[0].upper() == suffix:
                raise ValidationError(
                    "Esta contraseña ha aparecido en filtraciones de datos públicas conocidas. Por seguridad, elige una contraseña diferente.",
                    code='password_pwned',
                )

    def get_help_text(self):
        return "Tu contraseña no debe figurar en bases de filtraciones públicas conocidas (HIBP k-anonymity)."
