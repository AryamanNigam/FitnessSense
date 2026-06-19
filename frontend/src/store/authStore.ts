import { create } from "zustand";
import type { Profile } from "../types";

interface AuthState {
  token: string | null;
  profile: Profile | null;
  hydrated: boolean;
  setAuth: (token: string, profile: Profile | null) => void;
  setProfile: (profile: Profile) => void;
  clearAuth: () => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  profile: null,
  hydrated: false,
  setAuth: (token, profile) => set({ token, profile }),
  setProfile: (profile) => set({ profile }),
  clearAuth: () => set({ token: null, profile: null }),
  setHydrated: () => set({ hydrated: true }),
}));
