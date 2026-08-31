import { isAdminEmail } from "@/lib/auth/admin";
import { authorizeModule } from "@/lib/auth/moduleRequest";
import { findAuthorityAssessmentSnapshot } from "@/lib/repositories/authorityRepository";
import { renderAuthorityReport } from "@/lib/reports/authorityReportRenderer";
import { createAuthorityReportResponse } from "@/lib/reports/authorityReportRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const [{ id }, access] = await Promise.all([context.params, authorizeModule("authority.personal")]);
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

  return createAuthorityReportResponse({
    assessmentId: id,
    user: access.user,
    dependencies: {
      findSnapshot: findAuthorityAssessmentSnapshot,
      renderReport: renderAuthorityReport,
      isAdmin: (email) => isAdminEmail(email),
    },
  });
}
