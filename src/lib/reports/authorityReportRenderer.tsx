import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { AuthorityReportDocumentV2 } from "@/lib/reports/authorityReportDocumentV2";
import type { AuthorityReportSnapshot } from "@/lib/reports/authorityReportModel";

export async function renderAuthorityReport(snapshot: AuthorityReportSnapshot) {
  return renderToBuffer(<AuthorityReportDocumentV2 snapshot={snapshot} />);
}
