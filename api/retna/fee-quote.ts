import type { VercelRequest, VercelResponse } from '@vercel/node'
import { FEE_USD_PER_MIN, FEE_RECIPIENT, TEST_WALLET } from '../../server/constants'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const r = await fetch('https://price.jup.ag/v4/price?ids=SOL')
    const j = await r.json()
    const rateUsdPerSol = j?.data?.SOL?.price ?? 200
    const feeSol = FEE_USD_PER_MIN / rateUsdPerSol
    const feeLamports = Math.ceil(feeSol * 1_000_000_000)
    const recipientEnv = process.env.FEE_RECIPIENT
    const recipient = process.env.NODE_ENV === 'production' ? (recipientEnv || FEE_RECIPIENT) : TEST_WALLET
    res.status(200).json({ recipient, feeLamports, rateUsdPerSol })
  } catch {
    const recipientEnv = process.env.FEE_RECIPIENT
    const recipient = process.env.NODE_ENV === 'production' ? (recipientEnv || FEE_RECIPIENT) : TEST_WALLET
    res.status(200).json({ recipient, feeLamports: 1000, rateUsdPerSol: 200 })
  }
}

