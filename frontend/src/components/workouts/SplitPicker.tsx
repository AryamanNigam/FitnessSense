import { errorMessage } from "../../lib/errors";
import { useState } from "react";
import apiClient from "../../lib/apiClient";
import { useAuthStore } from "../../store/authStore";
import {
  FOCUS_LABELS,
  FOCUS_OPTIONS,
  PRESET_META,
  PRESET_SCHEDULES,
  WEEKDAYS,
  WEEKDAY_LABELS,
  emptySchedule,
} from "../../lib/splits";
import type { Focus, Profile, Schedule, SplitType } from "../../types";

const CARDS: { type: SplitType; label: string; desc: string }[] = [
  ...PRESET_META,
  { type: "custom", label: "Custom", desc: "Build your own 7-day week" },
];

export default function SplitPicker() {
  const { profile, setProfile } = useAuthStore();
  const current = profile?.workout_split ?? null;

  const [selected, setSelected] = useState<SplitType>(current?.split_type ?? "ppl_3");
  // Seed the custom editor from the saved split if it was custom, else a blank week.
  const [customSchedule, setCustomSchedule] = useState<Schedule>(
    current?.split_type === "custom" ? current.schedule : emptySchedule()
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // What to preview: presets are read-only; custom is the editable draft.
  const previewSchedule: Schedule =
    selected === "custom" ? customSchedule : PRESET_SCHEDULES[selected];

  function setDay(day: string, focus: Focus) {
    setCustomSchedule((prev) => ({ ...prev, [day]: focus }));
    setSaved(false);
  }

  async function handleSave() {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      // Presets: send only the type — backend fills the schedule authoritatively.
      const body =
        selected === "custom"
          ? { split_type: "custom", schedule: customSchedule }
          : { split_type: selected };
      const res = await apiClient.patch<Profile>("/profile/split", body);
      setProfile(res.data);
      setSaved(true);
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to save split. Try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Split type cards */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--surface-1)" }}>
        <p className="label">Choose a split</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CARDS.map((c) => {
            const active = selected === c.type;
            return (
              <button
                key={c.type}
                onClick={() => { setSelected(c.type); setSaved(false); }}
                className="text-left rounded-xl px-4 py-3 transition-colors"
                style={{
                  border: active ? "1px solid var(--accent)" : "0.5px solid var(--border)",
                  background: active ? "var(--surface-2)" : "transparent",
                }}
              >
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{c.label}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{c.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Weekly preview / editor */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--surface-1)" }}>
        <p className="label">
          {selected === "custom" ? "Build your week" : "This week"}
        </p>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {WEEKDAYS.map((day) => {
            const focus = previewSchedule[day];
            const isRest = focus === "rest";
            return (
              <div key={day} className="flex flex-col items-stretch gap-1.5">
                <span className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                  {WEEKDAY_LABELS[day]}
                </span>

                {selected === "custom" ? (
                  <select
                    value={focus}
                    onChange={(e) => setDay(day, e.target.value as Focus)}
                    className="text-xs px-1.5 py-2 rounded-lg focus:outline-none text-center appearance-none cursor-pointer"
                    style={{
                      background: "var(--surface-2)",
                      color: isRest ? "var(--text-muted)" : "var(--text-primary)",
                      border: "0.5px solid var(--border)",
                    }}
                  >
                    <option value="rest">Rest</option>
                    {FOCUS_OPTIONS.map((f) => (
                      <option key={f} value={f}>{FOCUS_LABELS[f]}</option>
                    ))}
                  </select>
                ) : (
                  <div
                    className="text-xs px-1.5 py-2 rounded-lg text-center"
                    style={{
                      background: "var(--surface-2)",
                      color: isRest ? "var(--text-muted)" : "var(--text-primary)",
                      border: "0.5px solid var(--border)",
                    }}
                  >
                    {FOCUS_LABELS[focus]}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}
      {saved && <p className="text-xs" style={{ color: "var(--text-success)" }}>Split saved.</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 rounded-xl text-sm transition-opacity hover:opacity-80 disabled:opacity-50"
        style={{ background: "var(--accent)", color: "#09090b" }}
      >
        {saving ? "Saving…" : "Save split"}
      </button>
    </div>
  );
}
