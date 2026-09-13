import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { AuthorityReportDocument } from "@/lib/reports/authorityReportDocument";
import { AuthorityReportDocumentV2 } from "@/lib/reports/authorityReportDocumentV2";
import type { AuthorityReportSnapshot } from "@/lib/reports/authorityReportModel";

export async function renderAuthorityReport(snapshot: AuthorityReportSnapshot) {
  const isV2 = snapshot.assessment.dimensions?.length > 0
    && snapshot.assessment.dimensions.every((item) => item.key.startsWith("v2_"));
  return renderToBuffer(isV2
    ? <AuthorityReportDocumentV2 snapshot={snapshot} />
    : <AuthorityReportDocument snapshot={snapshot} />);
}
