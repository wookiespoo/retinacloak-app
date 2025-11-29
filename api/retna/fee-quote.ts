import { FEE_RECIPIENT, TEST_WALLET } from '../../server/constants.js'

export default async function handler(_req: any, res: any) {
  const recipient = process.env.NODE_ENV === 'production'
    ? (process.env.FEE_RECIPIENT || FEE_RECIPIENT)
    : TEST_WALLET

  try {
    const r = await fetch('https://price.jup.ag/v4/price?ids=SOL')
    const j = r && r.ok ? await r.json() : null
    const rateUsdPerSol = j?.data?.SOL?.price ?? 200
    return res.status(200).json({ recipient, feeLamports: 1000, rateUsdPerSol })
  } catch (err) {
    return res.status(200).json({ recipient, feeLamports: 1000, rateUsdPerSol: 200 })
  }
}
