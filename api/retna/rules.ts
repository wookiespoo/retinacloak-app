import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabaseServer } from '../../server/supabaseServer'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })
  const c = req.body || {}
  if (!c.tokenMint || !c.saleStartISO) return res.status(400).json({ error: 'invalid config' })
  if (!supabaseServer) return res.status(500).json({ error: 'supabase not configured' })
  try {
    await supabaseServer.from('retna_events').insert({ type: 'config_saved', buyer: null, created_at: new Date().toISOString(), ...c })
    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: 'insert_failed' })
  }
}

