import { ref } from "vue";

/**
 * Minimal EIP-1193 wallet access.
 *
 * Deliberately no WalletConnect/wagmi dependency: the whole flow is three calls —
 * request accounts, switch chain, sign — and a wallet SDK would add hundreds of
 * kilobytes to every page for that.
 */
type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<any>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
};

const provider = (): Eip1193Provider => {
  const injected = (globalThis as any).ethereum as Eip1193Provider | undefined;
  if (!injected) {
    throw new Error(
      "Không tìm thấy ví. Cài MetaMask hoặc mở trang này trong trình duyệt của ví.",
    );
  }
  return injected;
};

const toHexChainId = (chainId: number) => `0x${chainId.toString(16)}`;

export function useWallet() {
  const address = ref<string | null>(null);
  const chainId = ref<number | null>(null);
  const connecting = ref(false);

  const isAvailable = () => !!(globalThis as any).ethereum;

  const connect = async (): Promise<string> => {
    connecting.value = true;
    try {
      const accounts: string[] = await provider().request({
        method: "eth_requestAccounts",
      });
      if (!accounts.length) throw new Error("Ví không trả về địa chỉ nào");
      address.value = accounts[0];

      const hex: string = await provider().request({ method: "eth_chainId" });
      chainId.value = Number.parseInt(hex, 16);
      return accounts[0];
    } finally {
      connecting.value = false;
    }
  };

  /** Switches the wallet to the billing chain, adding it if unknown. */
  const switchChain = async (target: number) => {
    try {
      await provider().request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: toHexChainId(target) }],
      });
    } catch (err: any) {
      // 4902 is the wallet saying it has never heard of this chain.
      if (err?.code !== 4902) throw err;
      await provider().request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: toHexChainId(target),
            chainName: target === 56 ? "BNB Smart Chain" : "BSC Testnet",
            nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
            rpcUrls: [
              target === 56
                ? "https://bsc-dataseed.binance.org"
                : "https://data-seed-prebsc-1-s1.binance.org:8545",
            ],
            blockExplorerUrls: [
              target === 56 ? "https://bscscan.com" : "https://testnet.bscscan.com",
            ],
          },
        ],
      });
    }
    chainId.value = target;
  };

  const signMessage = async (message: string): Promise<string> => {
    if (!address.value) throw new Error("Chưa kết nối ví");
    return provider().request({
      method: "personal_sign",
      params: [message, address.value],
    });
  };

  /**
   * Sends a transaction built from a raw calldata string.
   *
   * Calldata is assembled here rather than pulled from an ABI encoder so the page
   * carries no contract tooling. The two calls this app makes are the simplest
   * shapes there are: `approve(address,uint256)` and `subscribe()`.
   */
  const sendTransaction = async (to: string, data: string): Promise<string> => {
    if (!address.value) throw new Error("Chưa kết nối ví");
    return provider().request({
      method: "eth_sendTransaction",
      params: [{ from: address.value, to, data }],
    });
  };

  return {
    address,
    chainId,
    connecting,
    isAvailable,
    connect,
    switchChain,
    signMessage,
    sendTransaction,
  };
}

// Function selectors: the first 4 bytes of keccak256 of the signature. Hardcoded
// rather than derived so the page needs no ABI encoder, and verified against
// keccak256 rather than guessed.
const SELECTOR = {
  approve: "0x095ea7b3", // approve(address,uint256)
  subscribe: "0x8f449a05", // subscribe()
  unsubscribe: "0xfcae4484", // unsubscribe()
} as const;

const pad = (value: string) => value.replace(/^0x/, "").padStart(64, "0");

export const encodeApprove = (spender: string, amount: bigint): string =>
  SELECTOR.approve + pad(spender.toLowerCase()) + pad(amount.toString(16));

export const encodeSubscribe = (): string => SELECTOR.subscribe;

export const encodeUnsubscribe = (): string => SELECTOR.unsubscribe;
