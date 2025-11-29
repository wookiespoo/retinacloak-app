import fs from 'fs'

async function run() {
  const logs: string[] = []
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = 'logs'
  try { fs.mkdirSync(dir, { recursive: true }) } catch {}

  const post = (path: string, body: any) => fetch(`http://localhost:5174${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const get = (path: string) => fetch(`http://localhost:5174${path}`)

  const log = (m: string) => { logs.push(`[${new Date().toISOString()}] ${m}`) }

  await post('/api/retna/dev/reset', {})
  await post('/api/retna/rules', { tokenMint: 'Mint', saleStartISO: new Date().toISOString(), durationSec: 3600, minPerWallet: 10, maxPerWallet: 2, cooldownSec: 5, whitelistEnabled: false, whitelistAddresses: [] })

  // Regression Suite
  const rA = await post('/api/retna/purchase', { buyer: 'RegA', amount: 1 })
  const rB = await post('/api/retna/purchase', { buyer: 'RegB', amount: 1 })
  log(`per-slot: A=${rA.status} B=${rB.status}`)
  const rC1 = await post('/api/retna/purchase', { buyer: 'RegC', amount: 1 })
  const rC2 = await post('/api/retna/purchase', { buyer: 'RegC', amount: 1 })
  log(`cooldown: C1=${rC1.status} C2=${rC2.status}`)
  const rOr = await get('/api/retna/metrics?fail=1')
  const jOr = await rOr.json()
  log(`oracle fallback rateUsdPerSol=${jOr.rateUsdPerSol}`)
  await post('/api/retna/rules', { tokenMint: 'Mint', saleStartISO: new Date().toISOString(), durationSec: 3600, minPerWallet: 10, maxPerWallet: 10, cooldownSec: 5, whitelistEnabled: true, whitelistAddresses: ['RegW'] })
  const rWok = await post('/api/retna/purchase', { buyer: 'RegW', amount: 1 })
  const rWno = await post('/api/retna/purchase', { buyer: 'RegX', amount: 1 })
  log(`whitelist: Wok=${rWok.status} Wno=${rWno.status}`)

  // Load Test 100+
  await post('/api/retna/dev/reset', {})
  await post('/api/retna/rules', { tokenMint: 'Mint', saleStartISO: new Date().toISOString(), durationSec: 3600, minPerWallet: 100, maxPerWallet: 100, cooldownSec: 5, whitelistEnabled: false, whitelistAddresses: [] })
  const buyer = 'LoadBuyer'
  const starts: number[] = []
  const ends: number[] = []
  const calls = Array.from({ length: 100 }, () => {
    const s = performance.now(); starts.push(s)
    return post('/api/retna/purchase', { buyer, amount: 1 }).then(async (r) => {
      ends.push(performance.now())
      return r.status
    })
  })
  const res = await Promise.all(calls)
  let ok = 0, warn = 0, err = 0
  for (const st of res) {
    if (st >= 200 && st < 300) ok++
    else if (st === 429) warn++
    else err++
  }
  const lats = ends.map((e, i) => e - starts[i]).filter((v) => !isNaN(v))
  const avg = lats.length ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : 0
  const max = lats.length ? Math.round(Math.max(...lats)) : 0
  log(`load100: ok=${ok} warn=${warn} err=${err} avg=${avg}ms max=${max}ms`)

  const out = `${dir}/nightly-${ts}.txt`
  fs.writeFileSync(out, logs.join('\n'))
  console.log(out)
}

run().catch((e) => { console.error(e) })
