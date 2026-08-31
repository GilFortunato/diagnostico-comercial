import { buildBusinessUnitGuidance } from "@/lib/business-units/dna";
import type { AuthorityAssessment } from "@/lib/diagnostics/authority";
import { isGenericComment } from "@/lib/social-selling/contentQualityGate";
import { buildInterestGraphStrategy } from "@/lib/social-selling/linkedinAlgorithmStrategy";

export type SocialSellingAction =
  | "POST"
  | "COMMENT"
  | "REPLY"
  | "PROFILE"
  | "INTELLIGENCE"
  | "RAPPORT"
  | "OUTREACH"
  | "RELATIONSHIP"
  | "ANALYSIS"
  | "NO_PUBLISH";

export type SocialSellingObjective =
  | "AUTHORITY"
  | "EXPANSION"
  | "RELATIONSHIP"
  | "CONVERSION"
  | "BU_ACTIVATION";

export type SocialSellingDecision = {
  action: SocialSellingAction;
  objective: SocialSellingObjective;
  title: string;
  reason: string;
  actions: string[];
  territory: string;
  persona: string;
  signalToObserve: string;
  shouldPublish: boolean;
};

export type StrategicComment = {
  where: string;
  comment: string;
  objective: "EXPANSION" | "RELATIONSHIP" | "AUTHORITY";
  signalToObserve: string;
};

export function buildNextBestSocialSellingAction(assessment: AuthorityAssessment): SocialSellingDecision {
  const context = strategyContext(assessment);
  const weakest = assessment.dimensions
    .filter((item): item is typeof item & { score: number } => item.status === "evaluated" && item.score !== null)
    .sort((left, right) => left.score - right.score)[0];
  const headline = assessment.dimensions.find((item) => item.key === "headline_clarity")?.score ?? 0;
  const about = assessment.dimensions.find((item) => item.key === "about_clarity")?.score ?? 0;
  const conversations = assessment.dimensions.find((item) => item.key === "relevant_conversations")?.score ?? 0;

  if (headline < 55 || about < 55 || assessment.authoritySellingScore < 50) {
    return {
      action: "PROFILE",
      objective: "AUTHORITY",
      title: "Hoje, fortaleça o perfil antes de aumentar a exposição",
      reason: `${weakest?.label ?? "O posicionamento"} ainda limita a clareza sobre por que você deve ser ouvido em ${context.territory}. Publicar agora pode ampliar uma mensagem que ainda precisa de foco.`,
      actions: [
        "Não publique hoje.",
        `Revise headline e Sobre para ligar sua experiência a ${context.territory}.`,
        "Inclua apenas provas verificáveis e preserve sua identidade pessoal.",
      ],
      territory: context.territory,
      persona: context.persona,
      signalToObserve: "Clareza do perfil antes de uma nova publicação",
      shouldPublish: false,
    };
  }

  if (assessment.buAffinityScore < 55 || conversations < 55) {
    return {
      action: "RELATIONSHIP",
      objective: "EXPANSION",
      title: "Antes de abordar, construa familiaridade no território certo",
      reason: `Sua autoridade pessoal permite participar da conversa, mas a ligação com ${assessment.input.businessUnitName} ainda precisa aparecer de forma natural. Um comentário substantivo em discussões de ${context.persona} cria contexto sem transformar interação em pitch.`,
      actions: [
        `Encontre uma conversa pública de ${context.persona} sobre ${context.territory}.`,
        "Acrescente uma interpretação, consequência ou pergunta específica; não elogie de forma genérica.",
        "Não envie abordagem comercial ainda. Observe se a conversa continua.",
      ],
      territory: context.territory,
      persona: context.persona,
      signalToObserve: "Resposta ao comentário ou continuidade espontânea da conversa",
      shouldPublish: false,
    };
  }

  if (!assessment.input.recentContent.trim()) {
    return {
      action: "POST",
      objective: "AUTHORITY",
      title: "Transforme uma experiência real em uma tese pública",
      reason: `O perfil já sustenta o território de ${context.territory}, mas falta conteúdo recente para tornar essa associação visível. Uma publicação específica pode abrir contexto para futuras conversas com ${context.persona}.`,
      actions: [
        "Escolha uma experiência comprovada ou uma observação profissional real.",
        "Construa uma tese e um gancho que o corpo consiga entregar.",
        "Publique somente depois da revisão humana.",
      ],
      territory: context.territory,
      persona: context.persona,
      signalToObserve: "Comentários substantivos, visitas ao perfil e conversas iniciadas, quando informados",
      shouldPublish: true,
    };
  }

  return {
    action: "COMMENT",
    objective: "RELATIONSHIP",
    title: "Hoje, vale mais comentar do que publicar",
    reason: `Já existe conteúdo recente e uma base coerente de autoridade. O avanço mais inteligente agora é entrar em uma conversa de ${context.persona} sobre ${context.territory}, acrescentando repertório antes de qualquer abordagem.`,
    actions: [
      "Escolha uma conversa com proximidade estratégica real.",
      "Escreva de duas a seis linhas com ponto de vista, consequência ou pergunta específica.",
      "Se houver resposta, continue a conversa antes de pensar em pitch.",
    ],
    territory: context.territory,
    persona: context.persona,
    signalToObserve: "Qualidade da resposta e continuidade da conversa",
    shouldPublish: false,
  };
}

