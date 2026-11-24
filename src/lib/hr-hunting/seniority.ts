const mid = /\b(plen[oa]|pl|mid[- ]level|intermedi[aá]ri[oa])\b/i;
const otherLevel = /\b(s[eê]nior|sr|j[uú]nior|jr|trainee|estagi[aá]ri[oa]|principal|head|diretor(?:a)?|director|chief|gerente|coordenador(?:a)?|s[oó]ci[oa]|managing partner|general counsel)\b/i;

export function requiresMidLevel(title: string, seniority?: string) {
  const value = seniority?.trim() || title;
  return mid.test(value) && !otherLevel.test(value);
}

export function midLevelInTitle(title = "") {
  return mid.test(title) && !otherLevel.test(title);
}
