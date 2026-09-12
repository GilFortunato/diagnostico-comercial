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
    principle: "Perfil, interesses profissionais e histórico de interação ajudam a determinar relevância; o feed também pode recomendar conteúdo de profissionais fora da rede quando existe relevância profissional suficiente.",
  },
  {
    id: "linkedin-dwell-time",
    evidenceClass: "OFFICIAL",
    title: "Leveraging Dwell Time to Improve Member Experiences on the LinkedIn Feed",
    url: "https://www.linkedin.com/blog/engineering/feed/leveraging-dwell-time-to-improve-member-experiences-on-the-linkedin-feed",
    principle: "Tempo de consumo e passagem rápida ajudam a modelar relevância, mas dwell time não fica disponível como métrica individual do autor e não existem segundos mágicos publicados pelo LinkedIn.",
  },
  {
    id: "linkedin-post-analytics",
    evidenceClass: "OFFICIAL",
    title: "Post analytics for your content",
    url: "https://www.linkedin.com/help/linkedin/answer/a516971/post-analytics-for-your-content",
    principle: "Impressões são exibições; pessoas alcançadas representam membros distintos estimados e devem ser analisadas separadamente.",
  },
  {
    id: "buffer-best-time-2026",
    evidenceClass: "EXTERNAL_STUDY",
    title: "Best Time to Post on LinkedIn in 2026: 4.8M Posts Analyzed",
    url: "https://buffer.com/resources/best-time-to-post-on-linkedin/",
    principle: "Em 4,8 milhões de posts, a janela geral de maior engajamento ficou entre 15h e 20h em dias úteis; quarta-feira às 16h foi o slot mais forte. É benchmark inicial, não regra para todo público.",
  },
  {
    id: "buffer-frequency-2026",
    evidenceClass: "EXTERNAL_STUDY",
    title: "How Often Should You Post on LinkedIn in 2026? Data From 2 Million+ Posts",
    url: "https://buffer.com/resources/how-often-to-post-on-linkedin/",
    principle: "A análise de mais de 2 milhões de posts e 94 mil contas aponta 2 a 5 posts por semana como uma faixa sustentável para ganhar consistência; maior frequência só deve ser recomendada quando a qualidade se sustenta.",
  },
  {
    id: "metricool-linkedin-2026",
    evidenceClass: "EXTERNAL_STUDY",
    title: "LinkedIn Study: Trends for 2026",
    url: "https://metricool.com/linkedin-trends-study/",
    principle: "Em 673.658 posts de 63.108 contas, carrosséis tiveram muito mais interações que imagens, posts com pergunta tiveram 77% mais comentários e quase 40% das interações ocorreram no primeiro dia.",
  },
  {
    id: "socialinsider-linkedin-2026",
    evidenceClass: "EXTERNAL_STUDY",
    title: "LinkedIn Organic Benchmarks 2026",
    url: "https://www.socialinsider.io/social-media-benchmarks/linkedin",
    principle: "Em 1,3 milhão de posts de páginas empresariais, documentos nativos e multi-image ficaram entre os formatos com maior engagement; o estudo é de Company Pages e não deve ser tratado como regra direta para perfis pessoais.",
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
- Diferencie internamente informação OFICIAL, ESTUDO EXTERNO e HEURÍSTICA SHARE AI. Não apresente heurística ou benchmark como regra oficial do LinkedIn.
- Potencial de circulação é uma leitura editorial qualitativa, nunca uma previsão do algoritmo.
`;
}

export function buildLinkedInAlgorithmPlanPromptSection() {
  return `
LINKEDIN DISTRIBUTION LAB — O PLANO DE 30 DIAS TAMBÉM DEVE ENSINAR DISTRIBUIÇÃO:

PRINCÍPIOS OFICIAIS DO LINKEDIN:
- Dwell Time: o tempo de consumo e o short dwell/skip ajudam o sistema a modelar relevância. O autor NÃO recebe uma métrica individual de dwell time; nunca invente segundos, taxa de retenção ou nota de dwell.
- O começo de um post precisa interromper o scroll com relevância, e o restante precisa entregar o payoff prometido. Isso é otimização editorial, não manipulação do algoritmo.
- O feed pode recomendar conteúdo fora da rede quando existe relevância profissional. O plano deve criar pontes semânticas entre território principal e comunidades profissionais adjacentes coerentes.
- Curtida, comentário e repost são sinais diferentes, mas o LinkedIn não publica uma tabela de pesos. Nunca diga que comentário vale X curtidas. Estratégicamente, comentário substantivo é preferível quando a pessoa realmente tem algo a acrescentar porque cria contexto e conversa.

BENCHMARKS EXTERNOS DE 2026 — USE COMO HIPÓTESE DE TESTE, NUNCA COMO REGRA:
- Buffer, 4,8 milhões de posts: janela geral forte entre 15h e 20h em dias úteis; quarta às 16h foi o melhor slot agregado. O plano deve testar horários e depois substituir o benchmark pelos dados da própria pessoa.
- Buffer, 2 milhões+ de posts / 94 mil+ contas: 2 a 5 posts por semana é uma faixa sustentável de partida. Não obrigue publicação diária e não aumente frequência se a qualidade cair.
- Metricool, 673.658 posts / 63.108 contas: posts com pergunta tiveram 77% mais comentários e quase 40% das interações ocorreram no primeiro dia. Use pergunta apenas quando ela admitir respostas reais; não transforme todo post em engagement bait.
- Metricool: carrosséis tiveram muito mais interações que imagens no conjunto estudado. Teste carrossel/documento quando o conteúdo for didático, sequencial ou comparativo; não force carrossel para qualquer assunto.
- Socialinsider, 1,3 milhão de posts de Company Pages: documentos nativos e multi-image ficaram entre os formatos de melhor engagement. Como a base é empresarial, trate o dado como referência de formato, não promessa para perfil pessoal.

O PLANO PRECISA COBRIR, DE FORMA PERSONALIZADA:
1. DWELL TIME LAB: pelo menos duas atividades devem ensinar a revisar as primeiras 2–3 linhas, criar tensão legítima, retirar introduções genéricas e conferir se o payoff entrega o que o gancho prometeu.
2. HOOK LAB: ensinar pelo menos três tipos de abertura adaptáveis — contradição/provocação, experiência observada e pergunta específica — sem clickbait.
3. COMENTÁRIOS ESTRATÉGICOS: em dias sem post, priorizar comentários de 2 a 6 linhas com ponto observado + leitura/experiência real + consequência ou pergunta. Nunca recomendar spam social do tipo 'excelente post'.
4. PONTES SEMÂNTICAS / BUBBLE BREAKER: identificar o território principal, uma comunidade adjacente e um tema de ponte que permita chegar a pessoas fora da rede sem abandonar o posicionamento.
5. FORMATO: testar texto, documento/carrossel, multi-image ou vídeo somente quando o formato melhorar a compreensão. Explicar por que o formato foi escolhido.
6. HORÁRIO: incluir experimentos de horário comparáveis. Começar por benchmarks de 15h–20h quando não houver histórico, mas revisar os próprios dados no meio e no fim do ciclo.
7. FREQUÊNCIA: trabalhar com qualidade sustentável; normalmente 2–5 posts/semana como hipótese inicial, intercalando comentários, respostas, análise, relacionamento e dias sem publicação.
8. PRIMEIRO DIA: responder comentários com substância quando surgirem e acompanhar o primeiro dia, sem afirmar que 'a primeira hora decide o post'.
9. MÉTRICAS: medir apenas o que existir — impressões, pessoas alcançadas, comentários, saves, reposts, sends, visitas ao perfil, seguidores, percentual fora da rede, conversas e oportunidades. Ausência de dado = não avaliado.
10. APRENDIZADO ADAPTATIVO: por volta do dia 14, revisar sinais reais e ajustar horário, formato, tema e frequência. No dia 30, fechar o próximo ciclo com base no histórico próprio, que passa a valer mais que benchmark externo.

REGRAS DE QUALIDADE:
- Cada atividade de algoritmo deve explicar: conceito em linguagem simples -> ação -> exemplo -> sinal a observar -> o que NÃO concluir.
- Não use a palavra 'viral' como promessa. Fale em potencial de distribuição, circulação fora da rede e resposta da audiência.
- Não crie práticas artificiais como 'comentar 15 minutos antes', 'ficar online 60 minutos', número mágico de hashtags ou peso fixo de ações.
- Se o diagnóstico mostrar baixa clareza de posicionamento, corrija perfil e território antes de aumentar frequência.
`;
}
