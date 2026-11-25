from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    RegisterView, CustomTokenObtainPairView, MfaLoginVerifyView, CustomTokenRefreshView, LogoutView,
    PlantillaMaestraViewSet, DocumentoUsuarioViewSet,
    NoticiaViewSet, MensajeContactoViewSet, ServicioViewSet,
    UsuarioViewSet, PlanViewSet,
    ReporteRiesgoViewSet, PlantillaInspeccionViewSet, InspeccionViewSet,
    InvestigacionAccidenteViewSet, DashboardStatsView,
    TemaCapacitacionViewSet, RegistroCapacitacionViewSet,
    SugerenciaConsultaViewSet,
    ReporteRiesgoPublicoCreateView, SugerenciaConsultaPublicaCreateView,
    ContratistaViewSet, DocumentoContratistaViewSet, TrabajadorSubcontratadoViewSet,
    SolicitudCapacitacionViewSet,
    EmpresaViewSet, CentroTrabajoViewSet, TrabajadorViewSet,
    DenunciaLeyKarinViewSet, SugerenciaLaboralViewSet, PublicoEmpresasListView,
    ComiteParitarioViewSet, MiembroCPHSViewSet, ActaSesionCPHSViewSet,
    EntregaEPPViewSet,
    RequisitoLegalBaseViewSet, MatrizLegalViewSet, ItemMatrizLegalViewSet,
    MatrizRiesgoMiperViewSet, ItemMatrizRiesgoViewSet,
    ClimaUvView,
    SolicitudDerechoARCOCreateView, SolicitudDerechoARCOConsultaView, PortabilidadDatosView
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
router.register(r'solicitudes-capacitacion', SolicitudCapacitacionViewSet, basename='solicitudcapacitacion')
router.register(r'buzon', SugerenciaConsultaViewSet, basename='sugerenciaconsulta')
router.register(r'contratistas', ContratistaViewSet, basename='contratista')
router.register(r'documentos-contratista', DocumentoContratistaViewSet, basename='documentocontratista')
router.register(r'trabajadores-subcontratados', TrabajadorSubcontratadoViewSet, basename='trabajadorsubcontratado')
router.register(r'empresas', EmpresaViewSet, basename='empresa')
router.register(r'centros-trabajo', CentroTrabajoViewSet, basename='centrotrabajo')
router.register(r'trabajadores', TrabajadorViewSet, basename='trabajador')
router.register(r'sugerencias-laborales', SugerenciaLaboralViewSet, basename='sugerencialaboral')
router.register(r'denuncias-ley-karin', DenunciaLeyKarinViewSet, basename='denuncialeykarin')
router.register(r'comites-paritarios', ComiteParitarioViewSet, basename='comiteparitario')
router.register(r'miembros-cphs', MiembroCPHSViewSet, basename='miembrocphs')
router.register(r'actas-cphs', ActaSesionCPHSViewSet, basename='actasesioncphs')
router.register(r'entregas-epp', EntregaEPPViewSet, basename='entregaepp')
router.register(r'requisitos-legales-base', RequisitoLegalBaseViewSet, basename='requisitolegalbase')
router.register(r'matrices-legales', MatrizLegalViewSet, basename='matrizlegal')
router.register(r'items-matriz-legal', ItemMatrizLegalViewSet, basename='itemmatrizlegal')
router.register(r'matrices-riesgo-miper', MatrizRiesgoMiperViewSet, basename='matrizriesgomiper')
router.register(r'items-matriz-riesgo', ItemMatrizRiesgoViewSet, basename='itemmatrizriesgo')



urlpatterns = [
    # Endpoints de autenticación y registro con JWT
    path('auth/register/', RegisterView.as_view(), name='auth_register'),
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/mfa/verify/', MfaLoginVerifyView.as_view(), name='auth_mfa_verify'),
    path('auth/token/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('auth/logout/', LogoutView.as_view(), name='auth_logout'),
    
    # Endpoint de estadísticas del dashboard
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard_stats'),

    # Endpoint meteorológico de radiación UV y estrés térmico (D.S. 594 Art. 109 / Enmienda ISO 2024)
    path('clima/radiacion-uv/', ClimaUvView.as_view(), name='clima_radiacion_uv'),

    # Canal de Derechos del Titular ARCO-POL (Ley N° 21.719 Arts. 4 al 11)
    path('privacidad/solicitar-derecho/', SolicitudDerechoARCOCreateView.as_view(), name='privacidad_solicitar_derecho'),
    path('privacidad/consultar-derecho/<uuid:uuid>/', SolicitudDerechoARCOConsultaView.as_view(), name='privacidad_consultar_derecho'),
    path('privacidad/portabilidad/', PortabilidadDatosView.as_view(), name='privacidad_portabilidad'),

    # Endpoints públicos del portal de participación (acceso via código QR, sin login)
    path(
        'publico/<uuid:prevencionista_uuid>/reportar-riesgo/',
        ReporteRiesgoPublicoCreateView.as_view(),
        name='reportar_riesgo_publico'
    ),
    path(
        'publico/<uuid:prevencionista_uuid>/buzon/',
        SugerenciaConsultaPublicaCreateView.as_view(),
        name='buzon_publico'
    ),
    path(
        'publico/<uuid:prevencionista_uuid>/empresas/',
        PublicoEmpresasListView.as_view(),
        name='publico_empresas_list'
    ),

    # Endpoints de la API generados por el router
    path('', include(router.urls)),
]

