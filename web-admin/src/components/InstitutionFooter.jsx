import { GraduationCap, Mail, MapPin } from 'lucide-react';

const CONTACTOS = [
    { label: 'Mail institucional', email: 'isft12@abc.gob.ar' },
    { label: 'Por equivalencias', email: 'i12equivalencias2020@gmail.com' },
    { label: 'Preceptores · Turno Mañana / Tarde', email: 'preceptoresinstituto@gmail.com' },
    { label: 'Preceptores · Turno Noche', email: 'preceptoresnoche@gmail.com' },
    { label: 'Acceso al Campus', email: 'estudiantes.isft12@gmail.com' },
    { label: 'Consultas sobre inscripciones 2022', email: 'bibliotecaidoc@gmail.com' },
    { label: 'Curso de inicio', email: 'curso.inicio.isft12@gmail.com' },
];

export default function InstitutionFooter() {
  return <footer role="contentinfo" className="relative w-full overflow-hidden border-t-4 border-[#C61515] bg-[#252B37] text-white">
    <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" style={{background:'radial-gradient(ellipse 55% 70% at 50% -10%,rgba(198,21,21,.18),transparent 78%)'}} />
    <div className="relative mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-10">
      <div className="mb-6 text-center">
        <p className="flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[.12em] text-[#F3B6B6]">
          <GraduationCap size={18} aria-hidden="true" /> Instituto Superior de Formación Docente y Técnica Nº12
        </p>
        <h2 className="mt-2 text-xl font-bold text-white sm:text-2xl">Contactos institucionales</h2>
        <address className="mt-3 flex flex-wrap items-center justify-center gap-x-2 text-center text-sm not-italic text-[#D4D8E1]">
          <MapPin size={16} className="text-[#F47B7B]" aria-hidden="true" />
          Avda. 7 Nro. 2149 esq. 76 · La Plata, Buenos Aires, Argentina
        </address>
      </div>
      <div className="mx-auto grid max-w-4xl gap-x-10 gap-y-4 border-t border-white/15 pt-6 sm:grid-cols-2">
        {CONTACTOS.map(({label,email})=><div key={email} className="min-w-0 text-center sm:text-left">
          <p className="mb-1 text-xs font-medium text-[#CED3DC]">{label}</p>
          <a href={`mailto:${email}`} className="inline-flex max-w-full items-center gap-2 break-all text-sm font-semibold text-white underline-offset-4 hover:text-[#FFB0B0] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            <Mail size={15} className="shrink-0 text-[#EF8A8A]" aria-hidden="true" />{email}
          </a>
        </div>)}
      </div>
    </div>
    <div className="relative border-t border-white/15 bg-[#1E2430] px-5 py-4 text-center text-xs text-[#C5CCD5]">
      © {new Date().getFullYear()} Avisos I12 · Comunicación para la comunidad educativa
    </div>
  </footer>;
}
