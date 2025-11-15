import { BigNumberish } from 'ethers';
export type PairReserves = {
  pair: string;
  token0: string;
  token1: string;
  reserve0: BigNumberish;
  reserve1: BigNumberish;
};
