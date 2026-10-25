import { useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../lib/apiClient";
import { useAuthStore } from "../store/authStore";
import { errorMessage } from "../lib/errors";
import AuthShell, { AuthError } from "../components/auth/AuthShell";
import { authInputStyle } from "../components/auth/authStyles";
import type { ActivityLevel, Goal, Profile, ProfileCreate } from "../types";

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

const STEPS = ["About you", "Your goal", "Activity level"];

export default function Onboarding() {
  const navigate = useNavigate();
  const { setProfile } = useAuthStore();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState<ProfileCreate>({
    name: "",
    age: 25,
    weight_kg: 70,
    height_cm: 170,
    goal: "maintain",
    activity_level: "moderate",
  });

  function update<K extends keyof ProfileCreate>(key: K, value: ProfileCreate[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleFinish() {
    setError(null);
    setLoading(true);
    try {
      const res = await apiClient.post<Profile>("/profile", form);
      setProfile(res.data);
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(errorMessage(err, err instanceof Error ? err.message : "Failed to save profile"));
    } finally {
      setLoading(false);
    }
  }

  const invalid =
    step === 0 &&
    (!form.name.trim() ||
      form.age < 10 || form.age > 120 ||
      form.weight_kg <= 0 || form.weight_kg > 500 ||
      form.height_cm <= 0 || form.height_cm > 300);

  return (
    <AuthShell>
      <div className="flex items-center gap-2 mb-6" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{
                background: i <= step ? "var(--accent)" : "var(--surface-2)",
                color: i <= step ? "#09090b" : "var(--text-muted)",
              }}
            >
              {i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-0.5" style={{ background: i < step ? "var(--accent)" : "var(--surface-2)" }} />
            )}
          </div>
        ))}
      </div>

      <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>{STEPS[step]}</h2>

      {error && <div className="mt-3"><AuthError message={error} /></div>}

      {step === 0 && (
        <div className="space-y-4 mt-4">
          <Field label="Name">
            <input type="text" value={form.name} onChange={(e) => update("name", e.target.value)} className={inputCls} style={authInputStyle} placeholder="Your name" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Age">
              <input type="number" value={form.age} onChange={(e) => update("age", Number(e.target.value))} className={inputCls} style={authInputStyle} min={10} max={120} />
            </Field>
            <Field label="Weight (kg)">
              <input type="number" value={form.weight_kg} onChange={(e) => update("weight_kg", Number(e.target.value))} className={inputCls} style={authInputStyle} step={0.1} min={1} max={500} />
            </Field>
            <Field label="Height (cm)">
              <input type="number" value={form.height_cm} onChange={(e) => update("height_cm", Number(e.target.value))} className={inputCls} style={authInputStyle} min={1} max={300} />
            </Field>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3 mt-4">
          {GOALS.map((g) => (
            <Choice key={g.value} selected={form.goal === g.value} onClick={() => update("goal", g.value)}>
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{g.label}</p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>{g.desc}</p>
            </Choice>
          ))}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-2 mt-4">
          {ACTIVITY_LEVELS.map((a) => (
            <Choice key={a.value} selected={form.activity_level === a.value} onClick={() => update("activity_level", a.value)}>
              <p className="text-sm" style={{ color: "var(--text-primary)" }}>{a.label}</p>
            </Choice>
          ))}
        </div>
      )}

      <div className="flex gap-3 mt-6">
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
          >
            Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={invalid}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--accent)", color: "#09090b" }}
          >
            Next
          </button>
        ) : (
          <button
            onClick={handleFinish}
            disabled={loading}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--accent)", color: "#09090b" }}
          >
            {loading ? "Saving…" : "Get started"}
          </button>
        )}
      </div>
    </AuthShell>
  );
}

const inputCls = "w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500";

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="w-full text-left rounded-xl px-4 py-3 transition-colors"
      style={{
        background: selected ? "rgba(245,158,11,0.08)" : "var(--surface-2)",
        border: `0.5px solid ${selected ? "var(--accent)" : "var(--border)"}`,
      }}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label block mb-1.5">{label}</label>
      {children}
    </div>
  );
}
