import { ref } from "vue";
import { useApi } from "~/apis";

export type Exchange = "BINANCE" | "BYBIT";
export type ExchangeAccountStatus = "ACTIVE" | "INVALID" | "REVOKED";

export type KeyPermissions = {
  canRead: boolean;
  canTrade: boolean;
  canWithdraw: boolean;
  raw: string[];
};

export type ExchangeAccount = {
  id: string;
  exchange: Exchange;
  label: string;
  /** Masked — the backend never returns key material. */
  apiKeyMasked: string;
  isTestnet: boolean;
  permissions: KeyPermissions | null;
  status: ExchangeAccountStatus;
  lastVerifiedAt: string | null;
  lastError: string | null;
  createdAt: string;
};

/** Onboarding metadata served by the API — never hardcoded in the UI, because a
 *  stale egress IP here locks every user's key out of the exchange. */
export type ExchangeOnboarding = {
  id: Exchange;
  name: string;
  createKeyUrl: string;
  ipWhitelistUrl: string;
  ipWhitelistLabel: string;
  requiredPermissions: string[];
  forbiddenPermissions: string[];
  notes: string[];
};

export type SupportedExchanges = {
  exchanges: ExchangeOnboarding[];
  egressIps: string[];
  egressIpsConfigured: boolean;
};

export type CreateExchangeAccountPayload = {
  exchange: Exchange;
  label: string;
  apiKey: string;
  apiSecret: string;
  isTestnet: boolean;
};

const RESOURCE = "exchange-accounts";

export function useExchangeAccounts() {
  const api = useApi();

  const accounts = ref<ExchangeAccount[]>([]);
  const onboarding = ref<ExchangeOnboarding[]>([]);
  const egressIps = ref<string[]>([]);
  const egressIpsConfigured = ref(false);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const readError = async (err: any): Promise<string> => {
    const body = await err?.response?.json?.().catch(() => null);
    const message = body?.message;
    if (Array.isArray(message)) return message.join(", ");
    return message || err?.message || "Đã có lỗi xảy ra, vui lòng thử lại.";
  };

  const fetchAccounts = async () => {
    loading.value = true;
    error.value = null;
    try {
      accounts.value = await api.get<ExchangeAccount[]>(RESOURCE);
    } catch (err) {
      error.value = await readError(err);
    } finally {
      loading.value = false;
    }
  };

  /** Loads the supported exchanges plus the IP allowlist the user must apply. */
  const fetchSupported = async () => {
    try {
      const data = await api.get<SupportedExchanges>(`${RESOURCE}/supported`);
      onboarding.value = data.exchanges;
      egressIps.value = data.egressIps;
      egressIpsConfigured.value = data.egressIpsConfigured;
    } catch {
      // Non-fatal: the key form still works, it just loses its guidance.
      onboarding.value = [];
    }
  };

  const createAccount = async (payload: CreateExchangeAccountPayload) => {
    const created = await api.post<ExchangeAccount>(RESOURCE, payload);
    accounts.value = [created, ...accounts.value];
    return created;
  };

  const verifyAccount = async (id: string) => {
    const updated = await api.post<ExchangeAccount>(`${RESOURCE}/${id}/verify`);
    accounts.value = accounts.value.map((a) => (a.id === id ? updated : a));
    return updated;
  };

  const revokeAccount = async (id: string) => {
    await api.delete(`${RESOURCE}/${id}`);
    accounts.value = accounts.value.filter((a) => a.id !== id);
  };

  return {
    accounts,
    onboarding,
    egressIps,
    egressIpsConfigured,
    loading,
    error,
    fetchAccounts,
    fetchSupported,
    createAccount,
    verifyAccount,
    revokeAccount,
    readError,
  };
}
