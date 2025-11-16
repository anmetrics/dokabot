import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle';

@Injectable()
export class EthereumProvider {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private flashbots?: FlashbotsBundleProvider;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, this.provider);
    this.initFlashbots();
  }

  private async initFlashbots() {
    if (process.env.FLASHBOTS_PROTECT !== 'true') return;
    try {
      this.flashbots = await FlashbotsBundleProvider.create(
        this.provider,
        this.wallet,
        process.env.FLASHBOTS_RELAY,
      );
      console.log('Flashbots READY');
    } catch (e) {
      console.error('Flashbots init failed:', e);
    }
  }

  getProvider() {
    return this.provider;
  }
  getWallet() {
    return this.wallet;
  }
  getFlashbots() {
    return this.flashbots;
  }

  async sendFlashbots(tx: ethers.TransactionRequest) {
    if (!this.flashbots) throw new Error('Flashbots not ready');
    const block = await this.provider.getBlock('latest');

    if (!block) {
      throw new Error('Get block error');
    }
    const target = block.number + 1;

    const bundle = [{ signer: this.wallet, transaction: tx }];
    const signed = await this.flashbots.signBundle(bundle);
    const sim = await this.flashbots.simulate(signed, target);
    if ('error' in sim) throw new Error(sim.error.message);

    return this.flashbots.sendRawBundle(signed, target);
  }
}
