import { BookOpen, GraduationCap, Mail, MapPin } from 'lucide-react';
import fachada from '../assets/images/i12-fachada.webp';

// Contactos institucionales aportados para Avisos I12.
// El rótulo "Inscripciones 2022" se conserva porque así aparece en la fuente;
// conviene confirmar con el instituto si esa casilla continúa vigente.
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
    return (
        <footer
            role="contentinfo"
            className="relative isolate w-full overflow-hidden border-t-[4px] border-[#C61515] bg-[#252B37] text-[#F5F6F8]"
        >
            {/* Superficie oscura propia: no depende de la identidad del contenido interno. */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-80"
                style={{ background: 'radial-gradient(ellipse 60% 70% at 14% 0%, rgba(198,21,21,.12), transparent 75%)' }}
            />

            <div className="relative mx-auto grid w-full max-w-[1700px] lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                {/* IZQUIERDA: contacto completo, accesible y seleccionable. */}
                <div className="relative z-10 px-5 pb-10 pt-11 sm:px-8 lg:py-12 lg:pl-12 lg:pr-5">
                    <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-[#F3B6B6]">
                        <GraduationCap size={18} strokeWidth={1.8} /> Instituto Superior de Formación Docente y Técnica Nº12
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Estamos para ayudarte</h2>
                    <div aria-hidden="true" className="my-5 h-0.5 w-12 rounded-full bg-[#ED5050]" />
                    <address className="not-italic">
                        <div className="mb-6 flex items-start gap-3 text-[13px] leading-6 text-[#D4D8E1]">
                            <MapPin size={18} className="mt-1 shrink-0 text-[#F47B7B]" />
                            <div>
                                <p className="font-semibold text-white">Dirección</p>
                                <p>Avda. 7 Nro. 2149 esq. 76</p>
                                <p>La Plata · Pcia. de Buenos Aires · Argentina</p>
                            </div>
                        </div>
                        <div className="grid gap-x-7 gap-y-4 sm:grid-cols-2">
                            {CONTACTOS.map(({ label, email }) => (
                                <div key={email} className="min-w-0">
                                    <p className="mb-1 text-[11px] font-medium leading-5 text-[#BEC6D2]">{label}</p>
                                    <a
                                        href={`mailto:${email}`}
                                        className="inline-flex min-w-0 items-start gap-2 break-all text-[12px] font-semibold leading-5 text-white underline-offset-4 transition-colors hover:text-[#FFB0B0] hover:underline focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-[13px]"
                                        aria-label={`Enviar correo a ${email} (${label})`}
                                    >
                                        <Mail size={14} className="mt-[3px] shrink-0 text-[#F08080]" />
                                        <span className="min-w-0">{email}</span>
                                    </a>
                                </div>
                            ))}
                        </div>
                    </address>
                </div>

                {/* DERECHA: foto nueva centrada, visible completa y difuminada hacia el grafito.
                    Las letras quedan dentro de la zona central sin recortar la imagen. */}
                <div className="relative flex min-h-[240px] items-center justify-center overflow-hidden bg-[#252B37] px-1 pb-5 pt-0 sm:min-h-[330px] sm:px-3 lg:min-h-full lg:px-0 lg:py-7">
                    <figure className="relative mx-auto w-full max-w-[900px]">
                        <img
                            src={fachada}
                            alt="Letrero completo del Instituto Superior de Formación Docente y Técnica Nº12 de La Plata"
                            loading="lazy"
                            decoding="async"
                            className="block h-auto w-full object-contain brightness-[.9]"
                        />
                        {/* Bordes difuminados. El centro (donde está el letrero)
                            mantiene nitidez y la fotografía se funde con el footer. */}
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0"
                            style={{
                                background: [
                                    'linear-gradient(to right, #252B37 0%, transparent 5%, transparent 95%, #252B37 100%)',
                                    'linear-gradient(to bottom, #252B37 0%, transparent 23%, transparent 74%, #252B37 100%)',
                                ].join(', '),
                            }}
                        />
                        <figcaption className="absolute bottom-3 right-3 rounded-lg border border-white/20 bg-[#1B202A]/85 px-3 py-2 text-right text-xs text-white shadow-lg backdrop-blur-md sm:bottom-5 sm:right-5">
                            <span className="flex items-center justify-end gap-2 font-semibold">
                                <BookOpen size={15} className="text-[#FE9292]" /> Nuestra institución
                            </span>
                            <span className="mt-1 block text-[11px] text-[#E1E3E9]">La Plata, Buenos Aires</span>
                        </figcaption>
                    </figure>
                </div>
            </div>

            <div className="relative border-t border-white/15 bg-[#1E2430]/90">
                <div className="mx-auto flex max-w-[1700px] flex-col gap-2 px-5 py-5 text-xs text-[#C5CCD5] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
                    <span>© {new Date().getFullYear()} Avisos I12 · Comunicación para la comunidad educativa</span>
                    <span>Instituto Superior de Formación Docente y Técnica Nº12 · La Plata</span>
                </div>
            </div>
        </footer>
    );
}
