import Decimal from 'decimal.js';
import { Order } from 'binance-api-node';

export const getActualBought = (
  order: Order,
): {
  totalQty: number;
  totalFee: number;
  totalSpent: number;
  avgPrice: number;
} => {
  if (!order || !order.fills || order.fills.length === 0) {
    return { totalQty: 0, totalFee: 0, totalSpent: 0, avgPrice: 0 };
  }

  let totalQty = new Decimal(0);
  let totalFee = new Decimal(0);
  let totalSpent = new Decimal(0);

  for (const fill of order.fills) {
    const qty = new Decimal(fill.qty);
    const price = new Decimal(fill.price);
    const commission = new Decimal(fill.commission);

    totalQty = totalQty.plus(qty.minus(commission)); // thực nhận token
    totalFee = totalFee.plus(commission);
    totalSpent = totalSpent.plus(price.mul(qty)); // tổng tiền chi ra
  }
  const avgPrice = totalQty.gt(0) ? totalSpent.div(totalQty).toNumber() : 0;
  return {
    totalQty: totalQty.toNumber(),
    totalFee: totalFee.toNumber(),
    totalSpent: totalSpent.toNumber(),
    avgPrice,
  };
};

export const adjustToStepSize = (qty: number, symbol: string) => {
  let stepSize = 0.00001;

  if (symbol === 'BNBUSDT') {
    stepSize = 0.001;
  } else if (symbol === 'BTCUSDT') {
    stepSize = 0.00001;
  }

  return parseFloat(
    (Math.floor(qty / stepSize) * stepSize).toFixed(stepSize === 0.001 ? 3 : 5),
  );
};
