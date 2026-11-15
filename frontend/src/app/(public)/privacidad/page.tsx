import Link from "next/link";

export const metadata = {
  title: "Política de Privacidad y Tratamiento de Datos | HD Prevención",
  description: "Política de Privacidad y Protección de Datos Personales conforme a la Ley N° 21.719 y la normativa laboral chilena vigente.",
};

export default function PoliticaPrivacidadPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-16 px-4 sm:px-6 lg:px-8">
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
            Conforme a la Ley N° 21.719, Ley N° 19.628, Ley Karin (N° 21.643) y Ley N° 16.744 sobre Accidentes del Trabajo.
          </p>
          <p className="text-xs text-slate-500 mt-1">Última actualización: Noviembre 2026</p>
        </div>

        <div className="space-y-8 text-sm text-slate-300 leading-relaxed">
          {/* Sección 1 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <span className="text-orange-500">1.</span> Identidad y Responsable del Tratamiento
            </h2>
            <p>
              El responsable del tratamiento de los datos personales recopilados a través de la plataforma{" "}
              <strong className="text-white">HD Prevención</strong> es <strong className="text-white">HD Prevención SpA</strong>,
              sociedad constituida bajo las leyes de la República de Chile, con domicilio en Santiago de Chile y correo
              electrónico de contacto de privacidad:{" "}
              <a href="mailto:privacidad@hdprevencion.cl" className="text-orange-400 underline">
                privacidad@hdprevencion.cl
              </a>.
            </p>
          </section>

          {/* Sección 2 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <span className="text-orange-500">2.</span> Finalidades Específicas del Tratamiento
            </h2>
            <p className="mb-2">
              HD Prevención recopila y trata datos personales únicamente para fines explícitos y vinculados a la gestión de Seguridad y Salud en el Trabajo (SST), incluyendo:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-300">
              <li>
                <strong className="text-slate-100">Canal de Denuncias Ley Karin (Ley N° 21.643):</strong> Recepción confidencial, tramitación, registro de medidas de resguardo y derivación legal obligatoria ante la Inspección del Trabajo o la mutualidad administradora del Seguro Ley 16.744.
              </li>
              <li>
                <strong className="text-slate-100">Investigación de Accidentes Laborales:</strong> Confección y formalización de expedientes de investigación técnica, cálculo de plazos de aviso fatal/grave y emisión de la DIAT ante el organismo administrador (Circular SUSESO 3336).
              </li>
              <li>
                <strong className="text-slate-100">Acreditación de Capacitaciones y Entrega de EPP:</strong> Generación y custodia de actas de asistencia y firmas digitales manuscritas para fiscalización de la Dirección del Trabajo y SEREMI de Salud (D.S. 40 y D.S. 594).
              </li>
              <li>
                <strong className="text-slate-100">Reportes de Riesgos y Buzón de Sugerencias:</strong> Canal de participación de los trabajadores en faenas industriales y faenas de clientes.
              </li>
            </ul>
          </section>

          {/* Sección 3 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <span className="text-orange-500">3.</span> Bases de Licitud (Art. 12 y 13 Ley 21.719)
            </h2>
            <p>
              El tratamiento de datos personales se funda en:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>
                <strong className="text-slate-100">Cumplimiento de Obligaciones Legales:</strong> Tratamiento de datos de accidentes, condiciones de seguridad y denuncias en cumplimiento de la Ley N° 16.744, Ley N° 21.643 y Código del Trabajo.
              </li>
              <li>
                <strong className="text-slate-100">Consentimiento Expreso e Informado:</strong> Para sugerencias y consultas de trabajadores en los canales de participación voluntaria.
              </li>
              <li>
                <strong className="text-slate-100">Tratamiento de Datos Sensibles (Art. 16 y 16 bis):</strong> Los datos de salud (lesiones corporales, licencias) y relatos de acoso se tratan bajo el amparo estricto de las excepciones legales laborales de la Ley 21.719, con resguardo reforzado.
              </li>
            </ul>
          </section>

          {/* Sección 4 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <span className="text-orange-500">4.</span> Destinatarios y Encargados del Tratamiento
            </h2>
            <p>
              HD Prevención no comercializa ni cede datos a terceros no autorizados. Los datos personales son accesibles únicamente por:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>El prevencionista o equipo de SST asignado a la empresa empleadora.</li>
              <li>Organismos públicos fiscalizadores (Dirección del Trabajo, SUSESO, SEREMI de Salud) en cumplimiento de obligaciones legales de denuncia.</li>
              <li>Mutualidades administradoras del seguro (ACHS, Mutual de Seguridad, IST, ISL) para trámites de cobertura por accidentes del trabajo.</li>
              <li>Proveedores de infraestructura tecnológica bajo estrictos acuerdos de encargo de tratamiento (Render, Vercel).</li>
            </ul>
          </section>

          {/* Sección 5 */}
          <section>
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <span className="text-orange-500">5.</span> Plazo de Conservación y Supresión
            </h2>
            <p>
              Los datos se conservarán durante el tiempo estrictamente necesario para cumplir las finalidades descritas o durante los plazos legalmente fijados por la normativa laboral y de seguridad social chilena (mínimo de 5 años para investigaciones de accidentes y expedientes DIAT conforme a las instrucciones de la SUSESO). Cumplido el plazo legal de prescripción, los datos serán destruidos o anonimizados irreversiblemente.
            </p>
          </section>

          {/* Sección 6 */}
          <section className="bg-slate-950/60 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <span className="text-orange-500">6.</span> Derechos del Titular (ARCO-POL)
            </h2>
            <p className="mb-3">
              Conforme a los Arts. 4 al 11 de la Ley N° 21.719, usted tiene derecho a solicitar en cualquier momento y de forma gratuita:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-4">
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                <strong className="text-orange-400 block mb-1">Acceso & Información</strong>
                Conocer si se tratan sus datos y obtener copia detallada.
              </div>
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                <strong className="text-orange-400 block mb-1">Rectificación</strong>
                Actualizar o corregir datos inexactos o desactualizados.
              </div>
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                <strong className="text-orange-400 block mb-1">Supresión / Cancelación</strong>
                Eliminar sus datos cuando cese la obligación legal de custodia.
              </div>
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                <strong className="text-orange-400 block mb-1">Portabilidad & Bloqueo</strong>
                Recibir sus datos en formato estructurado o congelar su uso temporalmente.
              </div>
            </div>
            <p>
              Para ejercer cualquiera de estos derechos, puede ingresar una solicitud formal a través de nuestro{" "}
              <Link href="/derechos-arco" className="text-orange-400 font-bold underline">
                Portal de Solicitudes ARCO-POL
              </Link>{" "}
              o escribir a <a href="mailto:privacidad@hdprevencion.cl" className="text-orange-400 underline">privacidad@hdprevencion.cl</a>. Responderemos en un plazo máximo de 30 días corridos prorrogables legalmente.
            </p>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
          <span>HD Prevención SpA — Sistema de Gestión SST</span>
          <Link href="/" className="hover:text-white transition-colors">Inicio</Link>
        </div>
      </div>
    </div>
  );
}
