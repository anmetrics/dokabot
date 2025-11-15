import {
  ethers,
  BigNumberish,
  Wallet,
  Contract,
  ContractTransaction,
} from 'ethers';
import FlashDualArbABI from './FlashDualArb.json';

/* ==========================
   TYPES
   ========================== */
export interface ArbitrageRoute {
  path: string[];
  amountOutMin: BigNumberish;
}

export type Address = string;

export interface StartSingleParams {
  pair: Address;
  amount0Out: BigNumberish;
  amount1Out: BigNumberish;
  route: Address[];
  repayToken: Address;
  router: Address;
  minProfit: BigNumberish;
}

export interface StartMultiParams {
  pair: Address;
  amount0Out: BigNumberish;
  amount1Out: BigNumberish;
  routes: ArbitrageRoute[];
  repayToken: Address;
  router: Address;
  minProfit: BigNumberish;
}

/* ==========================
   FLASHDUALARBFIXED CLASS
   ========================== */
export class FlashDualArb {
  contract: Contract;

  constructor(address: Address, wallet: Wallet) {
    this.contract = new ethers.Contract(address, FlashDualArbABI.abi, wallet);
  }

  /* ==========================
     SINGLE ROUTE
     ========================== */
  async start(params: StartSingleParams): Promise<ContractTransaction> {
    const {
      pair,
      amount0Out,
      amount1Out,
      route,
      repayToken,
      router,
      minProfit,
    } = params;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.contract.start(
      pair,
      amount0Out,
      amount1Out,
      route,
      repayToken,
      router,
      minProfit,
      {
        gasLimit: 1_000_000,
      },
    );
  }

  populateStart(params: StartSingleParams) {
    const {
      pair,
      amount0Out,
      amount1Out,
      route,
      repayToken,
      router,
      minProfit,
    } = params;
    return this.contract.start.populateTransaction(
      pair,
      amount0Out,
      amount1Out,
      route,
      repayToken,
      router,
      minProfit,
    );
  }

  /* ==========================
     MULTI ROUTE
     ========================== */
  async startMulti(params: StartMultiParams): Promise<ContractTransaction> {
    const {
      pair,
      amount0Out,
      amount1Out,
      routes,
      repayToken,
      router,
      minProfit,
    } = params;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.contract.startMulti(
      pair,
      amount0Out,
      amount1Out,
      routes,
      repayToken,
      router,
      minProfit,
      {
        gasLimit: 1_500_000,
      },
    );
  }

  populateStartMulti(params: StartMultiParams) {
    const {
      pair,
      amount0Out,
      amount1Out,
      routes,
      repayToken,
      router,
      minProfit,
    } = params;
    return this.contract.startMulti.populateTransaction(
      pair,
      amount0Out,
      amount1Out,
      routes,
      repayToken,
      router,
      minProfit,
    );
  }

  /* ==========================
     HELPERS
     ========================== */
  connect(wallet: Wallet): FlashDualArb {
    return new FlashDualArb(this.contract.address, wallet);
  }

  address(): string {
    return this.contract.address;
  }
}
