import type { AuthorityAssessment } from "@/lib/diagnostics/authority";

const store = new Map<string, AuthorityAssessment[]>();

export async function saveAuthorityAssessment(assessment: AuthorityAssessment) {
  const key = assessment.input.businessUnitId;
  const items = store.get(key) ?? [];
  store.set(key, [assessment, ...items]);
  return assessment;
}

export async function listAuthorityAssessments(businessUnitId: string) {
  return store.get(businessUnitId) ?? [];
}
