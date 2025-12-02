import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

export default function NavBar() {
  const showSetup = import.meta.env.DEV || (import.meta.env.VITE_ADMIN_MODE === 'true')
  return (
    <nav className="w-full px-6 py-4 flex items-center justify-between" aria-label="Top navigation">
      <div className="flex items-center gap-3">
        <img src="/logo.svg" alt="RetnaCloak" className="h-8" />
        <span className="text-xl font-semibold">RetnaCloak</span>
      </div>
      <div className="flex items-center gap-6">
        <a href="#docs" className="text-white/90 hover:text-white" aria-label="Docs">Docs</a>
        {showSetup && (
          <a href="#setup" className="text-white/90 hover:text-white" aria-label="Setup">Setup</a>
        )}
        <a href="/status" className="text-white/90 hover:text-white" aria-label="Status">Status</a>
        <WalletMultiButton aria-label="Wallet connect" className="glass-card" />
      </div>
    </nav>
  )
}
