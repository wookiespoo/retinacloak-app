import '@solana/wallet-adapter-react-ui/styles.css'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
import NavBar from './components/NavBar'
import IssuerDashboard from './components/IssuerDashboard'
import BuyerPanel from './components/BuyerPanel'
import ActivityLog from './components/ActivityLog'
import Footer from './components/Footer'
import Hero from './components/Hero'
import { SaleProvider } from './lib/saleContext'
import TestHarness from './components/TestHarness'

export default function App() {
  const endpoint = 'https://api.devnet.solana.com'
  const wallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()]

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <SaleProvider>
            <div className="max-w-7xl mx-auto px-6">
              <NavBar />
              <Hero />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                <IssuerDashboard />
                <BuyerPanel />
                <ActivityLog />
              </div>
              <Footer />
              {import.meta.env.DEV && <TestHarness />}
            </div>
          </SaleProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
