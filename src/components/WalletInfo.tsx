import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { useEffect, useState } from 'react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'

export default function WalletInfo() {
  const { connection } = useConnection()
  const { publicKey } = useWallet()
  const [sol, setSol] = useState<number | null>(null)

  useEffect(() => {
    ;(async () => {
      if (!publicKey) { setSol(null); return }
      const lamports = await connection.getBalance(publicKey)
      setSol(lamports / LAMPORTS_PER_SOL)
    })()
  }, [publicKey, connection])

  const short = publicKey ? `${publicKey.toBase58().slice(0,6)}...${publicKey.toBase58().slice(-4)}` : 'Wallet not connected'
  const balance = sol !== null ? `${sol.toFixed(2)} SOL` : ''

  return (
    <div className="text-right text-white/90 backdrop-blur bg-white/10 rounded-lg px-4 py-2 border border-white/15">
      <div>{short}</div>
      {balance && <div>{balance}</div>}
    </div>
  )
}
