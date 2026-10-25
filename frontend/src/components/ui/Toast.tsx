import { useCallback, useState } from "react";
import { ToastContext, type ToastApi, type ToastKind } from "./toastContext";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const api: ToastApi = {
    success: (message) => push("success", message),
    error: (message) => push("error", message),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="fixed bottom-4 right-4 left-4 sm:left-auto z-[100] flex flex-col gap-2 items-end pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm shadow-xl max-w-sm"
            style={{
              background: "var(--surface-2)",
              color: "var(--text-primary)",
              border: `0.5px solid ${t.kind === "success" ? "var(--text-success)" : "#f87171"}`,
            }}
          >
            <span style={{ color: t.kind === "success" ? "var(--text-success)" : "#f87171" }}>
              {t.kind === "success" ? "✓" : "!"}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
