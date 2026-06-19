import axios from "axios";
import { useAuthStore } from "../store/authStore";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL as string,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let queue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function flushQueue(error: unknown, token?: string) {
  queue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  queue = [];
}

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status !== 401) return Promise.reject(error);

    // Auth endpoints returning 401 mean credentials are wrong — don't retry, don't loop
    if (original.url?.includes("/auth/")) {
      useAuthStore.getState().clearAuth();
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }

    // Already retried this request — give up
    if ((original as any)._retry) return Promise.reject(error);

    // Another refresh is in flight — queue this request until it resolves
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        queue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return apiClient(original);
      });
    }

    (original as any)._retry = true;
    isRefreshing = true;

    try {
      const res = await apiClient.post<{ access_token: string }>("/auth/refresh");
      const token = res.data.access_token;
      useAuthStore.getState().setAuth(token, useAuthStore.getState().profile);
      flushQueue(null, token);
      original.headers.Authorization = `Bearer ${token}`;
      return apiClient(original);
    } catch (err) {
      flushQueue(err);
      useAuthStore.getState().clearAuth();
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  }
);

export default apiClient;
