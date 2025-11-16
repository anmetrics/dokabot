import { Injectable, Logger } from '@nestjs/common';
import { EthereumProvider } from '../providers/ethereum.provider';
import { FlashDualArb } from '../contracts/FlashDualArb';
import { ethers } from 'ethers';
import { findBestRoute } from '../routes/finder';
import { getAvailableLiquidity } from '../utils';

const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const GAS_BUFFER = 1.1; // Tăng 10% gas để chắc ăn
const MIN_PROFIT_USDT = 0.1; // Lợi nhuận tối thiểu
const BASE_SWAP_GAS = 70000;
const OVERHEAD = 10000;

@Injectable()
export class MempoolListener {
  private readonly logger = new Logger('ARB-BOT');
  private contract: FlashDualArb;
  private gasPrice: bigint = 0n;

  constructor(private eth: EthereumProvider) {
    this.contract = new FlashDualArb(
      process.env.CONTRACT_ADDRESS!,
      eth.getWallet(),
    );
    this.startGasPriceUpdater();
  }

  start() {
    this.logger.log('Bot STARTED - Listening mempool...');
    const provider = this.eth.getProvider();

    // Lắng nghe transaction pending
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    provider.on('pending', async (txHash: string) => {
      if (!this.gasPrice || this.gasPrice === 0n) {
        this.logger.debug('Gas price chưa cập nhật, skip tx');
        return;
      }

      try {
        const tx = await provider.getTransaction(txHash);
        if (!tx || !tx.to || (tx.value || 0n) > 0n) return;

        const router = tx.to.toLowerCase();
        if (!['0x7a250d', '0xd9e1ce'].some((r) => router.includes(r))) return;

        const decoded = this.decodeSwap(tx.data);
        if (!decoded || decoded.amountIn < ethers.parseEther('5')) return;

        await this.tryArb(decoded.tokenIn, decoded.tokenOut, decoded.amountIn);
      } catch (e) {
        this.logger.error('Failed to process pending tx', e);
      }
    });
  }

