import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app/AppHeader";
import { ProfileExperience } from "@/components/profile/ProfileExperience";
import { isAdminEmail } from "@/lib/auth/admin";
import { getSessionUser } from "@/lib/auth/sessionUser";

export default async function ProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/");
  return <><AppHeader isAdmin={isAdminEmail(user.email)} /><ProfileExperience /></>;
}
