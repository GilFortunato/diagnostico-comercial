export type DecisionMakerCapability =
  | "discoverCompany"
  | "researchCompany"
  | "findDecisionMakers"
  | "researchPerson"
  | "findProfessionalContacts"
  | "verifyProfessionalContact"
  | "rankDecisionMakers"
  | "generateRapport"
  | "generateApproach";

export type DecisionMakerActorAudit = {
  capability: DecisionMakerCapability;
  connector: string;
  actorId: string;
  coverage: string;
  limitation: string;
  costRisk: string;
  recommendation: "reuse_now" | "candidate" | "future" | "avoid_duplicate";
};

export const decisionMakerActorAudit: DecisionMakerActorAudit[] = [
  {
    capability: "researchCompany",
    connector: "Apify LinkedIn Company",
    actorId: "harvestapi/linkedin-company",
    coverage: "Dados públicos da página da empresa no LinkedIn para contexto comercial.",
    limitation: "Depende da URL correta da empresa ou de uma etapa anterior de descoberta.",
    costRisk: "Baixo a moderado quando usado apenas para contas selecionadas.",
    recommendation: "reuse_now",
  },
  {
    capability: "findDecisionMakers",
    connector: "Apify LinkedIn Company Employees",
    actorId: "harvestapi/linkedin-company-employees",
    coverage: "Funcionários por empresa, filtros por cargo, localidade e modo de perfil.",
    limitation: "Não confirma organograma nem poder real de decisão; isso precisa ser inferido com confiança explícita.",
    costRisk: "Moderado; limitar resultados antes de enriquecer pessoas.",
    recommendation: "reuse_now",
  },
  {
    capability: "researchPerson",
    connector: "Apify LinkedIn Profile",
    actorId: "unseenuser/linkedin-profile",
    coverage: "Perfil público informado por URL para headline, sobre, experiências e recursos.",
    limitation: "Serve melhor após selecionar poucas pessoas relevantes.",
    costRisk: "Moderado se enriquecermos muitos perfis; usar top 5 primeiro.",
    recommendation: "reuse_now",
  },
  {
    capability: "researchPerson",
    connector: "Apify LinkedIn Profile Posts",
    actorId: "harvestapi/linkedin-profile-posts",
    coverage: "Posts públicos, temas, engajamento e sinais para rapport profissional.",
    limitation: "Nem todo perfil terá posts suficientes; não usar frequência como única métrica.",
    costRisk: "Moderado; coletar poucos posts recentes por pessoa selecionada.",
    recommendation: "reuse_now",
  },
  {
    capability: "discoverCompany",
    connector: "Google Search Results Scraper",
    actorId: "apify/google-search-scraper",
    coverage: "Pesquisa pública para encontrar site, página LinkedIn, notícias e sinais de conta.",
    limitation: "Resultados dependem de país, idioma e consulta; precisa de deduplicação e fonte.",
    costRisk: "Baixo se maxPagesPerQuery ficar em 1 no MVP.",
    recommendation: "candidate",
  },
  {
    capability: "findDecisionMakers",
    connector: "LinkedIn Profile Search Scraper No Cookies",
    actorId: "harvestapi/linkedin-profile-search",
    coverage: "Busca pessoas por empresa, cargo, localidade e termos.",
    limitation: "Pode retornar volume alto; precisa ranking antes de enriquecimento.",
    costRisk: "Moderado; limitar maxProfiles e evitar pesquisas redundantes.",
    recommendation: "candidate",
  },
  {
    capability: "discoverCompany",
    connector: "Google Maps Scraper",
    actorId: "compass/crawler-google-places",
    coverage: "Descoberta de empresas, endereços, site e telefone corporativo público.",
    limitation: "Mais útil para hunting local/SMB do que conta enterprise já conhecida.",
    costRisk: "Moderado; usar apenas quando a busca for por mercado/região, não por uma empresa já informada.",
    recommendation: "future",
  },
  {
    capability: "findProfessionalContacts",
    connector: "Google Maps Scraper / enrichment add-ons",
    actorId: "compass/crawler-google-places",
    coverage: "Pode retornar contatos corporativos públicos quando a fonte expuser esse dado.",
    limitation: "Não deve buscar dados pessoais sensíveis; contato precisa de fonte, tipo e verificação.",
    costRisk: "Alto se add-ons forem ativados sem controle.",
    recommendation: "future",
  },
  {
    capability: "rankDecisionMakers",
    connector: "Gemini",
    actorId: "provider:gemini",
    coverage: "Classifica papel provável, aderência, acessibilidade, confiança e próxima melhor ação.",
    limitation: "Não pode inventar pessoas, contatos, relações nem evidências.",
    costRisk: "Controlado por credencial do usuário; depende de prompt estruturado e entrada verificada.",
    recommendation: "reuse_now",
  },
  {
    capability: "generateRapport",
    connector: "Gemini",
    actorId: "provider:gemini",
    coverage: "Cria ângulos de rapport usando apenas evidências profissionais coletadas.",
    limitation: "Deve separar fato, provável, inferência e não verificado.",
    costRisk: "Baixo após ranking reduzir pessoas analisadas.",
    recommendation: "reuse_now",
  },
  {
    capability: "generateApproach",
    connector: "Gemini",
    actorId: "provider:gemini",
    coverage: "Gera abordagem por canal, relação e objetivo com explicabilidade.",
    limitation: "Não enviar mensagem nem executar ação externa sem aprovação humana.",
    costRisk: "Baixo; texto e preview antes de ação.",
    recommendation: "reuse_now",
  },
];

export const decisionMakerPipeline = [
  "Empresa e objetivo comercial",
  "Pesquisa pública de baixo custo",
  "Contexto da conta",
  "Possíveis pessoas estratégicas",
  "Ranking por evidência",
  "Enriquecimento dos top perfis",
  "Rapport Intelligence",
  "Abordagem com aprovação humana",
];

export function recommendationLabel(recommendation: DecisionMakerActorAudit["recommendation"]) {
  if (recommendation === "reuse_now") return "Reutilizar agora";
  if (recommendation === "candidate") return "Candidato";
  if (recommendation === "future") return "Futuro";
  return "Evitar duplicidade";
}
