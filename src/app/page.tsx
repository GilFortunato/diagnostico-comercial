import { HomeExperience } from "@/components/app/HomeExperience";
import { isAdminEmail } from "@/lib/auth/admin";
import { getSessionUser } from "@/lib/auth/sessionUser";

export default async function Home() {
  const user = await getSessionUser();
  return <HomeExperience isAdmin={isAdminEmail(user?.email)} />;
}