export function buildStrategicComment(input: { territory: string; persona: string; thesis: string }): StrategicComment {
  const comment = `A consequência prática em ${input.territory} costuma aparecer quando a decisão deixa de ser apenas técnica e passa a considerar o contexto de quem precisa adotar a mudança.\n\nPara ${input.persona}, que evidência separa uma iniciativa promissora de uma mudança que realmente merece escala?`;
  if (isGenericComment(comment)) throw new Error("A sugestão de comentário ficou genérica e precisa ser refeita.");
  return {
    where: `Conversas públicas de ${input.persona} ligadas a ${input.territory} e à tese: ${input.thesis}`,
    comment,
    objective: "RELATIONSHIP",
    signalToObserve: "Resposta substantiva, nova perspectiva ou continuidade da conversa",
  };
}

export function buildSocialSellingPromptSection() {
  return `
SOCIAL SELLING INTELLIGENCE:
- Decida primeiro qual ação gera maior avanço: POST, COMMENT, REPLY, PROFILE, INTELLIGENCE, RAPPORT, OUTREACH, RELATIONSHIP, ANALYSIS ou NO_PUBLISH.
- Publicar não é a resposta automática. Recomende não publicar quando perfil, tese, momento ou conversas em andamento pedirem outra prioridade.
- Comentário é microconteúdo: deve acrescentar ponto de vista, experiência fornecida, contraponto, pergunta específica, consequência ou interpretação. Proíba elogio genérico.
- Respostas devem aprofundar a conversa, não terminar em agradecimento automático.
- Preserve a sequência descoberta, relevância, interação, familiaridade, rapport, conversa e oportunidade. Nunca transforme comentário em pitch disfarçado.
- Toda ação deve explicar por quê, com quem, sobre o quê, objetivo e sinal real a observar.
- O plano é um Social Selling Sprint, não um calendário de posts e não exige publicação diária.
`;
}

function strategyContext(assessment: AuthorityAssessment) {
  const guidance = assessment.input.businessUnitContext ?? buildBusinessUnitGuidance(assessment.input.businessUnitId);
  const territory = assessment.bridgeOpportunities[0]?.title.split(" + ")[0] ?? guidance.territories[0] ?? assessment.input.businessUnitName;
  const persona = guidance.personas[0] ?? guidance.icps[0] ?? "decisores do ICP";
  const interestGraph = buildInterestGraphStrategy({
    personalThemes: assessment.input.themes.split(",").map((item) => item.trim()).filter(Boolean),
    territory,
    persona,
    businessUnit: assessment.input.businessUnitName,
  });
  return { guidance, territory, persona, interestGraph };
}
