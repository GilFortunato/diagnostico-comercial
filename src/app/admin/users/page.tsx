import { AdminAccessDenied } from "@/components/admin/AdminAccessDenied";
import { AdminUsersExperience } from "@/components/admin/AdminUsersExperience";
import { AppHeader } from "@/components/app/AppHeader";
import { hasAdminSession } from "@/lib/auth/adminRequest";

export default async function AdminUsersPage() {
  if (!(await hasAdminSession())) return <AdminAccessDenied />;
  return <><AppHeader isAdmin /><AdminUsersExperience /></>;
}