  private startGasPriceUpdater() {
    const provider = this.eth.getProvider();
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    setInterval(async () => {
      try {
        const feeData = await provider.getFeeData();
        if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
          this.gasPrice = BigInt(
            Math.floor(Number(feeData.maxFeePerGas) * GAS_BUFFER),
          );
        } else if (feeData.gasPrice) {
          this.gasPrice = BigInt(
            Math.floor(Number(feeData.gasPrice) * GAS_BUFFER),
          );
        }
        this.logger.debug(`Updated gasPrice: ${this.gasPrice} wei`);
      } catch (e) {
        this.logger.error('Failed to update gas price', e);
      }
    }, 1000);
  }

  private decodeSwap(data: string) {
    if (!data.startsWith('0x38ed1739')) return null;
    try {
      const iface = new ethers.Interface([
        'function swapExactTokensForTokens(uint256,uint256,address[],address,uint256)',
      ]);
      const d = iface.decodeFunctionData('swapExactTokensForTokens', data);
      return {
        amountIn: d[0] as bigint,
        path: d[2] as string[],
        tokenIn: d[2][0] as string,
        tokenOut: d[2][d[2].length - 1] as string,
      };
    } catch (e) {
      this.logger.error('decodeSwap failed', e);
      return null;
    }
  }

  private estimateGasForRoute(route: any, amountIn: bigint) {
    const hops = route.hops || 1;
    let gas = BASE_SWAP_GAS * hops + OVERHEAD;
    if (amountIn > 1_000_000n * 1_000_000_000_000_000_000n) {
      gas = Math.floor(gas * 1.05);
    }
    return gas;
  }

  private async profitInUSDT(
    provider: ethers.Provider,
    token: string,
    amount: bigint,
  ) {
    if (token.toLowerCase() === USDT_ADDRESS.toLowerCase()) {
      return Number(ethers.formatUnits(amount, 6));
    }
    const bestRoute = await findBestRoute(
      provider,
      token,
      USDT_ADDRESS,
      amount,
    );
    if (!bestRoute) return 0;
    return Number(ethers.formatUnits(bestRoute.amountOut, 6));
  }

  private getPair(t0: string, t1: string): string {
    const pairCode = ethers.solidityPackedKeccak256(
      ['address', 'address'],
      [t0 < t1 ? t0 : t1, t0 < t1 ? t1 : t0],
    );
    return ethers.getAddress(`0x${pairCode.slice(-40)}`);
  }

  private async calcBorrow(pair: string, token: string, amount: bigint) {
    const token0 = await new ethers.Contract(
      pair,
      ['function token0() view returns (address)'],
      this.eth.getProvider(),
    ).token0();
    return token.toLowerCase() === token0.toLowerCase()
      ? { a0: amount, a1: 0n }
      : { a0: 0n, a1: amount };
  }

  // Hàm tính vốn cần vay dựa trên lợi nhuận mục tiêu
  private calcBorrowAmount(
    targetProfit: number,
    profitRate: number,
    gasCost: bigint,
  ): bigint {
    const targetProfitWei = ethers.parseUnits(targetProfit.toString(), 18); // giả sử token chính 18 decimals
    const borrowAmount =
      BigInt(Math.floor(Number(targetProfitWei) / profitRate)) + gasCost;
    return borrowAmount;
  }

  async tryArb(tokenIn: string, tokenOut: string, amountIn: bigint) {
    const provider = this.eth.getProvider();
    const route = await findBestRoute(provider, tokenIn, tokenOut, amountIn);
    if (!route) return;

    const gasEstimate = this.estimateGasForRoute(route, amountIn);
    const gasCost = BigInt(gasEstimate) * this.gasPrice;

    const fee = (amountIn * 3n) / 997n + 1n;
    const repay = amountIn + fee;
    const profitToken = route.path[route.path.length - 1];
    const expectedProfit = route.amountOut - repay - gasCost;

    if (expectedProfit <= 0n) return;

    const profitUSDT = await this.profitInUSDT(
      provider,
      profitToken,
      expectedProfit,
    );
    if (profitUSDT < MIN_PROFIT_USDT) return;

    // Tính profit rate và borrowAmount
    const profitRate =
      Number(route.amountOut - repay - gasCost) / Number(amountIn);
    const borrowAmount = this.calcBorrowAmount(
      MIN_PROFIT_USDT,
      profitRate,
      gasCost,
    );

    this.logger.log(
      `ARB! Est Profit: ${ethers.formatUnits(expectedProfit, 18)} ${profitToken} (~${profitUSDT.toFixed(
        2,
      )} USDT) | BorrowAmount: ${ethers.formatUnits(borrowAmount, 18)} | Hops: ${route.hops} | GasCost: ${ethers.formatEther(gasCost)} ETH`,
    );

    const pair = this.getPair(tokenIn, tokenOut);
    const available = await getAvailableLiquidity(provider, pair, tokenIn);
    if (available < borrowAmount) {
      this.logger.log('Pool không đủ liquidity, bỏ qua');
      return;
    }

    const { a0, a1 } = await this.calcBorrow(pair, tokenIn, borrowAmount);

    try {
      const tx =
        route.hops === 1
          ? await this.contract.populateStart({
              pair,
              amount0Out: a0,
              amount1Out: a1,
              route: route.path,
              repayToken: tokenOut,
              router: route.router,
              minProfit: (expectedProfit * 9n) / 10n,
            })
          : await this.contract.populateStartMulti({
              pair,
              amount0Out: a0,
              amount1Out: a1,
              routes: [
                {
                  path: route.path,
                  amountOutMin: (route.amountOut * 95n) / 100n,
                },
              ],
              repayToken: tokenOut,
              router: route.router,
              minProfit: (expectedProfit * 9n) / 10n,
            });

      if (this.eth.getFlashbots()) {
        await this.eth.sendFlashbots(tx);
        this.logger.log('TX SENT VIA FLASHBOTS');
      } else {
        await this.eth.getWallet().sendTransaction(tx);
        this.logger.log('TX SENT PUBLIC');
      }
    } catch (e: any) {
      this.logger.error('TX FAILED', e.message);
    }
  }
}
