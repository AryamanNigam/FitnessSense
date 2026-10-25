export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: "var(--page-bg)" }}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          <span className="font-semibold text-sm tracking-tight" style={{ color: "var(--text-primary)" }}>FitnessSense</span>
        </div>
        <div className="rounded-2xl p-6 sm:p-8" style={{ background: "var(--surface-1)", border: "0.5px solid var(--border)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function AuthField({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mb-4 rounded-xl px-4 py-3 text-sm"
      style={{ background: "rgba(248,113,113,0.08)", border: "0.5px solid #f87171", color: "#fca5a5" }}
    >
      {message}
    </div>
  );
}
