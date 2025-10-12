import Decimal from 'decimal.js';
import { Order } from 'binance-api-node';

export const getActualBoughtQtyAndFee = (
  order: Order,
): { totalQty: number; totalFee: number } => {
  if (!order || !order.fills || order.fills.length === 0) {
    return { totalQty: 0, totalFee: 0 };
  }

  let totalQty = new Decimal(0);
  let totalFee = new Decimal(0);

  for (const fill of order.fills) {
    const qty = new Decimal(fill.qty);
    const commission = new Decimal(fill.commission);
    totalQty = totalQty.plus(qty.minus(commission));
    totalFee = totalFee.plus(commission);
  }

  return {
    totalQty: totalQty.toNumber(),
    totalFee: totalFee.toNumber(),
  };
};
