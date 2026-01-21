import type { CandlestickData } from "lightweight-charts";

export interface Candle {
  startTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
}

export interface TradingPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
}

export interface TickerData {
  symbol: string;
  price: number;
  priceChange: number;
  priceChangePercent: number;
  high: number;
  low: number;
  volume: number;
  quoteVolume: number;
}

export interface DepthData {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
}

export interface TradeData {
  id: string;
  price: number;
  quantity: number;
  time: number;
  isBuyerMaker: boolean;
}

export const fetchTradingPairs = async (): Promise<TradingPair[]> => {
  const response = await fetch("https://api.binance.com/api/v3/exchangeInfo");
  const data = await response.json();

  return data.symbols
    .filter((s: any) => s.status === "TRADING" && s.isSpotTradingAllowed)
    .map((s: any) => ({
      symbol: s.symbol,
      baseAsset: s.baseAsset,
      quoteAsset: s.quoteAsset,
    }));
};

export function subscribeKlines(
  symbol: string,
  interval: string,
  cb: (data: CandlestickData, currentSymbol: string) => void
) {
  const ws = new WebSocket(
    `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`
  );

  ws.onopen = () => {
    console.log(`WebSocket opened for ${symbol}@kline_${interval}`);
  };

  ws.onmessage = (event: MessageEvent) => {
    // Kiểm tra trạng thái WebSocket trước khi xử lý
    if (ws.readyState !== WebSocket.OPEN) return;

    const msg = JSON.parse(event.data);
    if (msg.k) {
      const k = msg.k;
      cb(
        {
          time: Math.floor(k.t / 1000),
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
          volume: parseFloat(k.v),
        },
        symbol
      );
    }
  };

  ws.onerror = (error) => {
    console.error(`WebSocket error for ${symbol}:`, error);
  };

  ws.onclose = () => {
    console.log(`WebSocket closed for ${symbol}`);
  };

  // Hàm đóng WebSocket với Promise để đảm bảo đóng hoàn toàn
  const closeWebSocket = () => {
    return new Promise<void>((resolve) => {
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.onclose = () => {
          console.log(`WebSocket fully closed for ${symbol}`);
          resolve();
        };
        ws.close();
      } else {
        resolve();
      }
    });
  };

  return closeWebSocket;
}

export const fetchHistoricalKlines = async (
  symbol: string,
  interval: string,
  limit: number,
  endTime?: number
): Promise<CandlestickData[]> => {
  let url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  if (endTime) {
    url += `&endTime=${endTime}`;
  }
  const response = await fetch(url);
  const data = await response.json();

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
      volume: parseFloat(volume),
    })
  );
};

// Fetch order book depth
export const fetchOrderBook = async (symbol: string, limit: number = 20): Promise<DepthData> => {
  const response = await fetch(
    `https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=${limit}`
  );
  const data = await response.json();
  return {
    lastUpdateId: data.lastUpdateId,
    bids: data.bids,
    asks: data.asks,
  };
};

// Subscribe to order book depth stream
export function subscribeDepth(
  symbol: string,
  cb: (data: DepthData) => void,
  updateSpeed: "100ms" | "1000ms" = "100ms"
) {
  const ws = new WebSocket(
    `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@depth@${updateSpeed}`
  );

  ws.onopen = () => {
    console.log(`Depth WebSocket opened for ${symbol}`);
  };

  ws.onmessage = (event: MessageEvent) => {
    if (ws.readyState !== WebSocket.OPEN) return;

    const msg = JSON.parse(event.data);
    cb({
      lastUpdateId: msg.u,
      bids: msg.b || [],
      asks: msg.a || [],
    });
  };

  ws.onerror = (error) => {
    console.error(`Depth WebSocket error for ${symbol}:`, error);
  };

  ws.onclose = () => {
    console.log(`Depth WebSocket closed for ${symbol}`);
  };

  const closeWebSocket = () => {
    return new Promise<void>((resolve) => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.onclose = () => {
          console.log(`Depth WebSocket fully closed for ${symbol}`);
          resolve();
        };
        ws.close();
      } else {
        resolve();
      }
    });
  };

  return closeWebSocket;
}

