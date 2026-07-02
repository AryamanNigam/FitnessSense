import type { GeneratedMeal } from "../../types";

interface MacroCardProps {
  meal: GeneratedMeal;
  logged: boolean;
  logging: boolean;
  onViewRecipe: () => void;
  onLog: () => void;
}

export default function MacroCard({ meal, logged, logging, onViewRecipe, onLog }: MacroCardProps) {
  const protein = meal.items.reduce((sum, i) => sum + i.protein_g, 0);
  const carbs = meal.items.reduce((sum, i) => sum + i.carbs_g, 0);
  const fat = meal.items.reduce((sum, i) => sum + i.fat_g, 0);

  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)" }}>
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{meal.meal_name}</p>
        <p className="font-serif leading-none" style={{ fontSize: 22, color: "var(--accent)" }}>
          {meal.total_kcal}
          <span className="text-xs font-sans font-normal ml-1" style={{ color: "var(--text-muted)" }}>kcal</span>
        </p>
      </div>

      {/* Macro breakdown */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div>
          <p className="label mb-1">Protein</p>
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{protein.toFixed(0)}g</p>
        </div>
        <div>
          <p className="label mb-1">Carbs</p>
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{carbs.toFixed(0)}g</p>
        </div>
        <div>
          <p className="label mb-1">Fat</p>
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{fat.toFixed(0)}g</p>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-1.5 mb-4" style={{ borderTop: "0.5px solid var(--border)", paddingTop: 12 }}>
        {meal.items.map((item, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span style={{ color: "var(--text-secondary)" }}>{item.name}</span>
            <span style={{ color: "var(--text-muted)" }}>{item.kcal} kcal</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={onViewRecipe}
          className="text-xs transition-opacity hover:opacity-70"
          style={{ color: "var(--accent)" }}
        >
          View recipe
        </button>
        <button
          onClick={onLog}
          disabled={logged || logging}
          className="px-3 py-1.5 rounded-lg text-xs transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ background: "var(--surface-2)", color: logged ? "var(--text-success)" : "var(--text-primary)" }}
        >
          {logged ? "Logged" : logging ? "Logging…" : "Log meal"}
        </button>
      </div>
    </div>
  );
}
