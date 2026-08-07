import { ref } from "vue";
import { useApi } from "~/apis";

export type PlanInfo = {
  tiers: { tier: "FREE" | "PRO"; priceUsd: number; features: string[] }[];
  periodDays: number;
  graceDays: number;
  chainId: number;
  token: { address: string; decimals: number; symbol: string };
  contractAddress: string | null;
};

export type SubscriptionStatus = {
  tier: "FREE" | "PRO";
  status: "NONE" | "ACTIVE" | "GRACE" | "EXPIRED" | "CANCELLED";
  walletAddress: string | null;
  priceUsd: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  graceEndsAt: string | null;
  isPro: boolean;
};

export type Payment = {
  id: string;
  txHash: string;
  amountUsd: string;
  walletAddress: string;
  confirmedAt: string;
};

export type LinkedWallet = {
  address: string;
  chainId: number;
  verifiedAt: string | null;
};

export function useBilling() {
  const api = useApi();

  const plan = ref<PlanInfo | null>(null);
  const subscription = ref<SubscriptionStatus | null>(null);
  const payments = ref<Payment[]>([]);
  const wallets = ref<LinkedWallet[]>([]);
  const loading = ref(false);

  const readError = async (err: any): Promise<string> => {
    const body = await err?.response?.json?.().catch(() => null);
    const message = body?.message;
    if (Array.isArray(message)) return message.join(", ");
    return message || err?.message || "Đã có lỗi xảy ra, vui lòng thử lại.";
  };

  const load = async () => {
    loading.value = true;
    try {
      const [p, s, pay, w] = await Promise.all([
        api.get<PlanInfo>("billing/plan"),
        api.get<SubscriptionStatus>("billing"),
        api.get<Payment[]>("billing/payments"),
        api.get<LinkedWallet[]>("billing/wallets"),
      ]);
      plan.value = p;
      subscription.value = s;
      payments.value = pay;
      wallets.value = w;
    } finally {
      loading.value = false;
    }
  };

  const challenge = (address: string, chainId: number) =>
    api.post<{ message: string; nonce: string }>("billing/wallets/challenge", {
      address,
      chainId,
    });

  const verify = (address: string, signature: string) =>
    api.post<{ address: string }>("billing/wallets/verify", {
      address,
      signature,
    });

  return {
    plan,
    subscription,
    payments,
    wallets,
    loading,
    load,
    challenge,
    verify,
    readError,
  };
}
