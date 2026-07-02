import { useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../lib/apiClient";
import { useAuthStore } from "../store/authStore";
import type { ActivityLevel, Goal, Profile } from "../types";

const GOALS: { value: Goal; label: string; desc: string }[] = [
  { value: "cut", label: "Cut", desc: "Lose fat, preserve muscle" },
  { value: "maintain", label: "Maintain", desc: "Stay at current weight" },
  { value: "bulk", label: "Bulk", desc: "Build muscle and strength" },
];

const ACTIVITY_LEVELS: { value: ActivityLevel; label: string }[] = [
  { value: "sedentary", label: "Sedentary (desk job, no exercise)" },
  { value: "light", label: "Light (1–3 days/week)" },
  { value: "moderate", label: "Moderate (3–5 days/week)" },
  { value: "active", label: "Active (6–7 days/week)" },
  { value: "very_active", label: "Very Active (physical job + training)" },
];

export default function ProfileEdit() {
  const navigate = useNavigate();
  const { profile, setProfile } = useAuthStore();

  const [name, setName] = useState(profile?.name ?? "");
  const [age, setAge] = useState(profile?.age ?? 25);
  const [weightKg, setWeightKg] = useState(profile?.weight_kg ?? 70);
  const [heightCm, setHeightCm] = useState(profile?.height_cm ?? 170);
  const [goal, setGoal] = useState<Goal>(profile?.goal ?? "maintain");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(profile?.activity_level ?? "moderate");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setError(null);
    setSaved(false);
    setLoading(true);
    try {
      const res = await apiClient.patch<Profile>("/profile/me", {
        name,
        age,
        weight_kg: weightKg,
        height_cm: heightCm,
        goal,
        activity_level: activityLevel,
      });
      setProfile(res.data);
      setSaved(true);
    } catch (err: unknown) {
      const detail = (err as any)?.response?.data?.detail;
      setError(detail ?? "Failed to save profile. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!profile) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>Edit profile</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Updates recompute your daily target and protein goal.
          </p>
        </div>
        <button
          onClick={() => navigate("/dashboard")}
          className="text-sm transition-opacity hover:opacity-70"
          style={{ color: "var(--text-muted)" }}
        >
          Cancel
        </button>
      </div>

      {/* About you */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--surface-1)" }}>
        <p className="label">About you</p>
        <FormField label="Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
            style={inputStyle}
          />
        </FormField>
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Age">
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(Number(e.target.value))}
              className={inputCls}
              style={inputStyle}
              min={10}
              max={120}
            />
          </FormField>
          <FormField label="Weight (kg)">
            <input
              type="number"
              value={weightKg}
              onChange={(e) => setWeightKg(Number(e.target.value))}
              className={inputCls}
              style={inputStyle}
              step={0.1}
              min={1}
            />
          </FormField>
          <FormField label="Height (cm)">
            <input
              type="number"
              value={heightCm}
              onChange={(e) => setHeightCm(Number(e.target.value))}
              className={inputCls}
              style={inputStyle}
              min={1}
            />
          </FormField>
        </div>
      </div>

      {/* Goal */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--surface-1)" }}>
        <p className="label">Goal</p>
        {GOALS.map((g) => (
          <button
            key={g.value}
            onClick={() => setGoal(g.value)}
            className="w-full text-left rounded-xl px-4 py-3 transition-colors"
            style={{
              border: goal === g.value ? "1px solid var(--accent)" : "0.5px solid var(--border)",
              background: goal === g.value ? "var(--surface-2)" : "transparent",
            }}
          >
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{g.label}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{g.desc}</p>
          </button>
        ))}
      </div>

      {/* Activity level */}
      <div className="rounded-2xl p-5 space-y-2" style={{ background: "var(--surface-1)" }}>
        <p className="label mb-1">Activity level</p>
        {ACTIVITY_LEVELS.map((a) => (
          <button
            key={a.value}
            onClick={() => setActivityLevel(a.value)}
            className="w-full text-left rounded-xl px-4 py-2.5 text-sm transition-colors"
            style={{
              border: activityLevel === a.value ? "1px solid var(--accent)" : "0.5px solid var(--border)",
              background: activityLevel === a.value ? "var(--surface-2)" : "transparent",
              color: activityLevel === a.value ? "var(--text-primary)" : "var(--text-secondary)",
            }}
          >
            {a.label}
          </button>
        ))}
      </div>

      {error && <p className="text-xs" style={{ color: "#f87171" }}>{error}</p>}
      {saved && <p className="text-xs" style={{ color: "var(--text-success)" }}>Saved.</p>}

      <button
        onClick={handleSave}
        disabled={loading || !name.trim()}
        className="px-4 py-2 rounded-xl text-sm transition-opacity hover:opacity-80 disabled:opacity-50"
        style={{ background: "var(--accent)", color: "#09090b" }}
      >
        {loading ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

const inputCls = "w-full text-sm px-3 py-2 rounded-xl focus:outline-none";

const inputStyle = {
  background: "var(--surface-2)",
  color: "var(--text-primary)",
  border: "0.5px solid var(--border)",
};

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs block mb-1.5" style={{ color: "var(--text-muted)" }}>{label}</label>
      {children}
    </div>
  );
}
