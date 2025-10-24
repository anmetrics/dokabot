import ky from "ky-universal";
import { useCookie } from "#app";

export function useApi() {
  const authToken = useCookie("auth_token");

  const api = ky.create({
    prefixUrl: "http://157.245.150.180:3000",
    timeout: 10000,
    headers: {
      "Content-Type": "application/json",
    },
    retry: 1,
  });

  const request = async <T>(
    method: "get" | "post" | "put" | "patch" | "delete",
    url: string,
    options: any = {}
  ): Promise<T> => {
    try {
      const headers = {
        ...(authToken.value
          ? { Authorization: `Bearer ${authToken.value}` }
          : {}),
        ...options.headers,
      };

      const res = await api[method](url, { ...options, headers }).json<T>();
      return res;
    } catch (err: any) {
      if (err?.response?.status === 401) {
        authToken.value = null;
        window.location.href = "/authentication/login";
      }
      throw err;
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
