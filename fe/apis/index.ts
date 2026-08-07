import ky from "ky-universal";
import { useCookie, useRuntimeConfig } from "#app";

type Method = "get" | "post" | "put" | "patch" | "delete";

/** Endpoints that must never trigger the refresh flow (they *are* the flow). */
const AUTH_PATHS = ["auth/login", "auth/register", "auth/refresh"];

export function useApi() {
  const authToken = useCookie("auth_token");
  const refreshToken = useCookie("refresh_token");
  const config = useRuntimeConfig();

  const api = ky.create({
    prefixUrl: config.public.apiBaseUrl,
    timeout: 10000,
    headers: {
      "Content-Type": "application/json",
    },
    retry: 1,
  });

  const signOut = () => {
    authToken.value = null;
    refreshToken.value = null;
    if (import.meta.client) {
      window.location.href = "/authentication/login";
    }
  };

  /**
   * Trades the refresh token for a new pair.
   *
   * Access tokens live 15 minutes, so without this the user is thrown back to the
   * login screen mid-session. Returns false when the refresh token is also dead.
   */
  const tryRefresh = async (): Promise<boolean> => {
    if (!refreshToken.value) return false;
    try {
      const res = await api
        .post("auth/refresh", { json: { refreshToken: refreshToken.value } })
        .json<{ accessToken: string; refreshToken: string }>();

      authToken.value = res.accessToken;
      // The server rotates refresh tokens, so the old one is already revoked.
      refreshToken.value = res.refreshToken;
      return true;
    } catch {
      return false;
    }
  };

  const send = <T>(method: Method, url: string, options: any) => {
    const headers = {
      ...(authToken.value ? { Authorization: `Bearer ${authToken.value}` } : {}),
      ...options.headers,
    };
    return api[method](url, { ...options, headers }).json<T>();
  };

  const request = async <T>(
    method: Method,
    url: string,
    options: any = {},
  ): Promise<T> => {
    try {
      return await send<T>(method, url, options);
    } catch (err: any) {
      if (err?.response?.status !== 401 || AUTH_PATHS.includes(url)) {
        throw err;
      }

      // One refresh attempt, then one replay. Never a loop.
      if (!(await tryRefresh())) {
        signOut();
        throw err;
      }
      return await send<T>(method, url, options);
    }
  };

  return {
    get: <T>(url: string, searchParams?: Record<string, any>) =>
      request<T>("get", url, { searchParams }),
    post: <T>(url: string, body?: any) =>
      request<T>("post", url, { json: body }),
    put: <T>(url: string, body?: any) => request<T>("put", url, { json: body }),
    patch: <T>(url: string, body?: any) =>
      request<T>("patch", url, { json: body }),
    delete: <T>(url: string) => request<T>("delete", url),
  };
}
