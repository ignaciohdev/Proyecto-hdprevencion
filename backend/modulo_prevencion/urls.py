from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView, CustomTokenObtainPairView,
    PlantillaMaestraViewSet, DocumentoUsuarioViewSet,
    NoticiaViewSet, MensajeContactoViewSet, ServicioViewSet,
    UsuarioViewSet, PlanViewSet
)

router = DefaultRouter()
router.register(r'plantillas-maestras', PlantillaMaestraViewSet, basename='plantillamaestra')
router.register(r'documentos-usuario', DocumentoUsuarioViewSet, basename='documentousuario')
router.register(r'noticias', NoticiaViewSet, basename='noticia')
router.register(r'contacto', MensajeContactoViewSet, basename='mensajecontacto')
router.register(r'servicios', ServicioViewSet, basename='servicio')
router.register(r'usuarios', UsuarioViewSet, basename='usuario')
router.register(r'planes', PlanViewSet, basename='plan')

urlpatterns = [
    # Endpoints de autenticación y registro con JWT
    path('auth/register/', RegisterView.as_view(), name='auth_register'),
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Endpoints de la API generados por el router
    path('', include(router.urls)),
]

