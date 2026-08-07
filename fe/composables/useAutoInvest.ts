import { ref } from "vue";
import { useApi } from "~/apis";

export type RiskProfile = "CONSERVATIVE" | "BALANCED" | "GROWTH";

export type PresetLeg = {
  symbol: string;
  strategyKey: string;
  timeframe: string;
  weight: number;
};

export type Preset = {
  profile: RiskProfile;
  name: string;
  description: string;
  riskNote: string;
  maxDrawdownPercent: number;
  legs: PresetLeg[];
};

export type AutoInvestStatus = {
  enabled: boolean;
  profile: RiskProfile | null;
  budgetUsd: string;
  isPaper: boolean;
  botCount: number;
  runningCount: number;
  realisedPnl: string;
  bots: {
    id: string;
    symbol: string;
    strategyKey: string;
    timeframe: string;
    status: string;
    allocationUsd: string;
    lastError: string | null;
  }[];
};

export function useAutoInvest() {
  const api = useApi();

  const presets = ref<Preset[]>([]);
  const status = ref<AutoInvestStatus | null>(null);
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
      const [p, s] = await Promise.all([
        api.get<Preset[]>("auto-invest/presets"),
        api.get<AutoInvestStatus>("auto-invest"),
      ]);
      presets.value = p;
      status.value = s;
    } finally {
      loading.value = false;
    }
  };

  const enable = async (payload: {
    exchangeAccountId: string;
    profile: RiskProfile;
    budgetUsd: number;
    isPaper: boolean;
  }) => {
    status.value = await api.post<AutoInvestStatus>("auto-invest/enable", payload);
    return status.value;
  };

  const disable = async () => {
    status.value = await api.post<AutoInvestStatus>("auto-invest/disable");
    return status.value;
  };

  return { presets, status, loading, load, enable, disable, readError };
}
