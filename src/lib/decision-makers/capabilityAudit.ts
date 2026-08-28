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
    coverage: "Dados publicos da pagina da empresa no LinkedIn para contexto comercial.",
    limitation: "Depende da URL correta da empresa ou de uma etapa anterior de descoberta.",
    costRisk: "Baixo a moderado quando usado apenas para contas selecionadas.",
    recommendation: "reuse_now",
  },
  {
    capability: "findDecisionMakers",
    connector: "Apify LinkedIn Company Employees",
    actorId: "harvestapi/linkedin-company-employees",
    coverage: "Funcionarios por empresa, filtros por cargo, localidade e modo de perfil.",
    limitation: "Nao confirma organograma nem poder real de decisao; isso precisa ser inferido com confianca explicita.",
    costRisk: "Moderado; limitar resultados antes de enriquecer pessoas.",
    recommendation: "reuse_now",
  },
  {
    capability: "researchPerson",
    connector: "Apify LinkedIn Profile",
    actorId: "unseenuser/linkedin-profile",
    coverage: "Perfil publico informado por URL para headline, sobre, experiencias e skills.",
    limitation: "Serve melhor apos selecionar poucas pessoas relevantes.",
    costRisk: "Moderado se enriquecermos muitos perfis; usar top 5 primeiro.",
    recommendation: "reuse_now",
  },
  {
    capability: "researchPerson",
    connector: "Apify LinkedIn Profile Posts",
    actorId: "harvestapi/linkedin-profile-posts",
    coverage: "Posts publicos, temas, engajamento e sinais para rapport profissional.",
    limitation: "Nem todo perfil tera posts suficientes; nao usar frequencia como unica metrica.",
    costRisk: "Moderado; coletar poucos posts recentes por pessoa selecionada.",
    recommendation: "reuse_now",
  },
  {
    capability: "discoverCompany",
    connector: "Google Search Results Scraper",
    actorId: "apify/google-search-scraper",
    coverage: "SERP publica para encontrar site, pagina LinkedIn, noticias e sinais de conta.",
    limitation: "Resultados dependem de pais, idioma e consulta; precisa deduplicacao e fonte.",
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
    coverage: "Descoberta de empresas, enderecos, site e telefone corporativo publico.",
    limitation: "Mais util para hunting local/SMB do que conta enterprise ja conhecida.",
    costRisk: "Moderado; usar apenas quando a busca for por mercado/regiao, nao por uma empresa ja informada.",
    recommendation: "future",
  },
  {
    capability: "findProfessionalContacts",
    connector: "Google Maps Scraper / enrichment add-ons",
    actorId: "compass/crawler-google-places",
    coverage: "Pode retornar contatos corporativos publicos quando a fonte expuser esse dado.",
    limitation: "Nao deve buscar dados pessoais sensiveis; contato precisa fonte, tipo e verificacao.",
    costRisk: "Alto se add-ons forem ativados sem controle.",
    recommendation: "future",
  },
  {
    capability: "rankDecisionMakers",
    connector: "Gemini via AI Provider",
    actorId: "provider:gemini",
    coverage: "Classifica papel provavel, fit, acessibilidade, confianca e proxima melhor acao.",
    limitation: "Nao pode inventar pessoas, contatos, relacoes nem evidencias.",
    costRisk: "Controlado por credencial do usuario; depende de prompt estruturado e entrada verificada.",
    recommendation: "reuse_now",
  },
  {
    capability: "generateRapport",
    connector: "Gemini via AI Provider",
    actorId: "provider:gemini",
    coverage: "Cria angulos de rapport usando apenas evidencias profissionais coletadas.",
    limitation: "Deve separar fato, provavel, inferencia e nao verificado.",
    costRisk: "Baixo apos ranking reduzir pessoas analisadas.",
    recommendation: "reuse_now",
  },
  {
    capability: "generateApproach",
    connector: "Gemini via AI Provider",
    actorId: "provider:gemini",
    coverage: "Gera abordagem por canal, relacao e objetivo com explicabilidade.",
    limitation: "Nao enviar mensagem nem executar acao externa sem aprovacao humana.",
    costRisk: "Baixo; texto e preview antes de acao.",
    recommendation: "reuse_now",
  },
];

export const decisionMakerPipeline = [
  "Empresa e objetivo comercial",
  "Pesquisa publica barata",
  "Contexto da conta",
  "Possiveis pessoas estrategicas",
  "Ranking por evidencia",
  "Enriquecimento dos top perfis",
  "Rapport Intelligence",
  "Abordagem com aprovacao humana",
];

export function recommendationLabel(recommendation: DecisionMakerActorAudit["recommendation"]) {
  if (recommendation === "reuse_now") return "Reutilizar agora";
  if (recommendation === "candidate") return "Candidato";
  if (recommendation === "future") return "Futuro";
  return "Evitar duplicidade";
}
