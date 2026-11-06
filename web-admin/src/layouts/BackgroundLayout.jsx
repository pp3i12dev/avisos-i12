export default function BackgroundLayout({ children }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#101114]">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0"
        style={{background: 'radial-gradient(ellipse 68% 53% at 100% 0%, rgba(174,24,38,.13), transparent 75%), radial-gradient(ellipse 52% 60% at 0% 100%, rgba(100,17,26,.10), transparent 80%), linear-gradient(140deg, #101114 0%, #1a1b20 55%, #111215 100%)'}} />
      <div className="relative z-10 min-h-screen">{children}</div>
    </div>
  );
}
