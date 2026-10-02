import { AppHeader } from "@/components/app/AppHeader";
import { DecisionMakerMapExperienceV2 } from "@/components/decision-makers/DecisionMakerMapExperienceV2";
import { isAdminEmail } from "@/lib/auth/admin";
import { getSessionUser } from "@/lib/auth/sessionUser";

export default async function DecisionMakerMapPage() {
  const user = await getSessionUser();

  return (
    <>
      <AppHeader isAdmin={isAdminEmail(user?.email)} />
      <DecisionMakerMapExperienceV2 />
    </>
  );
}
