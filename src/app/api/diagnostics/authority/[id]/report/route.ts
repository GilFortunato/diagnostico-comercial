import { isAdminEmail } from "@/lib/auth/admin";
import { getSessionUser } from "@/lib/auth/sessionUser";
import { findAuthorityAssessmentSnapshot } from "@/lib/repositories/authorityRepository";
import { renderAuthorityReport } from "@/lib/reports/authorityReportRenderer";
import { createAuthorityReportResponse } from "@/lib/reports/authorityReportRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([context.params, getSessionUser()]);

  return createAuthorityReportResponse({
    assessmentId: id,
    user,
    dependencies: {
      findSnapshot: findAuthorityAssessmentSnapshot,
      renderReport: renderAuthorityReport,
      isAdmin: (email) => isAdminEmail(email),
    },
  });
}