// Subscribe to trade stream
export function subscribeTrades(symbol: string, cb: (trade: TradeData) => void) {
  const ws = new WebSocket(
    `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@trade`
  );

  ws.onopen = () => {
    console.log(`Trade WebSocket opened for ${symbol}`);
  };

  ws.onmessage = (event: MessageEvent) => {
    if (ws.readyState !== WebSocket.OPEN) return;

    const msg = JSON.parse(event.data);
    cb({
      id: msg.t.toString(),
      price: parseFloat(msg.p),
      quantity: parseFloat(msg.q),
      time: msg.T,
      isBuyerMaker: msg.m,
    });
  };

  ws.onerror = (error) => {
    console.error(`Trade WebSocket error for ${symbol}:`, error);
  };

  ws.onclose = () => {
    console.log(`Trade WebSocket closed for ${symbol}`);
  };

  const closeWebSocket = () => {
    return new Promise<void>((resolve) => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.onclose = () => {
          console.log(`Trade WebSocket fully closed for ${symbol}`);
          resolve();
        };
        ws.close();
      } else {
        resolve();
      }
    });
  };

  return closeWebSocket;
}

// Subscribe to all mini tickers (for trading pairs list)
export function subscribeAllMiniTickers(cb: (tickers: TickerData[]) => void) {
  const ws = new WebSocket("wss://stream.binance.com:9443/ws/!miniTicker@arr");

  ws.onopen = () => {
    console.log("Mini ticker WebSocket opened");
  };

  ws.onmessage = (event: MessageEvent) => {
    if (ws.readyState !== WebSocket.OPEN) return;

    const data = JSON.parse(event.data);
    const tickers: TickerData[] = data.map((t: any) => ({
      symbol: t.s,
      price: parseFloat(t.c),
      priceChange: parseFloat(t.c) - parseFloat(t.o),
      priceChangePercent: ((parseFloat(t.c) - parseFloat(t.o)) / parseFloat(t.o)) * 100,
      high: parseFloat(t.h),
      low: parseFloat(t.l),
      volume: parseFloat(t.v),
      quoteVolume: parseFloat(t.q),
    }));
    cb(tickers);
  };

  ws.onerror = (error) => {
    console.error("Mini ticker WebSocket error:", error);
  };

  ws.onclose = () => {
    console.log("Mini ticker WebSocket closed");
  };

  const closeWebSocket = () => {
    return new Promise<void>((resolve) => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.onclose = () => {
          console.log("Mini ticker WebSocket fully closed");
          resolve();
        };
        ws.close();
      } else {
        resolve();
      }
    });
  };

  return closeWebSocket;
}

// Fetch 24h ticker for a symbol
export const fetch24hTicker = async (symbol: string): Promise<TickerData> => {
  const response = await fetch(
    `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`
  );
  const data = await response.json();
  return {
    symbol: data.symbol,
    price: parseFloat(data.lastPrice),
    priceChange: parseFloat(data.priceChange),
    priceChangePercent: parseFloat(data.priceChangePercent),
    high: parseFloat(data.highPrice),
    low: parseFloat(data.lowPrice),
    volume: parseFloat(data.volume),
    quoteVolume: parseFloat(data.quoteVolume),
  };
};

// Fetch recent trades
export const fetchRecentTrades = async (symbol: string, limit: number = 50): Promise<TradeData[]> => {
  const response = await fetch(
    `https://api.binance.com/api/v3/trades?symbol=${symbol}&limit=${limit}`
  );
  const data = await response.json();
  return data.map((t: any) => ({
    id: t.id.toString(),
    price: parseFloat(t.price),
    quantity: parseFloat(t.qty),
    time: t.time,
    isBuyerMaker: t.isBuyerMaker,
  }));
};
