import { Injectable, Logger } from '@nestjs/common';
import { EthereumProvider } from '../providers/ethereum.provider';
import { FlashDualArb } from '../contracts/FlashDualArb';
import { ethers } from 'ethers';
import { findBestRoute } from '../routes/finder';

@Injectable()
export class MempoolListener {
  private readonly logger = new Logger('ARB-BOT');
  private contract: FlashDualArb;

  constructor(private eth: EthereumProvider) {
    this.contract = new FlashDualArb(
      process.env.CONTRACT_ADDRESS!,
      eth.getWallet(),
    );
  }

  async start() {
    this.logger.log('Bot STARTED - Listening mempool...');
    this.eth.getProvider().on('pending', async (txHash: string) => {
      try {
        const tx = await this.eth.getProvider().getTransaction(txHash);
        if (!tx || !tx.to) return;
        const value = (tx.value as bigint) || 0n;
        if (value > 0n) return;

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

  decodeSwap(data: string) {
    if (!data.startsWith('0x38ed1739')) return null;
    try {
      const iface = new ethers.utils.Interface([
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

  async tryArb(tokenIn: string, tokenOut: string, amountIn: bigint) {
    const route = await findBestRoute(
      this.eth.getProvider(),
      tokenIn,
      tokenOut,
      amountIn,
    );
    if (!route) return;

    const fee = (amountIn * 3n) / 997n + 1n;
    const repay = amountIn + fee;
    const profit = route.amountOut - repay;

    this.logger.log(
      `ARB! Profit: ${ethers.formatEther(profit)} ETH | Hops: ${route.hops}`,
    );

    const pair = this.getPair(tokenIn, tokenOut);
    const { a0, a1 } = await this.calcBorrow(pair, tokenIn, amountIn);

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
              minProfit: (profit * 9n) / 10n,
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
              minProfit: (profit * 9n) / 10n,
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

  getPair(t0: string, t1: string): string {
    // Mainnet UniswapV2 pair derivation cần factory + init code hash
    const pairCode = ethers.solidityPackedKeccak256(
      ['address', 'address'],
      [t0 < t1 ? t0 : t1, t0 < t1 ? t1 : t0],
    );
    return ethers.getAddress(`0x${pairCode.slice(-40)}`);
  }

  async calcBorrow(pair: string, token: string, amount: bigint) {
    const token0 = await new ethers.Contract(
      pair,
      ['function token0() view returns (address)'],
      this.eth.getProvider(),
    ).token0();
    return token.toLowerCase() === token0.toLowerCase()
      ? { a0: amount, a1: 0n }
      : { a0: 0n, a1: amount };
  }
}
