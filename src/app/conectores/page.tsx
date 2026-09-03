import { ConnectorsPageExperience } from "@/components/connectors/ConnectorsPageExperience";
import { hasAdminSession } from "@/lib/auth/adminRequest";

export default async function ConnectorsPage() {
  const isAdminUser = await hasAdminSession();
  return <ConnectorsPageExperience isAdminUser={isAdminUser} />;
}
