export const affirmativeFocuses = ["women", "black", "disabled", "trans", "lgbtqia", "indigenous"] as const;
export type AffirmativeFocus = typeof affirmativeFocuses[number];

export const affirmativeFocusLabels: Record<AffirmativeFocus, string> = {
  women: "Mulheres",
  black: "Pessoas negras",
  disabled: "Pessoas com deficiência",
  trans: "Pessoas trans",
  lgbtqia: "Pessoas LGBTQIA+",
  indigenous: "Pessoas indígenas",
};

// Search public professional mentions of initiatives. These words are never used to infer identity.
const publicTerms: Record<AffirmativeFocus, string[]> = {
  women: ["mulheres em tecnologia", "Women in Tech"],
  black: ["pessoas negras", "Black Tech"],
  disabled: ["pessoas com deficiência", "programa PcD"],
  trans: ["pessoas trans", "profissionais trans"],
  lgbtqia: ["LGBTQIA+", "orgulho LGBTQIA+"],
  indigenous: ["pessoas indígenas", "talentos indígenas"],
};

export function buildAffirmativeProfileQueries(focuses: AffirmativeFocus[], initiative = "") {
  const namedInitiative = initiative
    .replace(/[^\p{L}\p{N}\s&.\-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  const terms = [...new Set(focuses.flatMap((focus) => publicTerms[focus].slice(0, namedInitiative ? 1 : 2)))];
  const groupQuery = `(${terms.map((term) => `"${term}"`).join(" OR ")})`;
  return namedInitiative ? [`"${namedInitiative}"`, groupQuery] : [groupQuery];
}

export function hasPublicAffirmativeMention(summary: string | undefined, focuses: AffirmativeFocus[], initiative = "") {
  const text = normalized(summary || "");
  if (!text) return false;
  const namedInitiative = normalized(initiative.trim());
  if (namedInitiative && text.includes(namedInitiative)) return true;
  return focuses.some((focus) => publicTerms[focus].some((term) => text.includes(normalized(term))));
}

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}
