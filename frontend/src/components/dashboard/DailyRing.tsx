import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface Props {
  mealDone: boolean;
  workoutDone: boolean;
  weightDone: boolean;
  loading?: boolean;
  onWeightLog: (kg: number) => void;
}

const RINGS = [
  { id: "meal",    r: 38, color: "#4ade80" },
  { id: "workout", r: 26, color: "#a78bfa" },
  { id: "weight",  r: 14, color: "#fb923c" },
] as const;

const MIN_FILL = 0.025; // sliver so empty rings still show their color

function Arc({ r, filled, color }: { r: number; filled: boolean; color: string }) {
  const circ = 2 * Math.PI * r;
  const progress = filled ? 1 : MIN_FILL;
  const dash = circ * progress;
  return (
    <circle
      cx="50" cy="50" r={r}
      fill="none"
      stroke={color}
      strokeWidth={6}
      strokeDasharray={`${dash} ${circ}`}
      strokeLinecap="round"
      transform="rotate(-90 50 50)"
      style={{
        transition: "stroke-dasharray 0.7s cubic-bezier(0.4,0,0.2,1)",
        opacity: filled ? 1 : 0.35,
      }}
    />
  );
}

export default function DailyRing({ mealDone, workoutDone, weightDone, loading, onWeightLog }: Props) {
  const navigate = useNavigate();
  const [weightOpen, setWeightOpen] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleLogWeight() {
    const kg = parseFloat(weightInput);
    if (isNaN(kg) || kg <= 0) return;
    setSaving(true);
    try {
      await onWeightLog(kg);
      setWeightInput("");
      setWeightOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const rows = [
    {
      label: "Meal plan",
      color: "#4ade80",
      done: mealDone,
      type: "nav" as const,
      onClick: () => navigate("/meals"),
    },
    {
      label: "Workout",
      color: "#a78bfa",
      done: workoutDone,
      type: "nav" as const,
      onClick: () => navigate("/workouts"),
    },
    {
      label: "Weigh-ins",
      color: "#fb923c",
      done: weightDone,
      type: "expand" as const,
      onClick: () => setWeightOpen((v) => !v),
    },
  ];

  return (
    <div className="flex items-center">
      {/* Left — ring */}
      <div className="flex-[2] flex items-center justify-center p-4">
        <div className="relative w-40 h-40">
          <svg width="100%" height="100%" viewBox="0 0 100 100">
            {RINGS.map(({ r }) => (
              <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={7} />
            ))}
            {!loading && (
              <>
                <Arc r={38} filled={mealDone}    color="#4ade80" />
                <Arc r={26} filled={workoutDone} color="#a78bfa" />
                <Arc r={14} filled={weightDone}  color="#fb923c" />
              </>
            )}
          </svg>
        </div>
      </div>

      {/* Right — options */}
      <div className="flex-[1] flex flex-col justify-center gap-0.5 py-4 pr-3">
        {rows.map(({ label, color, done, type, onClick }) => (
          <div key={label}>
            <button
              onClick={onClick}
              className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg transition-colors text-left group hover:opacity-80"
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs flex-1" style={{ color: "var(--text-secondary)" }}>{label}</span>
              <span className="text-xs font-medium" style={{ color: done ? color : "var(--text-muted)" }}>
                {loading ? "—" : done ? "done" : "pending"}
              </span>
              {type === "nav" ? (
                <ChevronRight className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />
              ) : (
                <ChevronDown
                  className="text-zinc-600 group-hover:text-zinc-400 transition-colors"
                  style={{ transform: weightOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
                />
              )}
            </button>

            {label === "Weigh-ins" && weightOpen && (
              <div className="mx-2 mt-1 mb-0.5 flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.1"
                  min="20"
                  max="300"
                  placeholder="74.2"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogWeight()}
                  className="w-16 rounded-lg px-2 py-1 text-xs focus:outline-none"
                  style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "0.5px solid var(--border)" }}
                  autoFocus
                />
                <span className="text-xs text-zinc-500">kg</span>
                <button
                  onClick={handleLogWeight}
                  disabled={saving || !weightInput}
                  className="text-xs px-2 py-1 rounded-lg disabled:opacity-40 transition-opacity hover:opacity-80"
                  style={{ background: "rgba(245,158,11,0.15)", color: "var(--accent)" }}
                >
                  {saving ? "…" : "Log"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function ChevronDown({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
