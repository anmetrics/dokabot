import { ref } from "vue";
import { useApi } from "~/apis";

export type SymbolRule = {
  symbol: string;
  maxBuyPrice: number;
  minBuyPrice: number;
  maxSellPrice: number;
  minSellPrice: number;
  enabled: boolean;
  note?: string;
};

export type UserSettings = {
  defaultOrderSizeUsd: string;
  defaultTakeProfitPercent: string;
  defaultStopLossPercent: string;
  defaultMaxLossUsd: string | null;
  maxConcurrentBots: number;
  maxDailyLossUsd: string | null;
  tradingPaused: boolean;
  symbolRules: SymbolRule[];
  notifyOnFill: boolean;
  notifyOnError: boolean;
  notifyOnBotStopped: boolean;
  telegramChatId: string | null;
  timezone: string;
  locale: string;
};

export type Session = {
  id: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
};

export type ActivityEntry = {
  id: string;
  action: string;
  resourceType: string | null;
  success: boolean;
  ip: string | null;
  createdAt: string;
};

export const emptyRule = (symbol = ""): SymbolRule => ({
  symbol,
  maxBuyPrice: 0,
  minBuyPrice: 0,
  maxSellPrice: 0,
  minSellPrice: 0,
  enabled: true,
});

export function useSettings() {
  const api = useApi();

  const settings = ref<UserSettings | null>(null);
  const sessions = ref<Session[]>([]);
  const activity = ref<ActivityEntry[]>([]);
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
      const [s, ses, act] = await Promise.all([
        api.get<UserSettings>("settings"),
        api.get<Session[]>("settings/sessions"),
        api.get<ActivityEntry[]>("settings/activity", { limit: 50 }),
      ]);
      settings.value = s;
      sessions.value = ses;
      activity.value = act;
    } finally {
      loading.value = false;
    }
  };

  const save = async (patch: Partial<UserSettings>) => {
    settings.value = await api.patch<UserSettings>("settings", patch);
    return settings.value;
  };

  const changePassword = (currentPassword: string, newPassword: string) =>
    api.post<{ success: true }>("settings/change-password", {
      currentPassword,
      newPassword,
    });

  const revokeSession = async (id: string) => {
    await api.delete(`settings/sessions/${id}`);
    sessions.value = sessions.value.filter((s) => s.id !== id);
  };

  return {
    settings,
    sessions,
    activity,
    loading,
    load,
    save,
    changePassword,
    revokeSession,
    readError,
  };
}
