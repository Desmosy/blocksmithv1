"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  useSupabaseSession,
  type UseSupabaseSession,
} from "@/lib/auth/useSupabaseSession";
import { AuthDialog } from "./AuthDialog";

type AuthContextValue = UseSupabaseSession & {
  /** Open the sign-in / create-account dialog (no-op if auth unconfigured). */
  openAuth: (mode?: "signin" | "signup") => void;
  closeAuth: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const session = useSupabaseSession();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const openAuth = useCallback(
    (m: "signin" | "signup" = "signin") => {
      if (!session.authConfigured) return;
      setMode(m);
      setOpen(true);
    },
    [session.authConfigured],
  );
  const closeAuth = useCallback(() => setOpen(false), []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...session, openAuth, closeAuth }),
    [session, openAuth, closeAuth],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {open ? (
        <AuthDialog mode={mode} onModeChange={setMode} onClose={closeAuth} />
      ) : null}
    </AuthContext.Provider>
  );
}
