export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      className="rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-4"
      style={{ background: "var(--surface-1)", border: "0.5px solid #f87171", color: "var(--text-secondary)" }}
      role="alert"
    >
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="text-xs shrink-0 transition-opacity hover:opacity-70" style={{ color: "var(--accent)" }}>
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="text-center py-8 space-y-2">
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{title}</p>
      {hint && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{hint}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className = "h-5" }: { className?: string }) {
  return <div className={`rounded animate-pulse ${className}`} style={{ background: "var(--surface-2)" }} />;
}
