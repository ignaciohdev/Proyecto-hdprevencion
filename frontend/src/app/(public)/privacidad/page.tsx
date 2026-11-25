import Link from "next/link";

export const metadata = {
  title: "Política de Privacidad y Protección de Datos (Ley N° 21.719) | HD Prevención",
  description:
    "Política de Privacidad oficial de HD Prevención conforme al Art. 14 ter de la Ley N° 21.719 sobre Protección de los Datos Personales, Ley N° 21.643 (Ley Karin) y normativa SST chilena.",
};

export default function PoliticaPrivacidadPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-slate-900/80 border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl backdrop-blur-xl">
        <div className="mb-8 border-b border-slate-800 pb-6">
          <Link
            href="/"
            className="text-xs text-orange-400 hover:text-orange-300 font-bold uppercase tracking-wider mb-4 inline-block"
          >
            ← Volver al Inicio
          </Link>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Política de Privacidad y Tratamiento de Datos Personales
          </h1>
          <p className="text-xs text-slate-400 mt-2">
            Conforme al deber de información y transparencia del <strong>Art. 14 ter de la Ley N° 21.719</strong>, Ley N° 19.628, Ley Karin (N° 21.643), D.S. N° 44 y Ley N° 16.744.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Versión 1.0 • Última actualización: 25 de noviembre de 2026
          </p>
        </div>

        <div className="space-y-8 text-sm text-slate-300 leading-relaxed">
          {/* Sección 1 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-orange-500">1.</span> Responsable del Tratamiento y Distinción de Roles (Art. 14 ter letras b y c; Art. 15 bis)
            </h2>
            <p>
              El titular y operador de la plataforma <strong className="text-white">HD Prevención</strong> es{" "}
              <strong className="text-white">HD Prevención</strong> (sociedad en proceso de formalización societaria ante notaría y SII en Santiago de Chile). El responsable interno de privacidad conforme al artículo 50 inc. 3° de la Ley N° 21.719 (régimen Microempresa, Ley N° 20.416) atiende consultas y requerimientos en{" "}
              <a href="mailto:privacidad@hdprevencion.cl" className="text-orange-400 underline">
                privacidad@hdprevencion.cl
              </a>{" "}
              y a través de nuestro formulario electrónico{" "}
              <Link href="/derechos-arco" className="text-orange-400 underline font-semibold">
                /derechos-arco
              </Link>.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-orange-400 mb-1.5">
                  Cuando actuamos como Responsable
                </h3>
                <p className="text-xs text-slate-300">
                  Respecto de los datos de <strong>usuarios y prevencionistas</strong> que crean una cuenta o contratan un plan, de quienes nos contactan o cotizan capacitaciones, y de quienes presentan solicitudes ARCO-POL o reportan incidentes de seguridad.
                </p>
              </div>
              <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1.5">
                  Cuando actuamos como Encargado (Art. 15 bis)
                </h3>
                <p className="text-xs text-slate-300">
                  Respecto de los datos personales y sensibles de <strong>trabajadores, participantes de charlas, receptores de EPP/RIOHS, accidentados, denunciantes Ley Karin y personal contratista</strong> registrados por cada empresa cliente. En estos casos, el <strong>Responsable es el empleador o mandante respectivo</strong>.
                </p>
              </div>
            </div>
          </section>

          {/* Sección 2 */}
          <section className="space-y-2.5">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-orange-500">2.</span> Categorías de Datos Personales y su Origen (Art. 14 ter letras d y j)
            </h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-slate-100">Usuarios / Prevencionistas (Responsable):</strong> nombre de usuario, correo electrónico, foto de perfil opcional, contraseña almacenada mediante hash criptográfico, tipo de cuenta, historial de suscripción y copias de plantillas guardadas. <em>Origen:</em> entregados directamente por el usuario.
              </li>
              <li>
                <strong className="text-slate-100">Contactos y solicitantes de cotización o derechos (Responsable):</strong> nombre, correo electrónico, teléfono, cargo, razón social y RUT de empresa consultante, detalle de consulta o solicitud ARCO-POL. <em>Origen:</em> proporcionados directamente en nuestros formularios web.
              </li>
              <li>
                <strong className="text-slate-100">Trabajadores y subcontratistas de empresas clientes (Encargado):</strong> nombre completo, RUT, cargo, correo, teléfono, fecha de ingreso, asistencia y firma manuscrita digitalizada en capacitaciones o entregas de EPP/RIOHS, IP del dispositivo firmante y antecedentes previsionales/contractuales (F30/F30-1). <em>Origen:</em> cargados por la empresa empleadora/prevencionista o ingresados por el trabajador mediante código QR en faena.
              </li>
              <li>
                <strong className="text-slate-100">Datos personales sensibles (Arts. 16 y 16 bis):</strong> antecedentes de salud laboral (lesiones, partes afectadas, días perdidos/alta médica en accidentes e ISO/SUSESO Anexo 67), hechos confidenciales de denuncias bajo Ley Karin (Ley N° 21.643) e indicadores preventivos de vulnerabilidad en matrices MIPER (Art. 11 D.S. N° 44). No tratamos biometría facial/dactilar ni datos de niños/as en operación ordinaria.
              </li>
            </ul>
          </section>

          {/* Sección 3 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-orange-500">3.</span> Finalidades y Bases de Licitud (Art. 14 ter letra d; Arts. 12, 13, 16 y 16 bis)
            </h2>
            <div className="overflow-x-auto border border-slate-800 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Finalidad del Tratamiento</th>
                    <th className="px-4 py-3">Rol</th>
                    <th className="px-4 py-3">Base de Licitud (Ley N° 21.719)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                  <tr>
                    <td className="px-4 py-3 text-slate-200">Creación de cuenta, autenticación MFA, soporte y prestación del SaaS</td>
                    <td className="px-4 py-3">Responsable</td>
                    <td className="px-4 py-3">Ejecución de contrato / medidas precontractuales (<strong>Art. 13 letra c</strong>)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-200">Consultas comerciales, cotizaciones de capacitación o novedades SST opcionales</td>
                    <td className="px-4 py-3">Responsable</td>
                    <td className="px-4 py-3">Medidas precontractuales (<strong>Art. 13 c</strong>) o consentimiento expreso e inequívoco (<strong>Art. 12</strong>)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-200">Gestión de solicitudes ARCO-POL y registro de brechas</td>
                    <td className="px-4 py-3">Responsable</td>
                    <td className="px-4 py-3">Cumplimiento de obligación legal (<strong>Art. 13 letra b</strong>; Arts. 4–11 y 14 sexies)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-200">Gestión SST en faenas (capacitaciones, EPP/RIOHS, CPHS, contratistas)</td>
                    <td className="px-4 py-3">Encargado</td>
                    <td className="px-4 py-3">Instrucción del empleador fundada en obligación legal SST (<strong>Art. 13 b</strong>, <strong>Art. 15 bis</strong>; Ley 16.744, D.S. 44, D.S. 594)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-200">Investigación DIAT/accidentes y denuncias confidenciales Ley Karin</td>
                    <td className="px-4 py-3">Encargado</td>
                    <td className="px-4 py-3">Obligación legal laboral y de seguridad social para datos sensibles (<strong>Arts. 13 b, 16 letras e/f, 16 bis</strong>; Ley 16.744, Ley 21.643)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-200">Sugerencias con identificación voluntaria existiendo opción anónima</td>
                    <td className="px-4 py-3">Encargado</td>
                    <td className="px-4 py-3">Consentimiento específico otorgado en formulario (<strong>Art. 12</strong>)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Sección 4 */}
          <section className="space-y-2.5">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-orange-500">4.</span> Destinatarios y Transferencias Internacionales (Art. 14 ter h; Arts. 27 y 28)
            </h2>
            <p>
              <strong>No vendemos ni comercializamos datos personales</strong>, ni los cedemos para publicidad o entrenamiento de modelos de IA. Únicamente pueden acceder:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Organismos competentes por mandato legal (por cuenta del empleador Responsable):</strong> Dirección del Trabajo (DT), SUSESO, SEREMI de Salud, mutualidades (ACHS, Mutual de Seguridad, IST, ISL) y la Agencia de Protección de Datos Personales.
              </li>
              <li>
                <strong>Proveedores tecnológicos (sub-encargados):</strong> Render Services, Inc. (EE.UU., backend y PostgreSQL) y Vercel Inc. (EE.UU., frontend). Las consultas meteorológicas a Open-Meteo transmiten únicamente coordenadas geográficas de la faena o comuna chilena, sin PII.
              </li>
            </ul>
            <p className="text-xs bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 text-slate-300">
              <strong>Garantías de transferencia internacional:</strong> Dado que EE.UU. no cuenta aún con declaración de nivel adecuado de la Agencia chilena, las transferencias se respaldan conforme a los <strong>Arts. 27 letra b) y 28 de la Ley N° 21.719</strong> mediante las <strong>Cláusulas Contractuales Modelo</strong> aprobadas por la Resolución Exenta RAEX202503748 (Min. Economía, D.O. 19-12-2025) y los respectivos DPAs con cada proveedor previo a la operación en producción real.
            </p>
          </section>

          {/* Sección 5 */}
          <section className="space-y-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-orange-500">5.</span> Plazos de Conservación (Art. 14 ter letra i; Art. 7)
            </h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Expedientes SST y laborales sensibles (accidentes/DIAT, Ley Karin y logs, capacitaciones, EPP/RIOHS, CPHS):</strong> mínimo <strong>5 años</strong> por obligación legal laboral y previsional (Art. 7 inc. 2° romanito ii; Ley 16.744, Circular SUSESO 3336, D.S. 44, Ley 21.643).</li>
              <li><strong>Antecedentes tributarios y facturación:</strong> <strong>3 a 6 años</strong> según Código Tributario (arts. 17 y 200).</li>
              <li><strong>Cuentas canceladas sin deuda ni deber legal:</strong> supresión o anonimización irreversible dentro de <strong>90 días</strong>.</li>
              <li><strong>Consultas comerciales y cotizaciones no concretadas:</strong> máximo <strong>12 meses</strong> desde el último contacto.</li>
              <li><strong>Evidencia de consentimientos, solicitudes ARCO-POL y registro de brechas:</strong> mínimo <strong>5 años</strong> como respaldo de cumplimiento legal.</li>
            </ul>
          </section>

          {/* Sección 6 */}
          <section className="bg-slate-950/60 p-6 rounded-2xl border border-slate-800 space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-orange-500">6.</span> Derechos ARCO-POL y Reclamación ante la Agencia (Art. 14 ter f, g y k; Arts. 4–11)
            </h2>
            <p>
              Puedes ejercer gratuita y expeditamente tus derechos de <strong>Acceso, Rectificación, Supresión, Oposición, Portabilidad y Bloqueo Temporal</strong>, así como <strong>retirar el consentimiento</strong> en cualquier momento:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                <strong className="text-orange-400 block mb-1">Plazo de Respuesta</strong>
                Hasta <strong>30 días corridos</strong> (prorrogables una sola vez por 30 días adicionales previo aviso).
              </div>
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                <strong className="text-orange-400 block mb-1">Bloqueo Temporal</strong>
                Resolución dentro de <strong>2 días hábiles</strong> siguientes a la recepción (Art. 11 inc. 6°).
              </div>
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                <strong className="text-orange-400 block mb-1">Derecho a Reclamar</strong>
                Ante la <strong>Agencia de Protección de Datos Personales</strong> dentro de <strong>30 días hábiles</strong> ante denegatoria o silencio.
              </div>
            </div>
            <p className="text-xs">
              Si eres trabajador de una empresa cliente, coordinaremos tu solicitud con tu empleador (Responsable del tratamiento) conforme al Art. 15 bis. Canal habilitado en{" "}
              <Link href="/derechos-arco" className="text-orange-400 font-bold underline">
                Portal ARCO-POL (/derechos-arco)
              </Link>{" "}
              y en{" "}
              <a href="mailto:privacidad@hdprevencion.cl" className="text-orange-400 underline">
                privacidad@hdprevencion.cl
              </a>.
            </p>
          </section>

          {/* Sección 7 y 8 */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950/50 p-5 rounded-2xl border border-slate-800 space-y-2">
              <h2 className="text-base font-bold text-white">
                <span className="text-orange-500">7.</span> Decisiones Automatizadas (Art. 14 ter l)
              </h2>
              <p className="text-xs text-slate-300">
                No realizamos elaboración de perfiles ni adoptamos decisiones basadas únicamente en el tratamiento automatizado que produzcan efectos jurídicos o afecten significativamente a los titulares. Los semáforos y cálculos técnicos son apoyo bajo criterio humano del prevencionista o empleador.
              </p>
            </div>
            <div className="bg-slate-950/50 p-5 rounded-2xl border border-slate-800 space-y-2">
              <h2 className="text-base font-bold text-white">
                <span className="text-orange-500">8.</span> Medidas de Seguridad y Cambios (Art. 14 ter a, e)
              </h2>
              <p className="text-xs text-slate-300">
                Aplicamos cifrado en tránsito (TLS/HSTS), aislamiento multi-tenant, contraseñas con hash robusto, autenticación MFA TOTP, cifrado autenticado en reposo para relatos confidenciales e información oportuna ante incidentes (Art. 14 sexies). Cualquier actualización será publicada en esta página indicando su nueva versión y fecha.
              </p>
            </div>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800 flex flex-wrap justify-between items-center gap-3 text-xs text-slate-500">
          <span>HD Prevención — Cumplimiento Ley N° 21.719 (Versión 1.0)</span>
          <div className="flex gap-4">
            <Link href="/derechos-arco" className="hover:text-orange-400 transition-colors">Derechos ARCO-POL</Link>
            <Link href="/terminos" className="hover:text-orange-400 transition-colors">Términos</Link>
            <Link href="/" className="hover:text-white transition-colors">Inicio</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
