import type { AuthorityReportSnapshot } from "@/lib/reports/authorityReportModel";
import { buildAuthorityReportFilename } from "@/lib/reports/authorityReportModel";

export type ReportSessionUser = {
  id: string;
  email: string | null;
};

export type AuthorityReportRouteDependencies = {
  findSnapshot: (id: string) => Promise<AuthorityReportSnapshot | null>;
  renderReport: (snapshot: AuthorityReportSnapshot) => Promise<Buffer>;
  isAdmin: (email: string | null) => boolean;
};

export async function createAuthorityReportResponse({
  assessmentId,
  user,
  dependencies,
}: {
  assessmentId: string;
  user: ReportSessionUser | null;
  dependencies: AuthorityReportRouteDependencies;
}) {
  if (!user) return jsonError("Entre com sua conta Google para exportar o relatório.", 401);

  const snapshot = await dependencies.findSnapshot(assessmentId);
  if (!snapshot) return jsonError("Diagnóstico não encontrado.", 404);

  const canAccess = snapshot.ownerId === user.id || dependencies.isAdmin(user.email);
  if (!canAccess) return jsonError("Você não tem permissão para exportar este diagnóstico.", 403);

  const pdf = await dependencies.renderReport(snapshot);
  const filename = buildAuthorityReportFilename(
    snapshot.assessment.analyzedProfileName || snapshot.assessment.input.linkedinSnapshot?.name || "Nome não identificado",
    snapshot.assessment.createdAt,
  );

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdf.byteLength),
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
