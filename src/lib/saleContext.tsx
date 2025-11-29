import { createContext, useContext, useMemo, useState } from 'react'

type SaleState = {
  saleStartISO: string
  durationSec: number
  setSale: (startISO: string, durationSec: number) => void
  isLive: boolean
  now: number
}

const Ctx = createContext<SaleState | null>(null)

export function SaleProvider({ children }: { children: React.ReactNode }) {
  const [saleStartISO, setStart] = useState<string>('')
  const [durationSec, setDur] = useState<number>(0)
  const [now, setNow] = useState<number>(Date.now())

  useMemo(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const setSale = (startISO: string, d: number) => {
    setStart(startISO)
    setDur(d)
  }

  const start = Date.parse(saleStartISO)
  const isLive = !!saleStartISO && !isNaN(start) && now >= start && now <= start + durationSec * 1000

  const value: SaleState = { saleStartISO, durationSec, setSale, isLive, now }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSale() {
  const v = useContext(Ctx)
  if (!v) throw new Error('SaleProvider missing')
  return v
}
