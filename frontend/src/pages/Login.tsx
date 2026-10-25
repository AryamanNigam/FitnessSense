import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import apiClient from "../lib/apiClient";
import type { Profile } from "../types";
import { errorMessage } from "../lib/errors";
import AuthShell, { AuthError, AuthField } from "../components/auth/AuthShell";
import { authInputStyle } from "../components/auth/authStyles";

export default function Login() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = mode === "signup" ? "/auth/signup" : "/auth/login";
      const res = await apiClient.post<{ access_token: string | null }>(endpoint, { email, password });

      if (!res.data.access_token) {
        setError("Check your email to confirm your account.");
        return;
      }
      const token = res.data.access_token;

      let profile: Profile | null = null;
      try {
        const res = await apiClient.get<Profile>("/profile/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        profile = res.data;
      } catch {
        // No profile yet — onboarding will create it
      }

      setAuth(token, profile);
      navigate(profile ? "/dashboard" : "/onboarding");
    } catch (err: unknown) {
      setError(errorMessage(err, err instanceof Error ? err.message : "Something went wrong"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
        {mode === "login" ? "Welcome back" : "Create account"}
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
        {mode === "login" ? "Sign in to FitnessSense" : "Start your fitness journey"}
      </p>

      {error && <AuthError message={error} />}

      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField label="Email" htmlFor="email">
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
            style={authInputStyle}
            placeholder="you@example.com"
          />
        </AuthField>
        <AuthField label="Password" htmlFor="password">
          <input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
            style={authInputStyle}
            placeholder="••••••••"
          />
        </AuthField>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--accent)", color: "#09090b" }}
        >
          {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Sign up"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
        <button
          className="font-medium hover:underline"
          style={{ color: "var(--accent)" }}
          onClick={() => {
            setError(null);
            setMode(mode === "login" ? "signup" : "login");
          }}
        >
          {mode === "login" ? "Sign up" : "Sign in"}
        </button>
      </p>
    </AuthShell>
  );
}
