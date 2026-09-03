"use client";

import { SessionProvider } from "next-auth/react";
import { InactivitySessionGuard } from "@/components/auth/InactivitySessionGuard";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus refetchInterval={5 * 60}>
      <InactivitySessionGuard>{children}</InactivitySessionGuard>
    </SessionProvider>
  );
}
