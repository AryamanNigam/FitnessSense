import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyProgress, WeightLogResponse } from "../../types";

const AXIS = { fill: "#71717a", fontSize: 11 };
const GRID = "rgba(255,255,255,0.06)";
const WEIGHT_COLOR = "#4ade80";
const CALORIE_COLOR = "#f59e0b";

function shortDate(iso: string) {
  return new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ChartTooltip({ active, payload, label, unit }: { active?: boolean; payload?: { value: number }[]; label?: string; unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "var(--surface-2)", border: "0.5px solid var(--border)" }}>
      <p style={{ color: "var(--text-muted)" }}>{label && shortDate(label)}</p>
      <p style={{ color: "var(--text-primary)" }}>{payload[0].value} {unit}</p>
    </div>
  );
}

export function WeightChart({ logs }: { logs: WeightLogResponse[] }) {
  const data = [...logs]
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
    .map((l) => ({ date: l.logged_at.slice(0, 10), kg: l.weight_kg }));
  const values = data.map((d) => d.kg);
  const min = Math.floor(Math.min(...values) - 1);
  const max = Math.ceil(Math.max(...values) + 1);

  return (
    <div role="img" aria-label="Weight trend line chart" style={{ height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} axisLine={false} tickLine={false} minTickGap={32} />
          <YAxis domain={[min, max]} tick={AXIS} axisLine={false} tickLine={false} width={48} />
          <Tooltip content={<ChartTooltip unit="kg" />} cursor={{ stroke: GRID }} />
          <Line
            type="monotone"
            dataKey="kg"
            stroke={WEIGHT_COLOR}
            strokeWidth={2}
            dot={data.length <= 31 ? { r: 3, fill: WEIGHT_COLOR, stroke: "#1a1a1e", strokeWidth: 2 } : false}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CalorieChart({ daily, target }: { daily: DailyProgress[]; target: number }) {
  const max = Math.max(target, ...daily.map((d) => d.kcal));

  return (
    <div role="img" aria-label="Daily calories compared with target bar chart" style={{ height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={daily} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDate} tick={AXIS} axisLine={false} tickLine={false} minTickGap={32} />
          <YAxis domain={[0, Math.ceil((max * 1.1) / 500) * 500]} tick={AXIS} axisLine={false} tickLine={false} width={48} />
          <Tooltip content={<ChartTooltip unit="kcal" />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <ReferenceLine
            y={target}
            stroke="#a1a1aa"
            strokeDasharray="4 4"
            label={{ value: `Target ${target}`, position: "insideTopRight", fill: "#a1a1aa", fontSize: 11 }}
          />
          <Bar dataKey="kcal" fill={CALORIE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
