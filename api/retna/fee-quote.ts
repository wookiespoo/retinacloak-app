// Minimal, dependency-free handler to avoid runtime issues
const FALLBACK_RECIPIENT = 'B1vUK75FH7cBVJwtEs8KZr7d3MCUN2nTH9RdibFf1dfR'
const TEST_WALLET = '4x6gK28XpBDrJdgwBDDynrhhHxswYVyiHNTfikWjak7k'

export default async function handler(_req: any, res: any) {
  const recipientEnv = process.env.FEE_RECIPIENT
  const recipient = process.env.NODE_ENV === 'production' ? (recipientEnv || FALLBACK_RECIPIENT) : TEST_WALLET
  let rateUsdPerSol = 200
  try {
    const r = await fetch('https://price.jup.ag/v4/price?ids=SOL')
    if (r && r.ok) {
      const j = await r.json()
      const p = j?.data?.SOL?.price
      if (typeof p === 'number' && p > 0) rateUsdPerSol = p
    }
  } catch {}
  return res.status(200).json({ recipient, feeLamports: 1000, rateUsdPerSol })
}

