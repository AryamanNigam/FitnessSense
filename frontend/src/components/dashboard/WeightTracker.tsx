import type { WeightLogResponse } from "../../types";

interface Props {
  logs: WeightLogResponse[];
  loading: boolean;
}

export default function WeightTracker({ logs, loading }: Props) {
  const recent = logs.slice(0, 6);
  const latest = recent[0];

  const trend = recent.length >= 2
    ? (recent[0].weight_kg - recent[recent.length - 1].weight_kg)
    : null;

  return (
    <div className="rounded-2xl p-5 h-full" style={{ background: "var(--surface-1)" }}>
      <div className="flex items-center justify-between mb-4">
        <p className="label">Weight log</p>
        {trend !== null && (
          <span className="text-xs font-medium" style={{ color: trend <= 0 ? "var(--text-success)" : "#f87171" }}>
            {trend > 0 ? "+" : ""}{trend.toFixed(1)} kg
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-5 rounded animate-pulse" style={{ background: "var(--surface-2)" }} />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <p className="text-xs mt-4" style={{ color: "var(--text-muted)" }}>
          No entries yet — log your weight using the ring card.
        </p>
      ) : (
        <div>
          {/* Latest entry — hero number */}
          <p className="font-serif leading-none" style={{ fontSize: 26, color: "var(--text-primary)" }}>
            {latest.weight_kg}
            <span className="text-sm font-sans font-normal ml-1.5" style={{ color: "var(--text-muted)" }}>kg</span>
          </p>
          <p className="text-xs mt-0.5 mb-4" style={{ color: "var(--text-muted)" }}>
            {new Date(latest.logged_at + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>

          {/* History */}
          <div style={{ borderTop: "0.5px solid var(--border)" }} className="pt-3 space-y-1.5">
            {recent.slice(1).map((entry) => {
              const date = new Date(entry.logged_at + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
              return (
                <div key={entry.id} className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{date}</span>
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{entry.weight_kg} kg</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
