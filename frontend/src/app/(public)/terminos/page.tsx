import Link from "next/link";

export const metadata = {
  title: "Términos del Servicio | HD Prevención",
  description: "Términos y condiciones de uso de la plataforma HD Prevención SpA.",
};

export default function TerminosPage() {
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
            Términos y Condiciones del Servicio
          </h1>
          <p className="text-xs text-slate-400 mt-2">
            Condiciones de acceso, uso, responsabilidades y confidencialidad de la plataforma HD Prevención.
          </p>
        </div>

        <div className="space-y-6 text-sm text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-white mb-2">1. Objeto y Alcance</h2>
            <p>
              HD Prevención es una plataforma SaaS destinada a la gestión técnica de Prevención de Riesgos, Seguridad y Salud en el Trabajo (SST), canal de denuncias Ley Karin, trazabilidad de capacitaciones y cumplimiento de normativas de la República de Chile.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">2. Cuentas y Responsabilidad de Acceso</h2>
            <p>
              Cada cuenta de usuario es personal e intransferible. El usuario es responsable de la confidencialidad de sus credenciales. La incorporación de asientos a cuentas corporativas debe ser autorizada formalmente por el titular de la suscripción.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">3. Confidencialidad y Secreto Profesional</h2>
            <p>
              Toda la información ingresada en relación con investigaciones de accidentes, nóminas de trabajadores y especialmente denuncias tramitadas bajo la Ley Karin (Ley N° 21.643) goza de reserva y confidencialidad estricta. Su uso indebido fuera de las finalidades legales de seguridad laboral está prohibido.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-2">4. Protección de Datos Personales</h2>
            <p>
              El tratamiento de datos se rige por nuestra{" "}
              <Link href="/privacidad" className="text-orange-400 underline font-semibold">
                Política de Privacidad
              </Link>{" "}
              en estricto apego a la Ley N° 21.719.
            </p>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
          <span>HD Prevención SpA</span>
          <Link href="/" className="hover:text-white transition-colors">Inicio</Link>
        </div>
      </div>
    </div>
  );
}
