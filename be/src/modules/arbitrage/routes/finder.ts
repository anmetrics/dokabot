import { ethers } from 'ethers';

const ROUTERS = [
  '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2
  '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F', // SushiSwap
];

const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

export interface Route {
  path: string[];
  amountOut: bigint;
  router: string;
  hops: number;
  minProfit: bigint;
}

export async function findBestRoute(
  provider: ethers.Provider,
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
): Promise<Route | null> {
  const routes: Route[] = [];

  for (const routerAddr of ROUTERS) {
    const router = new ethers.Contract(
      routerAddr,
      ['function getAmountsOut(uint256,address[]) view returns (uint256[])'],
      provider,
    );

    const tryPush = async (path: string[], hops: number) => {
      try {
        const amounts: bigint[] = await router.getAmountsOut(amountIn, path); // ethers v6 trả bigint
        if (amounts.length === 0) return;

        // Chọn minProfit theo mode
        const minProfit =
          hops === 1
            ? ethers.parseEther(process.env.MIN_PROFIT_MODE_A || '0.008') // mode A: 1 hop
            : ethers.parseEther(process.env.MIN_PROFIT_MODE_B || '0.02'); // mode B: multi-hop

        routes.push({
          path,
          amountOut: amounts[amounts.length - 1],
          router: routerAddr,
          hops,
          minProfit,
        });
      } catch (err) {
        console.error(
          `getAmountsOut failed for path ${path.join(' -> ')}`,
          err,
        );
      }
    };

    // Tạo các route khả thi
    if (tokenIn !== tokenOut) await tryPush([tokenIn, tokenOut], 1);
    if (tokenIn !== WETH && tokenOut !== WETH)
      await tryPush([tokenIn, WETH, tokenOut], 2);
    if (tokenIn !== USDC && tokenOut !== WETH)
      await tryPush([tokenIn, USDC, WETH, tokenOut], 3);
  }

  // Tính repay minimum (Uniswap V2 fee)
  const fee = (amountIn * 3n) / 997n + 1n;
  const minRepay = amountIn + fee;

  // Filter các route đủ lợi nhuận
  const profitableRoutes = routes.filter(
    (r) => r.amountOut >= minRepay + r.minProfit,
  );

  if (profitableRoutes.length === 0) return null;

  // Sắp xếp theo amountOut (bigint)
  profitableRoutes.sort((a, b) =>
    b.amountOut > a.amountOut ? 1 : b.amountOut < a.amountOut ? -1 : 0,
  );

  return profitableRoutes[0];
}
