import ky from "ky-universal";
import { useRuntimeConfig } from "#app";

export function useApi() {
  const config = useRuntimeConfig();

  const api = ky.create({
    prefixUrl: config.public.apiBase,
    timeout: 10000,
    headers: {
      "Content-Type": "application/json",
    },
    retry: 1,
  });

  return {
    get: async <T>(url: string, searchParams?: Record<string, any>) => {
      return api.get(url, { searchParams }).json<T>();
    },
    post: async <T>(url: string, body?: any) => {
      return api.post(url, { json: body }).json<T>();
    },
    put: async <T>(url: string, body?: any) => {
      return api.put(url, { json: body }).json<T>();
    },
    delete: async <T>(url: string) => {
      return api.delete(url).json<T>();
    },
  };
}
