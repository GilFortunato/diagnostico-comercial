import type { Metadata } from "next";
import { ShareAiLoginPoc } from "@/components/auth/ShareAiLoginPoc";

export const metadata: Metadata = {
  title: "Login · Share AI",
  robots: { index: false, follow: false },
};

export default function LoginPocPage() {
  return <ShareAiLoginPoc />;
}
