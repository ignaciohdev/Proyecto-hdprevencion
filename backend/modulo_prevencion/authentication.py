from django.conf import settings
from rest_framework import exceptions
from rest_framework_simplejwt.authentication import JWTAuthentication

EXEMPT_MFA_PREFIXES = (
    '/api/auth/',
    '/api/usuarios/perfil/',
    '/api/usuarios/mfa/',
    '/api/privacidad/',
    '/api/publico/',
    '/api/contacto/',
)


class MfaSetupRequired(exceptions.PermissionDenied):
    default_code = 'mfa_setup_required'


class MFAJWTAuthentication(JWTAuthentication):
    """
    Autenticación JWT que, cuando MFA_ENFORCE_PRIVILEGED está activo,
    exige enrolamiento MFA TOTP a usuarios administradores o corporativos
    antes de acceder a módulos operativos sensibles, manteniendo disponibles
    las rutas de autenticación, perfil y configuración MFA.
    """

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None

        user, validated_token = result
        if getattr(settings, 'MFA_ENFORCE_PRIVILEGED', False):
            if getattr(user, 'mfa_obligatorio', False) and not getattr(user, 'mfa_enabled', False):
                path = request.path or ''
                if not any(path.startswith(prefix) for prefix in EXEMPT_MFA_PREFIXES):
                    raise MfaSetupRequired(
                        detail={
                            'code': 'mfa_setup_required',
                            'detail': 'Por política de seguridad Ley 21.719, tu cuenta administrativa o corporativa debe activar MFA TOTP en Mi Perfil antes de acceder a este módulo.',
                        }
                    )
        return user, validated_token
