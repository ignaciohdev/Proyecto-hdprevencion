from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView, CustomTokenObtainPairView,
    PlantillaMaestraViewSet, DocumentoUsuarioViewSet,
    NoticiaViewSet, MensajeContactoViewSet, ServicioViewSet,
    UsuarioViewSet, PlanViewSet,
    ReporteRiesgoViewSet, PlantillaInspeccionViewSet, InspeccionViewSet,
    InvestigacionAccidenteViewSet, DashboardStatsView,
    TemaCapacitacionViewSet, RegistroCapacitacionViewSet,
    SugerenciaConsultaViewSet,
    ReporteRiesgoPublicoCreateView, SugerenciaConsultaPublicaCreateView,
    ContratistaViewSet, DocumentoContratistaViewSet, TrabajadorSubcontratadoViewSet
)

router = DefaultRouter()
router.register(r'plantillas-maestras', PlantillaMaestraViewSet, basename='plantillamaestra')
router.register(r'documentos-usuario', DocumentoUsuarioViewSet, basename='documentousuario')
router.register(r'noticias', NoticiaViewSet, basename='noticia')
router.register(r'contacto', MensajeContactoViewSet, basename='mensajecontacto')
router.register(r'servicios', ServicioViewSet, basename='servicio')
router.register(r'usuarios', UsuarioViewSet, basename='usuario')
router.register(r'planes', PlanViewSet, basename='plan')
router.register(r'reportes-riesgo', ReporteRiesgoViewSet, basename='reporteriesgo')
router.register(r'plantillas-inspeccion', PlantillaInspeccionViewSet, basename='plantillainspeccion')
router.register(r'inspecciones', InspeccionViewSet, basename='inspeccion')
router.register(r'accidentes', InvestigacionAccidenteViewSet, basename='investigacionaccidente')
router.register(r'temas-capacitacion', TemaCapacitacionViewSet, basename='temacapacitacion')
router.register(r'registro-capacitacion', RegistroCapacitacionViewSet, basename='registrocapacitacion')
router.register(r'buzon', SugerenciaConsultaViewSet, basename='sugerenciaconsulta')
router.register(r'contratistas', ContratistaViewSet, basename='contratista')
router.register(r'documentos-contratista', DocumentoContratistaViewSet, basename='documentocontratista')
router.register(r'trabajadores-subcontratados', TrabajadorSubcontratadoViewSet, basename='trabajadorsubcontratado')

urlpatterns = [
    # Endpoints de autenticación y registro con JWT
    path('auth/register/', RegisterView.as_view(), name='auth_register'),
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Endpoint de estadísticas del dashboard
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard_stats'),

    # Endpoints públicos del portal de participación (acceso via código QR, sin login)
    path(
        'publico/<int:prevencionista_pk>/reportar-riesgo/',
        ReporteRiesgoPublicoCreateView.as_view(),
        name='reportar_riesgo_publico'
    ),
    path(
        'publico/<int:prevencionista_pk>/buzon/',
        SugerenciaConsultaPublicaCreateView.as_view(),
        name='buzon_publico'
    ),

    # Endpoints de la API generados por el router
    path('', include(router.urls)),
]

