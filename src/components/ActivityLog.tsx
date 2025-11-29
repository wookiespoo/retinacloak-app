import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

type EventRow = { id: string; type: string; buyer?: string; created_at: string }

export default function ActivityLog() {
  const [rows, setRows] = useState<EventRow[]>([])
  const [info, setInfo] = useState<string>('')
  const seen = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!supabase) {
      setInfo('Supabase not configured')
      return
    }
    const channel = supabase.channel('schema-db')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'retna_events' }, (payload) => {
        const r = payload.new as any
        if (r?.id && !seen.current.has(r.id)) {
          seen.current.add(r.id)
          setRows((prev) => [{ id: r.id, type: r.type, buyer: r.buyer, created_at: r.created_at }, ...prev])
        }
      })
      .subscribe()
    return () => { if (supabase) supabase.removeChannel(channel) }
  }, [])

  return (
    <div className="glass-card panel-teal card-teal p-6" role="region" aria-live="polite" aria-label="Activity Log">
      <h3 className="text-2xl font-bold mb-4">Activity Log</h3>
      {info && <div className="text-xs mb-2">{info}</div>}
      <div className="log-box">
        <ul className="space-y-2 p-3" role="list" aria-label="Event List">
          {rows.map((r) => (
            <li key={r.id} className="flex justify-between text-sm" role="listitem" aria-label={`Event ${r.type}`}>
              <span aria-label="Event Type">{r.type}</span>
              <span className="opacity-80" aria-label="Event Time">{new Date(r.created_at).toLocaleTimeString()}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
