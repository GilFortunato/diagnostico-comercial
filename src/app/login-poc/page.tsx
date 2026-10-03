import type { Metadata } from "next";
import { existsSync } from "node:fs";
import path from "node:path";
import { ShareAiLoginPoc } from "@/components/auth/ShareAiLoginPoc";

export const metadata: Metadata = {
  title: "Login · Share AI · POC",
  robots: { index: false, follow: false },
};

export default function LoginPocPage() {
  const hasShareAiLogo = existsSync(path.join(process.cwd(), "public/brand/share-ai-logo.png"));
  return <ShareAiLoginPoc hasShareAiLogo={hasShareAiLogo} />;
}
