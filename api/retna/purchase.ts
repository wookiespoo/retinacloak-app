import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Connection, clusterApiUrl } from '@solana/web3.js'
import { supabaseServer } from '../../server/supabaseServer'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })
  if (!supabaseServer) return res.status(500).json({ error: 'supabase not configured' })
  const body = req.body || {}
  const buyer = body.buyer
  if (!buyer) return res.status(400).json({ error: 'missing buyer' })

  // load latest config
  const { data: configs } = await supabaseServer.from('retna_events').select('*').eq('type', 'config_saved').order('created_at', { ascending: false }).limit(1)
  const cfg = configs && configs[0]
  if (!cfg) return res.status(400).json({ error: 'sale not configured' })

  const now = Date.now()
  const start = Date.parse(cfg.saleStartISO)
  if (isNaN(start) || now < start || now > start + (cfg.durationSec || 0) * 1000) return res.status(400).json({ error: 'sale not live' })
  if (cfg.whitelistEnabled && Array.isArray(cfg.whitelistAddresses) && !cfg.whitelistAddresses.includes(buyer)) return res.status(403).json({ error: 'not whitelisted' })

  // limits
  const { data: limitsRows } = await supabaseServer.from('retna_limits').select('*').eq('wallet', buyer).limit(1)
  const limits = limitsRows && limitsRows[0]
  const lastAt = limits?.last_purchase_at ? Date.parse(limits.last_purchase_at) : 0
  const count = limits?.purchases || 0
  const cooldownSec = cfg.cooldownSec || 0
  const maxPerWallet = cfg.maxPerWallet || 0
  if (maxPerWallet && count >= maxPerWallet) return res.status(429).json({ error: 'max per wallet' })
  if (lastAt && now - lastAt < cooldownSec * 1000) return res.status(429).json({ error: 'cooldown' })

  // per-slot rule
  const rpc = process.env.SOLANA_RPC_URL || clusterApiUrl('devnet')
  const connection = new Connection(rpc, 'confirmed')
  try {
    const slot = await connection.getSlot()
    if (limits?.last_slot && limits.last_slot === slot) return res.status(429).json({ error: 'per_slot' })
    // update limits and insert event
    const updated = {
      wallet: buyer,
      purchases: count + 1,
      last_purchase_at: new Date().toISOString(),
      last_slot: slot,
    }
    if (limits) await supabaseServer.from('retna_limits').update(updated).eq('wallet', buyer)
    else await supabaseServer.from('retna_limits').insert(updated)
    await supabaseServer.from('retna_events').insert({ type: 'purchase', buyer, created_at: new Date().toISOString() })
    return res.status(200).json({ ok: true })
  } catch (e) {
    // fallback without slot
    const updated = {
      wallet: buyer,
      purchases: count + 1,
      last_purchase_at: new Date().toISOString(),
      last_slot: null,
    }
    if (limits) await supabaseServer.from('retna_limits').update(updated).eq('wallet', buyer)
    else await supabaseServer.from('retna_limits').insert(updated)
    await supabaseServer.from('retna_events').insert({ type: 'purchase', buyer, created_at: new Date().toISOString(), note: 'slot_rpc_error' })
    return res.status(200).json({ ok: true, note: 'slot_rpc_error' })
  }
}

