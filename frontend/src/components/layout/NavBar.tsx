import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import apiClient from "../../lib/apiClient";

const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/meals", label: "Meals" },
  { to: "/workouts", label: "Workouts" },
  { to: "/progress", label: "Progress" },
  { to: "/ask-ai", label: "Ask AI" },
];

export default function NavBar() {
  const { profile, clearAuth } = useAuthStore();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const initials = profile?.name
    ? profile.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleLogout() {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // proceed regardless
    }
    clearAuth();
    navigate("/login");
  }

  return (
    <nav className="px-6 py-3 flex items-center justify-between" style={{ background: "var(--surface-1)", borderBottom: "0.5px solid var(--border)" }}>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-400" />
        <span className="font-semibold text-white text-sm tracking-tight">FitnessSense</span>
      </div>

      <div className="flex items-center gap-1">
        {NAV_LINKS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              isActive
                ? "px-4 py-1.5 rounded-full bg-white text-zinc-900 text-sm font-medium"
                : "px-4 py-1.5 rounded-full text-zinc-400 text-sm hover:text-white transition-colors"
            }
          >
            {label}
          </NavLink>
        ))}
      </div>

      {/* Avatar + dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 focus:outline-none"
        >
          <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-white text-xs font-semibold">
            {initials}
          </div>
          {profile?.name && (
            <span className="text-sm text-zinc-300">{profile.name}</span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-48 rounded-xl shadow-xl py-1 z-50" style={{ background: "var(--surface-2)" }}>
            <div className="px-4 py-2.5" style={{ borderBottom: "0.5px solid var(--border)" }}>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Signed in as</p>
              <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{profile?.name}</p>
            </div>

            <button
              onClick={() => { setOpen(false); navigate("/profile/edit"); }}
              className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:opacity-80"
              style={{ color: "var(--text-secondary)" }}
            >
              Edit details
            </button>

            <button
              onClick={() => { setOpen(false); navigate("/dashboard"); }}
              className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:opacity-80"
              style={{ color: "var(--text-secondary)" }}
            >
              Settings
            </button>

            <div className="mt-1 pt-1" style={{ borderTop: "0.5px solid var(--border)" }}>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:opacity-80"
                style={{ color: "#f87171" }}
              >
                Log out
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
