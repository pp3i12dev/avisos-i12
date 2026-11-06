export default function BackgroundLayout({ children }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#F7F7F8]">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0"
        style={{ background: 'radial-gradient(ellipse 55% 40% at 100% 0%, rgba(198,21,21,0.035), transparent 80%), linear-gradient(180deg, #FFFFFF 0%, #F7F7F8 48%, #F4F5F6 100%)' }} />
      <div className="relative z-10 min-h-screen">{children}</div>
    </div>
  );
}
