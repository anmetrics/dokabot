import { CandlestickData } from 'lightweight-charts'

export interface Candle {
  startTime: number
  open: string
  high: string
  low: string
  close: string
  volume: string
  closeTime: number
}

export function subscribeKlines(
  symbol: string,
  interval: string,
  cb: (data: CandlestickData) => void
) {
  const ws = new WebSocket(
    `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`
  )

  ws.onmessage = (event: MessageEvent) => {
    const msg = JSON.parse(event.data)

    if (msg.k) {
      const k = msg.k
      cb({
        time: Math.floor(k.t / 1000), // Convert milliseconds to seconds
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v) // Include volume for consistency
      })
    }
  }

  return () => ws.close() // Return function to close WebSocket connection
}

export const fetchHistoricalKlines = async (
  symbol: string,
  interval: string,
  limit: number
): Promise<CandlestickData[]> => {
  const response = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  )
  const data = await response.json()

  return data.map(
    ([startTime, open, high, low, close, volume]: [
      number,
      string,
      string,
      string,
      string,
      string
    ]) => ({
      time: Math.floor(startTime / 1000), // Convert milliseconds to seconds
      open: parseFloat(open),
      high: parseFloat(high),
      low: parseFloat(low),
      close: parseFloat(close),
      volume: parseFloat(volume)
    })
  )
}
