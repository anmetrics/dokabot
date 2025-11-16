import { ethers } from 'ethers';

export async function getAvailableLiquidity(
  provider: ethers.Provider,
  pairAddress: string,
  token: string,
): Promise<bigint> {
  const pairContract = new ethers.Contract(
    pairAddress,
    [
      'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
      'function token0() view returns (address)',
    ],
    provider,
  );

  const [reserve0, reserve1] = await pairContract.getReserves();
  const token0 = await pairContract.token0();

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  if (token.toLowerCase() === token0.toLowerCase()) return reserve0.toBigInt();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  else return reserve1.toBigInt(); // token1 = còn lại của pair
}
