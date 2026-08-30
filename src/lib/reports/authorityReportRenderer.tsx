import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { AuthorityReportDocument } from "@/lib/reports/authorityReportDocument";
import type { AuthorityReportSnapshot } from "@/lib/reports/authorityReportModel";

export async function renderAuthorityReport(snapshot: AuthorityReportSnapshot) {
  return renderToBuffer(<AuthorityReportDocument snapshot={snapshot} />);
}
