"use client";

import { Link2 } from "lucide-react";
import { signIn } from "next-auth/react";

const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

export function GoogleSheetsConnectButton({
  email,
  connected,
}: {
  email: string | null;
  connected: boolean;
}) {
  async function connect() {
    await signIn(
      "google",
      { callbackUrl: "/humanship" },
      {
        scope: `openid email profile ${GOOGLE_SHEETS_SCOPE}`,
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
        ...(email ? { login_hint: email } : {}),
      },
    );
  }

  return (
    <button
      type="button"
      onClick={connect}
      className="inline-flex shrink-0 items-center gap-2 rounded-md bg-[var(--share-green-950)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--share-green-800)]"
    >
      <Link2 className="h-4 w-4" />
      {connected ? "Reconectar Google Sheets" : "Conectar Google Sheets"}
    </button>
  );
}
