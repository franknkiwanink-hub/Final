"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import AuthModal from "@/components/auth/AuthModal";

interface AuthModalContextValue {
  openAuthModal: () => void;
}

const AuthModalContext = createContext<AuthModalContextValue>({
  openAuthModal: () => {},
});

export function useAuthModal() {
  return useContext(AuthModalContext);
}

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <AuthModalContext.Provider value={{ openAuthModal: () => setOpen(true) }}>
      {children}
      <AuthModal
        open={open}
        onClose={() => setOpen(false)}
        onNewOAuthUser={() => {
          // OAuth onboarding (username/avatar setup modal) is a separate
          // feature to be wired up in a later step. For now, new
          // Google/GitHub users just land signed in with an
          // auto-generated username from the server (see ensureAccount).
        }}
      />
    </AuthModalContext.Provider>
  );
}
