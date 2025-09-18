// services/binanceService.ts
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

export interface TradingPair {
  symbol: string
  baseAsset: string
  quoteAsset: string
}

export const fetchTradingPairs = async (): Promise<TradingPair[]> => {
  const response = await fetch('https://api.binance.com/api/v3/exchangeInfo')
  const data = await response.json()

  return data.symbols
    .filter((s: any) => s.status === 'TRADING' && s.isSpotTradingAllowed)
    .map((s: any) => ({
      symbol: s.symbol,
      baseAsset: s.baseAsset,
      quoteAsset: s.quoteAsset
    }))
}

export function subscribeKlines(
  symbol: string,
  interval: string,
  cb: (data: CandlestickData, currentSymbol: string) => void
) {
  const ws = new WebSocket(
    `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`
  )

  ws.onopen = () => {
    console.log(`WebSocket opened for ${symbol}@kline_${interval}`)
  }

  ws.onmessage = (event: MessageEvent) => {
    // Kiểm tra trạng thái WebSocket trước khi xử lý
    if (ws.readyState !== WebSocket.OPEN) return

    const msg = JSON.parse(event.data)
    if (msg.k) {
      const k = msg.k
      cb(
        {
          time: Math.floor(k.t / 1000),
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
          volume: parseFloat(k.v)
        },
        symbol
      )
    }
  }

  ws.onerror = error => {
    console.error(`WebSocket error for ${symbol}:`, error)
  }

  ws.onclose = () => {
    console.log(`WebSocket closed for ${symbol}`)
  }

  // Hàm đóng WebSocket với Promise để đảm bảo đóng hoàn toàn
  const closeWebSocket = () => {
    return new Promise<void>(resolve => {
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.onclose = () => {
          console.log(`WebSocket fully closed for ${symbol}`)
          resolve()
        }
        ws.close()
      } else {
        resolve()
      }
    })
  }

  return closeWebSocket
}

export const fetchHistoricalKlines = async (
  symbol: string,
  interval: string,
  limit: number,
  endTime?: number
): Promise<CandlestickData[]> => {
  let url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  if (endTime) {
    url += `&endTime=${endTime}`
  }
  const response = await fetch(url)
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
