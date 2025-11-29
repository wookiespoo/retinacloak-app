import type { VercelRequest, VercelResponse } from '@vercel/node'
// Inline constants to avoid cross-module runtime issues in serverless
const FALLBACK_RECIPIENT = 'B1vUK75FH7cBVJwtEs8KZr7d3MCUN2nTH9RdibFf1dfR'
const TEST_WALLET = '4x6gK28XpBDrJdgwBDDynrhhHxswYVyiHNTfikWjak7k'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const recipientEnv = process.env.FEE_RECIPIENT
  const recipient = process.env.NODE_ENV === 'production' ? (recipientEnv || FALLBACK_RECIPIENT) : TEST_WALLET
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 3000)
    const r = await fetch('https://price.jup.ag/v4/price?ids=SOL', { signal: controller.signal })
    clearTimeout(t)
    if (r.ok) {
      const j = await r.json()
      const rateUsdPerSol = j?.data?.SOL?.price ?? 200
      return res.status(200).json({ recipient, feeLamports: 1000, rateUsdPerSol })
    }
  } catch {}
  return res.status(200).json({ recipient, feeLamports: 1000, rateUsdPerSol: 200 })
}

