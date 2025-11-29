export default function Hero() {
  return (
    <section className="relative text-center mt-8" aria-label="Hero">
      <div className="inline-flex flex-col items-center gap-4">
        <img src="/logo.svg" alt="RetinaCloak logo" className="h-20 w-20 drop-shadow-lg" />
        <h1 className="text-4xl md:text-6xl font-extrabold" aria-label="RetnaCloak Title">RetnaCloak.xyz</h1>
        <p className="text-lg md:text-xl text-white/90" aria-label="Subtitle">Anti-Sniping Controls for Solana Token Sales</p>
      </div>
    </section>
  )
}
