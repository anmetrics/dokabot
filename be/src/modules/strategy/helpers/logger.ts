export function formatProfitLog(log: any): string {
  let text = '';

  for (const symbolData of log.symbols) {
    const { symbol, sellSummary, openPositions } = symbolData;

    text += `📊 ${symbol}\n`;

    if (sellSummary) {
      text +=
        `  💰 Sell Summary\n` +
        `  • Total Sell Count: ${sellSummary.totalSellCount}\n` +
        `  • Total Profit: ${sellSummary.totalProfit.toFixed(4)} USDT\n` +
        `  • Total Revenue: ${sellSummary.totalRevenue.toFixed(4)} USDT\n` +
        `  • Total Spent: ${sellSummary.totalSpent.toFixed(4)} USDT\n`;
    } else {
      text += `  ⚠️ No sell records found\n`;
    }

    if (openPositions) {
      text +=
        `\n  📈 Open Positions\n` +
        `  • Total Qty: ${openPositions.totalQty.toFixed(8)}\n` +
        `  • Avg Buy Price: ${openPositions.avgBuyPrice.toFixed(4)}\n` +
        `  • Current Price: ${openPositions.currentPrice.toFixed(4)}\n` +
        `  • Spent (Open): ${openPositions.totalSpentOpen.toFixed(4)} USDT\n` +
        `  • Current Value: ${openPositions.currentValue.toFixed(4)} USDT\n` +
        `  • Unrealized PnL: ${openPositions.unrealizedPnL.toFixed(4)} USDT\n`;
    } else {
      text += `\n  💤 No open positions\n`;
    }

    text += '\n';
    text += '-------------------------------\n';
  }

  const grand = log.grandTotal;
  text += `🏁 Grand Total\n`;
  text +=
    `  • Total Profit: ${grand.totalProfit.toFixed(4)} USDT\n` +
    `  • Total Revenue: ${grand.totalRevenue.toFixed(4)} USDT\n` +
    `  • Total Spent: ${grand.totalSpent.toFixed(4)} USDT\n`;

  return text;
}
