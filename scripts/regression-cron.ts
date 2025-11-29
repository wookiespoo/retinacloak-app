import { setTimeout as delay } from 'timers/promises'
import { exec } from 'child_process'

function runRegression() {
  return new Promise<void>((resolve, reject) => {
    const p = exec('npm run regression:dev')
    p.on('exit', (code) => code === 0 ? resolve() : reject(new Error('regression exit ' + code)))
  })
}

async function scheduler() {
  if (process.env.NODE_ENV === 'production') return
  while (true) {
    const now = new Date()
    const next = new Date(now)
    next.setDate(now.getDate() + 1)
    next.setHours(2, 0, 0, 0) // 2:00 AM local
    const ms = next.getTime() - now.getTime()
    await delay(ms)
    try { await runRegression() } catch {}
  }
}

scheduler()
