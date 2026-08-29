export const ptBrEditorialInstruction =
  "Escreva em português brasileiro (pt-BR), com ortografia, acentuação, concordância, regência e pontuação impecáveis.";

export const silentEditorialReviewInstruction =
  "Antes de devolver a resposta, faça uma revisão editorial silenciosa do próprio texto.";

const copyFixes: Array<[RegExp, string]> = [
  [/\bNao\b/g, "Não"],
  [/\bnao\b/g, "não"],
  [/\bJa\b/g, "Já"],
  [/\bja\b/g, "já"],
  [/\bHa\b/g, "Há"],
  [/\bha\b/g, "há"],
  [/\bAte\b/g, "Até"],
  [/\bate\b/g, "até"],
  [/\bdiagnostico\b/g, "diagnóstico"],
  [/\bDiagnostico\b/g, "Diagnóstico"],
  [/\bdiagnosticos\b/g, "diagnósticos"],
  [/\bDiagnosticos\b/g, "Diagnósticos"],
  [/\bevolucao\b/g, "evolução"],
  [/\bEvolucao\b/g, "Evolução"],
  [/\bpercepcao\b/g, "percepção"],
  [/\bPercepcao\b/g, "Percepção"],
  [/\busuario\b/g, "usuário"],
  [/\bUsuario\b/g, "Usuário"],
  [/\bpublico\b/g, "público"],
  [/\bPublico\b/g, "Público"],
  [/\bconteudo\b/g, "conteúdo"],
  [/\bConteudo\b/g, "Conteúdo"],
  [/\bconteudos\b/g, "conteúdos"],
  [/\bConteudos\b/g, "Conteúdos"],
  [/\bconfianca\b/g, "confiança"],
  [/\bConfianca\b/g, "Confiança"],
  [/\bevidencia\b/g, "evidência"],
  [/\bEvidencia\b/g, "Evidência"],
  [/\bevidencias\b/g, "evidências"],
  [/\bEvidencias\b/g, "Evidências"],
  [/\bproximo\b/g, "próximo"],
  [/\bProximo\b/g, "Próximo"],
  [/\bproxima\b/g, "próxima"],
  [/\bProxima\b/g, "Próxima"],
  [/\bproximos\b/g, "próximos"],
  [/\bProximos\b/g, "Próximos"],
  [/\bhistorico\b/g, "histórico"],
  [/\bHistorico\b/g, "Histórico"],
  [/\brecomendacao\b/g, "recomendação"],
  [/\bRecomendacao\b/g, "Recomendação"],
  [/\brecomendacoes\b/g, "recomendações"],
  [/\bRecomendacoes\b/g, "Recomendações"],
  [/\bterritorio\b/g, "território"],
  [/\bTerritorio\b/g, "Território"],
  [/\bterritorios\b/g, "territórios"],
  [/\bTerritorios\b/g, "Territórios"],
  [/\bRegua\b/g, "Régua"],
  [/\bregua\b/g, "régua"],
];

export function reviewPortugueseCopy(text: string) {
  return copyFixes.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text);
}

export function reviewPortugueseList(items: string[]) {
  return items.map((item) => reviewPortugueseCopy(item));
}

export function confidenceLabel(confidence: "confirmed" | "likely" | "inference" | "unverified") {
  if (confidence === "confirmed") return "Confirmado";
  if (confidence === "likely") return "Provável";
  if (confidence === "inference") return "Inferência";
  return "Não verificado";
}
