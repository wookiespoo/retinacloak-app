export type SaleConfig = {
  tokenMint: string
  saleStartISO: string
  durationSec: number
  minPerWallet: number
  maxPerWallet: number
  cooldownSec: number
  whitelistEnabled: boolean
  whitelistAddresses: string[]
}

export type PurchaseRequest = {
  buyer: string
  amount: number
}

export type FeeQuote = {
  recipient: string
  feeLamports: number
  rateUsdPerSol: number
}
