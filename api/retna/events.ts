import { supabaseServer } from '../../server/supabaseServer.js'

export default async function handler(_req: any, res: any) {
  if (!supabaseServer) return res.status(500).json({ error: 'supabase not configured' })
  const { data } = await supabaseServer.from('retna_events').select('*').order('created_at', { ascending: false }).limit(100)
  res.status(200).json({ events: data || [] })
}

