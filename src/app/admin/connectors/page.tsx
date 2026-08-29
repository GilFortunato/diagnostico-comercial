import { getServerSession } from "next-auth";
import { ConnectorsPageExperience } from "@/components/connectors/ConnectorsPageExperience";
import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";
import { authOptions } from "@/lib/auth/options";
import { isAdminEmail } from "@/lib/auth/admin";

export default async function AdminConnectorsPage() {
  const session = await getServerSession(authOptions);
  if (!isAdminEmail(session?.user?.email)) {
    return <AdminAccessDenied />;
  }

  return <ConnectorsPageExperience mode="admin" />;
}
