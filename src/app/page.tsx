import { HomeExperience } from "@/components/app/HomeExperience";
import { isAdminEmail } from "@/lib/auth/admin";
import { listUserModuleAccess } from "@/lib/auth/modulePermissions";
import { getSessionUser } from "@/lib/auth/sessionUser";

export default async function Home() {
  const user = await getSessionUser();
  const isAdmin = isAdminEmail(user?.email);
  const access = user
    ? await listUserModuleAccess(user).catch(() => ({}))
    : {};

  return (
    <HomeExperience
      authenticated={Boolean(user)}
      isAdmin={isAdmin}
      access={access}
      userName={user?.name || user?.email || null}
    />
  );
}
