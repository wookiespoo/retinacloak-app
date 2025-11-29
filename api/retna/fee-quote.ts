import type { VercelRequest, VercelResponse } from '@vercel/node'
import { FEE_USD_PER_MIN, FEE_RECIPIENT, TEST_WALLET } from '../../server/constants'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
    const j = await r.json()
    const rateUsdPerSol = j.solana?.usd || 200
    const feeSol = FEE_USD_PER_MIN / rateUsdPerSol
    const feeLamports = Math.ceil(feeSol * 1_000_000_000)
    const recipient = process.env.NODE_ENV === 'production' ? FEE_RECIPIENT : TEST_WALLET
    res.status(200).json({ recipient, feeLamports, rateUsdPerSol })
  } catch {
    const recipient = process.env.NODE_ENV === 'production' ? FEE_RECIPIENT : TEST_WALLET
    res.status(200).json({ recipient, feeLamports: 1000, rateUsdPerSol: 200 })
  }
}

