export function errorMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string" && detail) return detail;
  if ((err as { code?: string })?.code === "ERR_NETWORK") return "Can't reach the server. Check your connection.";
  return fallback;
}
