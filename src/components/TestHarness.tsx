import { useEffect, useRef, useState } from 'react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { supabase } from '../lib/supabase'
import { useWallet } from '@solana/wallet-adapter-react'

type Level = 'success' | 'warning' | 'error' | 'info'
type LogItem = { ts: string; msg: string; level: Level }

export default function TestHarness() {
  const [logs, setLogs] = useState<LogItem[]>([])
  const [toggleOn, setToggleOn] = useState<boolean>(false)
  const channelRef = useRef<any>(null)
  const seen = useRef<Set<string>>(new Set())
  const lastAction = useRef<null | (() => Promise<void>)>(null)
  const [cooldownSec] = useState<number>(5)
  const [whitelist, setWhitelist] = useState<string[]>(['BuyerA'])
  const [perSlotStatus, setPerSlotStatus] = useState<string>('unknown')
  const [buyerCooldowns, setBuyerCooldowns] = useState<Record<string, number>>({})
  const [logsOpen, setLogsOpen] = useState<boolean>(true)
  const [metricsOpen, setMetricsOpen] = useState<boolean>(true)
  const { publicKey, wallet, connected } = useWallet()

  const log = (msg: string, level: Level = 'info') => {
    setLogs((l) => [{ ts: new Date().toLocaleTimeString(), msg, level }, ...l].slice(0, 200))
  }

  const levelForStatus = (status: number) => {
    if (status >= 200 && status < 300) return 'success'
    if (status === 429) return 'warning'
    if (status >= 400) return 'error'
    return 'info'
  }

  const simulatePerSlot = async () => {
    const b1 = fetch('/api/retna/purchase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ buyer: 'BuyerSimA', amount: 1 }) })
    const b2 = fetch('/api/retna/purchase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ buyer: 'BuyerSimB', amount: 1 }) })
    const [r1, r2] = await Promise.all([b1, b2])
    const t1 = await r1.text()
    const t2 = await r2.text()
    log(`Per-slot A: ${r1.status} ${t1}`, levelForStatus(r1.status))
    log(`Per-slot B: ${r2.status} ${t2}`, levelForStatus(r2.status))
    setPerSlotStatus(r1.status === 200 && r2.status === 429 ? 'enforced' : 'unknown')
    lastAction.current = simulatePerSlot
  }

  const forceOracleFailure = async () => {
    const r = await fetch('/api/retna/metrics?fail=1')
    const j = await r.json()
    const feeSol = 9 / j.rateUsdPerSol
    const feeLamports = Math.ceil(feeSol * LAMPORTS_PER_SOL)
    log(`Oracle fallback rateUsdPerSol=${j.rateUsdPerSol} feeLamports=${feeLamports}`, 'warning')
    lastAction.current = forceOracleFailure
  }

  const toggleWhitelist = async () => {
    const wl = toggleOn ? ['BuyerA'] : ['BuyerA', 'BuyerB']
    const cfg = {
      tokenMint: 'Mint',
      saleStartISO: new Date().toISOString(),
      durationSec: 3600,
      minPerWallet: 10,
      maxPerWallet: 10,
      cooldownSec,
      whitelistEnabled: true,
      whitelistAddresses: wl,
    }
    const r = await fetch('/api/retna/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) })
    setToggleOn(!toggleOn)
    setWhitelist(wl)
    log(`Toggle whitelist → ${wl.join(', ')} status=${r.status}`, levelForStatus(r.status))
    lastAction.current = toggleWhitelist
  }

  const cooldownStress = async () => {
    const name = 'BuyerStress'
    const r1 = await fetch('/api/retna/purchase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ buyer: name, amount: 1 }) })
    log(`Stress #1: ${r1.status} ${await r1.text()}`, levelForStatus(r1.status))
    const r2 = await fetch('/api/retna/purchase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ buyer: name, amount: 1 }) })
    log(`Stress #2: ${r2.status} ${await r2.text()}`, levelForStatus(r2.status))
    const r3 = await fetch('/api/retna/purchase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ buyer: name, amount: 1 }) })
    log(`Stress #3: ${r3.status} ${await r3.text()}`, levelForStatus(r3.status))
    lastAction.current = cooldownStress
  }

  const reconnectSupabase = async () => {
    if (!supabase) { log('Supabase not configured'); return }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
      log('Supabase disconnected')
    }
    const ch = supabase.channel('dev-harness')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'retna_events' }, (payload) => {
        const r: any = payload.new
        if (r?.id && !seen.current.has(r.id)) {
          seen.current.add(r.id)
          log(`Event ${r.type} @ ${new Date(r.created_at).toLocaleTimeString()}`)
        }
      })
      .subscribe()
    channelRef.current = ch
    log('Supabase reconnected')
    lastAction.current = reconnectSupabase
  }

  const replayLast = async () => {
    if (lastAction.current) await lastAction.current()
    else log('No last test to replay', 'warning')
  }

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const id = setInterval(async () => {
      try {
        const r = await fetch('/api/retna/events')
        const j = await r.json()
        const buyers = ['BuyerStress', 'BuyerA', 'BuyerB', 'BuyerSimA', 'BuyerSimB']
        const latest: Record<string, number> = {}
        for (const ev of j.events as any[]) {
          if (ev.type === 'purchase' && buyers.includes(ev.buyer)) {
            const t = Date.parse(ev.created_at)
            if (!latest[ev.buyer] || latest[ev.buyer] < t) latest[ev.buyer] = t
          }
        }
        const now = Date.now()
        const rem: Record<string, number> = {}
        for (const b of Object.keys(latest)) {
          const remaining = Math.max(0, Math.ceil((latest[b] + cooldownSec * 1000 - now) / 1000))
          rem[b] = remaining
        }
        setBuyerCooldowns(rem)
      } catch {
        // ignore
      }
    }, 3000)
    return () => clearInterval(id)
  }, [cooldownSec])

  const exportLogs = () => {
    const text = logs.map((l) => `[${l.ts}] (${l.level}) ${l.msg}`).join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `retinacloak-dev-logs-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const burstTest = async () => {
    const buyer = 'BurstBuyer'
    const starts: number[] = []
    const ends: number[] = []
    const calls = Array.from({ length: 20 }, () => {
      const s = performance.now(); starts.push(s)
      return fetch('/api/retna/purchase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ buyer, amount: 1 }) }).then(async (r) => {
        ends.push(performance.now());
        const txt = await r.text()
        const lvl = levelForStatus(r.status)
        log(`Burst ${r.status} ${txt}`, lvl)
        return r.status
      })
    })
    const res = await Promise.all(calls)
    let ok = 0, warn = 0, err = 0
    for (const st of res) {
      const lvl = levelForStatus(st)
      if (lvl === 'success') ok++
      else if (lvl === 'warning') warn++
      else err++
    }
    const lats = ends.map((e, i) => e - starts[i]).filter((v) => !isNaN(v))
    const avg = lats.length ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : 0
    const max = lats.length ? Math.round(Math.max(...lats)) : 0
    log(`Burst summary ok=${ok} warn=${warn} err=${err} avg=${avg}ms max=${max}ms`, err ? 'error' : 'info')
    lastAction.current = burstTest
  }

  const runRegression = async () => {
    let passed = 0, total = 0
    const expect = (cond: boolean, label: string) => { total++; cond ? (passed++, log(`PASS ${label}`, 'success')) : log(`FAIL ${label}`, 'error') }
    await fetch('/api/retna/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tokenMint: 'Mint', saleStartISO: new Date().toISOString(), durationSec: 3600, minPerWallet: 10, maxPerWallet: 2, cooldownSec: 5, whitelistEnabled: false, whitelistAddresses: [] }) })
    const rA = await fetch('/api/retna/purchase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ buyer: 'RegA', amount: 1 }) })
    const rB = await fetch('/api/retna/purchase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ buyer: 'RegB', amount: 1 }) })
    expect(rA.status === 200 || rB.status === 200, 'per-slot one success')
    const rC1 = await fetch('/api/retna/purchase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ buyer: 'RegC', amount: 1 }) })
    const rC2 = await fetch('/api/retna/purchase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ buyer: 'RegC', amount: 1 }) })
    log(`cooldown first=${rC1.status} second=${rC2.status}`)
    expect(rC2.status === 429, 'cooldown enforced')
    const rOr = await fetch('/api/retna/metrics?fail=1')
    const jOr = await rOr.json()
    expect(jOr.rateUsdPerSol === 200, 'oracle fallback')
    await fetch('/api/retna/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tokenMint: 'Mint', saleStartISO: new Date().toISOString(), durationSec: 3600, minPerWallet: 10, maxPerWallet: 10, cooldownSec: 5, whitelistEnabled: true, whitelistAddresses: ['RegW'] }) })
    const rWok = await fetch('/api/retna/purchase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ buyer: 'RegW', amount: 1 }) })
    const rWno = await fetch('/api/retna/purchase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ buyer: 'RegX', amount: 1 }) })
    expect(rWok.status === 200 && rWno.status === 403, 'whitelist enforced')
    log(`Regression ${passed}/${total}`, passed === total ? 'success' : 'error')
    lastAction.current = runRegression
  }

  const replayEvents = async () => {
    if (!supabase) { log('Supabase not configured', 'warning'); return }
    try {
      const { data } = await supabase.from('retna_events').select('type,buyer,created_at').order('created_at', { ascending: false }).limit(3)
      if (!data || !data.length) { log('No events to replay', 'warning'); return }
      const payloads = data.map((d: any) => ({ type: d.type, buyer: d.buyer, created_at: new Date().toISOString() }))
      const ins = await supabase.from('retna_events').insert(payloads)
      if ((ins as any).error) log('Replay insert failed', 'error')
      else log(`Replayed ${payloads.length} events`, 'success')
      lastAction.current = replayEvents
    } catch {
      log('Replay error', 'error')
    }
  }

  const memoryReset = async () => {
    const r = await fetch('/api/retna/dev/reset', { method: 'POST' })
    log(`Memory reset status=${r.status}`, levelForStatus(r.status))
    const name = 'BuyerStress'
    const r1 = await fetch('/api/retna/purchase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ buyer: name, amount: 1 }) })
    log(`After reset #1: ${r1.status} ${await r1.text()}`, levelForStatus(r1.status))
    const r2 = await fetch('/api/retna/purchase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ buyer: name, amount: 1 }) })
    log(`After reset #2: ${r2.status} ${await r2.text()}`, levelForStatus(r2.status))
    lastAction.current = memoryReset
  }

  const injectError = async () => {
    const r = await fetch('/api/retna/dev/error')
    log(`Injected error status=${r.status} ${await r.text()}`, levelForStatus(r.status))
    lastAction.current = injectError
  }

  const eventFlood = async () => {
    if (!supabase) { log('Supabase not configured', 'warning'); return }
    try {
      const now = Date.now()
      const payloads = Array.from({ length: 120 }, (_, i) => ({ type: 'flood', buyer: `Flood${i % 3}`, created_at: new Date(now + i).toISOString() }))
      const res = await supabase.from('retna_events').insert(payloads)
      if ((res as any).error) log('Event flood failed', 'error')
      else log(`Event flood inserted ${payloads.length}`, 'success')
      lastAction.current = eventFlood
    } catch {
      log('Event flood error', 'error')
    }
  }

  const loadTest100 = async () => {
    const buyer = 'LoadBuyer'
    const starts: number[] = []
    const ends: number[] = []
    const calls = Array.from({ length: 100 }, () => {
      const s = performance.now(); starts.push(s)
      return fetch('/api/retna/purchase', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ buyer, amount: 1 }) }).then(async (r) => {
        ends.push(performance.now())
        const txt = await r.text()
        const lvl = levelForStatus(r.status)
        log(`LoadTest ${r.status} ${txt}`, lvl)
        return r.status
      })
    })
    const res = await Promise.all(calls)
    let ok = 0, warn = 0, err = 0
    for (const st of res) {
      const lvl = levelForStatus(st)
      if (lvl === 'success') ok++
      else if (lvl === 'warning') warn++
      else err++
    }
    const lats = ends.map((e, i) => e - starts[i]).filter((v) => !isNaN(v))
    const avg = lats.length ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : 0
    const max = lats.length ? Math.round(Math.max(...lats)) : 0
    log(`LoadTest summary ok=${ok} warn=${warn} err=${err} avg=${avg}ms max=${max}ms`, err ? 'error' : 'info')
    lastAction.current = loadTest100
  }

  const adapterCheck = async () => {
    const ua = navigator.userAgent
    const isPhantom = typeof (window as any).solana !== 'undefined' && (((window as any).solana?.isPhantom) || ((window as any).phantom?.solana?.isPhantom))
    const isSolflare = typeof (window as any).solflare !== 'undefined'
    const name = wallet?.adapter?.name || 'unknown'
    const pk = publicKey ? publicKey.toBase58() : 'not connected'
    log(`Adapter UA=${ua}`, 'info')
    log(`Detected Phantom=${String(isPhantom)} Solflare=${String(isSolflare)} current=${name} connected=${String(connected)} pk=${pk}`, connected ? 'success' : 'warning')
    lastAction.current = adapterCheck
  }

  const exportFullAudit = async () => {
    let eventsText = ''
    try {
      if (supabase) {
        const { data } = await supabase.from('retna_events').select('*').order('created_at', { ascending: false }).limit(500)
        if (data && data.length) {
          eventsText = data.map((d: any) => `${d.created_at} ${d.type} ${d.buyer || ''}`).join('\n')
        }
      }
    } catch {}
    const logsText = logs.map((l) => `[${l.ts}] (${l.level}) ${l.msg}`).join('\n')
    const combined = `=== TestHarness Logs ===\n${logsText}\n\n=== Supabase retna_events ===\n${eventsText || 'none'}\n`
    const blob = new Blob([combined], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `retinacloak-full-audit-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
    log('Full audit exported', 'success')
    lastAction.current = exportFullAudit
  }

  if (!import.meta.env.DEV) return null

  return (
    <div className="glass-card p-6 mt-6">
      <div className="mb-3 text-lg font-semibold">TestHarness (dev-only)</div>
      <div className="flex flex-wrap gap-3">
        <button aria-label="Simulate Per-Slot Collision" className="btn-neon-blue" onClick={simulatePerSlot}>Simulate Per-Slot Collision</button>
        <button aria-label="Force Oracle Failure" className="btn-neon-purple" onClick={forceOracleFailure}>Force Oracle Failure</button>
        <button aria-label="Toggle Whitelist" className="btn-neon-orange" onClick={toggleWhitelist}>Toggle Whitelist</button>
        <button aria-label="Cooldown Stress" className="btn-neon-purple" onClick={cooldownStress}>Cooldown Stress</button>
        <button aria-label="Reconnect Supabase" className="btn-neon-blue" onClick={reconnectSupabase}>Reconnect Supabase</button>
        <button aria-label="Replay Last Test" className="btn-neon-blue" onClick={replayLast}>Replay Last Test</button>
        <button aria-label="Export Logs" className="btn-neon-orange" onClick={exportLogs}>Export Logs</button>
        <button aria-label="Burst Test" className="btn-neon-purple" onClick={burstTest}>Burst Test</button>
        <button aria-label="Run Regression Suite" className="btn-neon-blue" onClick={runRegression}>Run Regression Suite</button>
        <button aria-label="Replay Events" className="btn-neon-orange" onClick={replayEvents}>Replay Events</button>
        <button aria-label="Simulate Memory Reset" className="btn-neon-blue" onClick={memoryReset}>Simulate Memory Reset</button>
        <button aria-label="Inject Error" className="btn-neon-purple" onClick={injectError}>Inject Error</button>
        <button aria-label="Event Flood" className="btn-neon-orange" onClick={eventFlood}>Event Flood</button>
        <button aria-label="Load Test 100+" className="btn-neon-purple" onClick={loadTest100}>Load Test 100+</button>
        <button aria-label="Adapter Check" className="btn-neon-blue" onClick={adapterCheck}>Adapter Check</button>
        <button aria-label="Export Full Audit" className="btn-neon-orange" onClick={exportFullAudit}>Export Full Audit</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <div className="glass-card p-3">
          <button className="text-sm font-semibold mb-2" onClick={() => setMetricsOpen(!metricsOpen)}>Metrics Overlay {metricsOpen ? '▲' : '▼'}</button>
          {metricsOpen && (
            <div>
              <div className="text-xs">CooldownSec: {cooldownSec}s</div>
              <div className="text-xs">Whitelist: {whitelist.join(', ') || 'none'}</div>
              <div className="text-xs">Per-slot enforcement: {perSlotStatus}</div>
              <div className="mt-2 text-xs">Buyer cooldowns:</div>
              <ul className="text-xs space-y-1 mt-1">
                {Object.entries(buyerCooldowns).map(([b, v]) => (
                  <li key={b}>{b}: {v}s</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <div className="log-box mt-4 max-h-64 overflow-auto">
        <button className="text-sm font-semibold px-3 py-2" onClick={() => setLogsOpen(!logsOpen)}>Logs {logsOpen ? '▲' : '▼'}</button>
        {logsOpen && <ul className="p-3 space-y-2">
          {logs.map((l, i) => (
            <li key={i} className="text-sm text-white/90 flex items-center gap-2">
              <span className={`${l.level === 'success' ? 'bg-green-500' : l.level === 'warning' ? 'bg-yellow-500' : l.level === 'error' ? 'bg-red-500' : 'bg-slate-500'} text-black px-2 py-0.5 rounded-full text-xs`}>{l.level}</span>
              <span>[{l.ts}] {l.msg}</span>
            </li>
          ))}
        </ul>}
      </div>
    </div>
  )
}
