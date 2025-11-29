import express from 'express'
import cors from 'cors'
import { Connection, clusterApiUrl } from '@solana/web3.js'
import { supabaseServer } from './supabaseServer'
import { FEE_USD_PER_MIN, FEE_RECIPIENT, TEST_WALLET } from './constants'

type SaleConfig = {
  tokenMint: string
  saleStartISO: string
  durationSec: number
  minPerWallet: number
  maxPerWallet: number
  cooldownSec: number
  whitelistEnabled: boolean
  whitelistAddresses: string[]
}

const app = express()
app.use(cors())
app.use(express.json())

let config: SaleConfig | null = null
const purchases = new Map<string, number[]>()
const events: any[] = []
const connection = new Connection(clusterApiUrl('devnet'), 'confirmed')
const usedSlots = new Set<number>()

app.get('/api/retna/health', (_req, res) => res.json({ ok: true }))

app.post('/api/retna/rules', (req, res) => {
  const c = req.body as SaleConfig
  if (!c.tokenMint || !c.saleStartISO) return res.status(400).json({ error: 'invalid config' })
  config = c
  events.unshift({ id: String(Date.now()), type: 'config_saved', created_at: new Date().toISOString() })
  if (supabaseServer) {
    supabaseServer.from('retna_events').insert({ type: 'config_saved', created_at: new Date().toISOString() }).then(() => {}).catch(() => {})
  }
  res.json({ ok: true })
})

app.get('/api/retna/metrics', async (req, res) => {
  try {
    if (req.query && (req.query.fail === '1' || req.query.fail === 'true')) {
      throw new Error('forced_fail')
    }
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
    const j = await r.json()
    const rateUsdPerSol = j.solana?.usd || 200
    res.json({ rateUsdPerSol })
  } catch {
    res.json({ rateUsdPerSol: 200 })
  }
})

app.get('/api/retna/fee-quote', async (_req, res) => {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
    const j = await r.json()
    const rateUsdPerSol = j.solana?.usd || 200
    const feeSol = FEE_USD_PER_MIN / rateUsdPerSol
    const feeLamports = Math.ceil(feeSol * 1_000_000_000)
    const recipient = process.env.NODE_ENV === 'production' ? FEE_RECIPIENT : TEST_WALLET
    res.json({ recipient, feeLamports, rateUsdPerSol })
  } catch {
    const recipient = process.env.NODE_ENV === 'production' ? FEE_RECIPIENT : TEST_WALLET
    res.json({ recipient, feeLamports: 1000, rateUsdPerSol: 200 })
  }
})

app.post('/api/retna/purchase', (req, res) => {
  const { buyer } = req.body as { buyer: string }
  if (!config) return res.status(400).json({ error: 'sale not configured' })
  const now = Date.now()
  const start = Date.parse(config.saleStartISO)
  if (isNaN(start) || now < start || now > start + config.durationSec * 1000) return res.status(400).json({ error: 'sale not live' })
  if (config.whitelistEnabled && !config.whitelistAddresses.includes(buyer)) return res.status(403).json({ error: 'not whitelisted' })
  const arr = purchases.get(buyer) || []
  if (arr.length >= config.maxPerWallet) return res.status(429).json({ error: 'max per wallet' })
  if (arr.length && now - arr[arr.length - 1] < config.cooldownSec * 1000) return res.status(429).json({ error: 'cooldown' })
  // per-slot rule: one validated purchase per block
  // fetch current slot and ensure it's unused
  connection.getSlot().then((slot) => {
    if (usedSlots.has(slot)) {
      return res.status(429).json({ error: 'per_slot' })
    }
    usedSlots.add(slot)
    arr.push(now)
    purchases.set(buyer, arr)
    const ev = { id: String(now), type: 'purchase', buyer, created_at: new Date().toISOString() }
    events.unshift(ev)
    if (supabaseServer) {
      supabaseServer.from('retna_events').insert({ type: 'purchase', buyer, created_at: new Date().toISOString() }).then(() => {}).catch(() => {})
    }
    return res.json({ ok: true })
  }).catch(() => {
    // if RPC fails, allow purchase but mark event with rpc_error
    arr.push(now)
    purchases.set(buyer, arr)
    const ev = { id: String(now), type: 'purchase', buyer, created_at: new Date().toISOString(), note: 'slot_rpc_error' }
    events.unshift(ev)
    if (supabaseServer) {
      supabaseServer.from('retna_events').insert({ type: 'purchase', buyer, created_at: new Date().toISOString(), note: 'slot_rpc_error' }).then(() => {}).catch(() => {})
    }
    return res.json({ ok: true, note: 'slot_rpc_error' })
  })
})

app.get('/api/retna/events', (_req, res) => res.json({ events }))

app.post('/api/retna/dev/reset', (_req, res) => {
  purchases.clear()
  usedSlots.clear()
  events.unshift({ id: String(Date.now()), type: 'dev_reset', created_at: new Date().toISOString() })
  res.json({ ok: true })
})

app.get('/api/retna/dev/error', (_req, res) => {
  res.status(500).json({ error: 'forced_500' })
})

const port = process.env.PORT || 5174
app.listen(port, () => {
  console.log(`RetnaCloak API on http://localhost:${port}`)
})
