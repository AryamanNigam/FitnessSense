import apiClient from "./apiClient";
import { useAuthStore } from "../store/authStore";

async function openStream(message: string, signal?: AbortSignal): Promise<Response> {
  const base = import.meta.env.VITE_API_BASE_URL as string;
  return fetch(`${base}/chat`, {
    method: "POST",
    credentials: "include",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${useAuthStore.getState().token}`,
    },
    body: JSON.stringify({ message }),
  });
}

export async function streamChat(
  message: string,
  onToken: (token: string) => void,
  signal?: AbortSignal
): Promise<void> {
  let res = await openStream(message, signal);

  if (res.status === 401) {
    const refreshed = await apiClient.post<{ access_token: string }>("/auth/refresh");
    useAuthStore.getState().setAuth(refreshed.data.access_token, useAuthStore.getState().profile);
    res = await openStream(message, signal);
  }

  if (!res.ok || !res.body) {
    const detail = await res.json().then((b) => b.detail).catch(() => null);
    throw new Error(typeof detail === "string" ? detail : "Could not reach the assistant.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      const data = event.replace(/^data:\s*/, "");
      if (data === "[DONE]") return;
      const payload = JSON.parse(data) as { token?: string; error?: string };
      if (payload.error) throw new Error(payload.error);
      if (payload.token) onToken(payload.token);
    }
  }
}
