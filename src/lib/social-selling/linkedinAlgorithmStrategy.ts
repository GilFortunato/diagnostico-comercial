export type StrategyEvidenceClass = "OFFICIAL" | "EXTERNAL_STUDY" | "SHARE_AI_HEURISTIC";

export type LinkedInStrategySource = {
  id: string;
  evidenceClass: StrategyEvidenceClass;
  title: string;
  url?: string;
  principle: string;
};

export type LinkedInMetricCategory =
  | "EXPOSURE"
  | "DISTRIBUTION"
  | "VALUE"
  | "CONVERSATION"
  | "AUTHORITY"
  | "RELATIONSHIP"
  | "COMMERCIAL";

export type LinkedInMetricKey =
  | "impressions"
  | "membersReached"
  | "outOfNetworkPercentage"
  | "reactions"
  | "comments"
  | "reposts"
  | "saves"
  | "sends"
  | "profileViews"
  | "followersGained"
  | "connections"
  | "conversations"
  | "meetings"
  | "opportunities";

export type LinkedInMetricSnapshot = Partial<Record<LinkedInMetricKey, number>>;

export type LinkedInMetricReading = {
  key: LinkedInMetricKey;
  category: LinkedInMetricCategory;
  value: number;
};

export type InterestGraphStrategy = {
  professionalSignal: string;
  inNetworkAction: string;
  outOfNetworkAction: string;
  coherencePrinciple: string;
  evidenceClass: "SHARE_AI_HEURISTIC";
};

const metricCategories: Record<LinkedInMetricKey, LinkedInMetricCategory> = {
  impressions: "EXPOSURE",
  membersReached: "EXPOSURE",
  outOfNetworkPercentage: "DISTRIBUTION",
  reactions: "CONVERSATION",
  comments: "CONVERSATION",
  reposts: "DISTRIBUTION",
  saves: "VALUE",
  sends: "VALUE",
  profileViews: "AUTHORITY",
  followersGained: "AUTHORITY",
  connections: "RELATIONSHIP",
  conversations: "RELATIONSHIP",
  meetings: "COMMERCIAL",
  opportunities: "COMMERCIAL",
};

export const linkedInStrategySources: LinkedInStrategySource[] = [
  {
    id: "linkedin-feed-relevance",
    evidenceClass: "OFFICIAL",
    title: "Engineering the next generation of LinkedIn's Feed",
    url: "https://www.linkedin.com/blog/engineering/feed/engineering-the-next-generation-of-linkedins-feed",
    principle: "Perfil, interesses profissionais e histórico de interação ajudam a determinar relevância; não há pesos públicos fixos para cada ação.",
  },
  {
    id: "linkedin-dwell-time",
    evidenceClass: "OFFICIAL",
    title: "Leveraging Dwell Time to Improve Member Experiences on the LinkedIn Feed",
    url: "https://www.linkedin.com/blog/engineering/feed/leveraging-dwell-time-to-improve-member-experiences-on-the-linkedin-feed",
    principle: "Tempo de consumo e passagem rápida ajudam a modelar relevância, mas não ficam disponíveis como métrica individual do autor.",
  },
  {
    id: "linkedin-post-analytics",
    evidenceClass: "OFFICIAL",
    title: "Post analytics for your content",
    url: "https://www.linkedin.com/help/linkedin/answer/a516971/post-analytics-for-your-content",
    principle: "Impressões são exibições; pessoas alcançadas representam membros distintos estimados e devem ser analisadas separadamente.",
  },
  {
    id: "share-interest-graph",
    evidenceClass: "SHARE_AI_HEURISTIC",
    title: "Estratégia de coerência profissional Share AI",
    principle: "Marca pessoal, território, interações, persona e BU devem formar um sinal profissional coerente sem virar propaganda.",
  },
];

export function classifyLinkedInMetrics(snapshot?: LinkedInMetricSnapshot): LinkedInMetricReading[] {
  if (!snapshot) return [];
  return (Object.entries(snapshot) as Array<[LinkedInMetricKey, number | undefined]>)
    .filter((entry): entry is [LinkedInMetricKey, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]) && entry[1] >= 0)
    .map(([key, value]) => ({ key, value, category: metricCategories[key] }));
}

export function buildInterestGraphStrategy(input: {
  personalThemes: string[];
  territory: string;
  persona: string;
  businessUnit: string;
}): InterestGraphStrategy {
  const themes = input.personalThemes.filter(Boolean).slice(0, 3);
  const themeSignal = themes.length ? themes.join(", ") : input.territory;
  return {
    professionalSignal: `${themeSignal} em diálogo com ${input.territory} para ${input.persona}`,
    inNetworkAction: `Aprofundar conversas em que ${input.territory} já aparece, acrescentando experiência, critério ou uma pergunta específica.`,
    outOfNetworkAction: `Entrar em conversas públicas de ${input.persona} sobre ${input.territory}, priorizando contribuição útil antes de conexão ou abordagem.`,
    coherencePrinciple: `A ${input.businessUnit} entra como contexto legítimo quando reforça o território da pessoa; se exigir uma identidade artificial, a ativação deve ser reduzida.`,
    evidenceClass: "SHARE_AI_HEURISTIC",
  };
}

export function buildLinkedInAlgorithmPromptSection() {
  return `
LINKEDIN ALGORITHM INTELLIGENCE:
- Trate relevância como coerência entre identidade profissional, conteúdo, interesses, relações e histórico de interação.
- Use dwell time e skip somente como princípios editoriais: o início precisa conquistar atenção e o desenvolvimento precisa recompensá-la. Nunca alegue acesso ao dwell time individual.
- Não invente analytics, pesos de algoritmo, equivalências entre reações ou previsões de viralidade.
- Impressões são exibições e não equivalem a pessoas únicas. Só analise alcance, audiência fora da rede, saves, sends, visitas ao perfil ou conversões quando esses dados forem fornecidos.
- Expansão para fora da rede deve buscar comunidades profissionais coerentes com território, persona e ICP, sem engajamento aleatório.
- Diferencie internamente informação OFICIAL, ESTUDO EXTERNO e HEURÍSTICA SHARE AI. Não apresente heurística como regra oficial do LinkedIn.
- Potencial de circulação é uma leitura editorial qualitativa, nunca uma previsão do algoritmo.
`;
}
