import { useState } from 'react'
import { FEE_USD_PER_MIN } from '../lib/constants'
import type { SaleConfig } from '../lib/types'
import WalletInfo from './WalletInfo'

const initial: SaleConfig = {
  tokenMint: '',
  saleStartISO: '',
  durationSec: 0,
  minPerWallet: 0,
  maxPerWallet: 0,
  cooldownSec: 0,
  whitelistEnabled: false,
  whitelistAddresses: [],
}

import { useSale } from '../lib/saleContext'

export default function IssuerDashboard() {
  const [cfg, setCfg] = useState<SaleConfig>(initial)
  const [status, setStatus] = useState<string>('')
  const { setSale } = useSale()

  const update = (key: keyof SaleConfig, v: any) => {
    setCfg((c) => ({ ...c, [key]: v }))
  }

  const submit = async () => {
    setStatus('')
    if (!cfg.tokenMint || !cfg.saleStartISO) {
      setStatus('Missing tokenMint or saleStartISO')
      return
    }
    try {
      const res = await fetch('/api/retna/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      })
      if (!res.ok) throw new Error('Failed to post config')
      setStatus('Config saved')
    } catch (e: any) {
      setStatus(e.message)
    }
  }

  return (
    <div className="glass-card panel-magenta card-orange-magenta p-6" aria-label="Issuer Dashboard">
      <div className="mb-4">
        <WalletInfo />
      </div>
      <h3 className="text-2xl font-bold mb-4">Issuer Dashboard</h3>
      <div className="mb-4 text-sm">Fee: ${FEE_USD_PER_MIN}/min</div>
      <div className="space-y-3 mb-4">
        <div className="row-glass">Control anti-sniper sauce</div>
        <div className="row-glass flex justify-between"><span>Cost/Min</span><span>Risk Factors</span></div>
        <div className="row-glass">Level whitelist (open vs on-chain)</div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input className="glass-card p-2" aria-label="Token Mint" placeholder="tokenMint" value={cfg.tokenMint} onChange={(e) => update('tokenMint', e.target.value)} />
        <input className="glass-card p-2" aria-label="Sale Start ISO" placeholder="saleStartISO" value={cfg.saleStartISO} onChange={(e) => update('saleStartISO', e.target.value)} />
        <input className="glass-card p-2" aria-label="Duration Seconds" type="number" placeholder="durationSec" value={cfg.durationSec} onChange={(e) => update('durationSec', Number(e.target.value))} />
        <input className="glass-card p-2" aria-label="Min Per Wallet" type="number" placeholder="minPerWallet" value={cfg.minPerWallet} onChange={(e) => update('minPerWallet', Number(e.target.value))} />
        <input className="glass-card p-2" aria-label="Max Per Wallet" type="number" placeholder="maxPerWallet" value={cfg.maxPerWallet} onChange={(e) => update('maxPerWallet', Number(e.target.value))} />
        <input className="glass-card p-2" aria-label="Cooldown Seconds" type="number" placeholder="cooldownSec" value={cfg.cooldownSec} onChange={(e) => update('cooldownSec', Number(e.target.value))} />
        <label className="flex items-center gap-2" aria-label="Whitelist Enabled">
          <input type="checkbox" aria-label="Whitelist Enabled Checkbox" checked={cfg.whitelistEnabled} onChange={(e) => update('whitelistEnabled', e.target.checked)} />
          <span>whitelistEnabled</span>
        </label>
        <textarea className="glass-card p-2" aria-label="Whitelist Addresses" rows={4} placeholder="whitelistAddresses (one per line)" value={cfg.whitelistAddresses.join('\n')} onChange={(e) => update('whitelistAddresses', e.target.value.split(/\r?\n/).filter(Boolean))} />
      </div>
      <div className="mt-4 flex gap-3">
        <button className="btn-neon-purple" aria-label="Save Config" onClick={submit}>Save</button>
        <button className="btn-neon-orange" aria-label="Start Sale" onClick={() => { if (cfg.saleStartISO && cfg.durationSec) setSale(cfg.saleStartISO, cfg.durationSec) }}>Start Sale</button>
      </div>
      {status && <div className="mt-2 text-sm">{status}</div>}
    </div>
  )
}
