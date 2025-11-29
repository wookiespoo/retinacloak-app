import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { SystemProgram, LAMPORTS_PER_SOL, PublicKey, Transaction } from '@solana/web3.js'
import { useEffect, useState } from 'react'
// fee routing recipient and amount are provided by backend via /api/retna/fee-quote
import { useSale } from '../lib/saleContext'

export default function BuyerPanel() {
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()
  const [status, setStatus] = useState<string>('')
  const [devMode, setDevMode] = useState<boolean>(true)
  const [feeLamports, setFeeLamports] = useState<number>(0)
  const [recipient, setRecipient] = useState<string>('')
  const { isLive, saleStartISO, durationSec, now } = useSale()

  const start = Date.parse(saleStartISO)
  const end = start + durationSec * 1000
  const remaining = isLive ? Math.max(0, Math.floor((end - now) / 1000)) : 0
  const pct = isLive && durationSec > 0 ? Math.max(0, Math.min(100, ((now - start) / (durationSec * 1000)) * 100)) : 0

  useEffect(() => {
    ;(async () => {
      try {
        const r = await fetch('/api/retna/fee-quote')
        if (r.ok) {
          const { recipient, feeLamports } = await r.json()
          setRecipient(recipient)
          setFeeLamports(feeLamports)
        }
      } catch {}
    })()
  }, [])

  const purchase = async () => {
    setStatus('')
    if (!publicKey || !sendTransaction) {
      setStatus('Wallet not connected')
      return
    }
    if (!isLive) {
      setStatus('Sale not live')
      return
    }
    try {
      const to = new PublicKey(recipient || '11111111111111111111111111111111')
      const tx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: to, lamports: feeLamports || 1000 })
      )
      const sig = await sendTransaction(tx, connection)
      setStatus(`Submitted: ${sig}`)
      await fetch('/api/retna/purchase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ buyer: publicKey.toBase58(), amount: 1 }) })
    } catch (e: any) {
      setStatus(e.message)
    }
  }

  return (
    <div className="glass-card panel-blue card-blue p-6" aria-label="Buyer Panel">
      <h3 className="text-2xl font-bold mb-4">Purchasing</h3>
      {import.meta.env.DEV && (
        <div className="flex items-center justify-between">
          <div className="text-sm" aria-label="Mode">Mode: {devMode ? 'Dev' : 'Prod'}</div>
          <label className="flex items-center gap-2" aria-label="Dev Mode Toggle"><span>Dev</span><input type="checkbox" aria-label="Dev Mode" checked={devMode} onChange={(e) => setDevMode(e.target.checked)} /></label>
        </div>
      )}
      <div className="mt-6 flex items-center justify-center">
        <div className="w-32 h-32 rounded-full" style={{ background: `conic-gradient(#fb923c ${pct}%, #ffffff22 0)` }}>
          <div className="w-28 h-28 rounded-full m-2 flex items-center justify-center bg-white/10 backdrop-blur">
            <span className="text-xl font-semibold">{isLive ? `${remaining}s` : 'Not live'}</span>
          </div>
        </div>
      </div>
      <div className="text-sm text-white/80 mt-2" aria-label="Rules">Max 1 per wallet • Cooldown 10s</div>
      <button aria-label="Purchase" title={status || ''} className={`btn-neon-purple mt-4 ${(!publicKey || !isLive) ? 'opacity-60 cursor-not-allowed' : ''}`} disabled={!publicKey || !isLive} onClick={purchase}>Purchess</button>
      {status && <div className="mt-2 text-sm break-all" aria-live="polite">{status}</div>}
    </div>
  )
}
