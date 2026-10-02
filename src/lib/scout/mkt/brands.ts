import type { BrandId } from "./types";

export type BrandContext = {
  id: BrandId;
  name: string;
  description: string;
  editorialFocus: string;
  audience: string;
  voice: string;
  keywords: string[];
  avoid: string[];
};

// Initial editorial contexts, editable in one place; they do not assert official brand policy.
export const BRANDS: BrandContext[] = [
  {
    id: "share", name: "Share",
    editorialFocus: "pessoas e decisões no trabalho",
    description: "Pessoas, cultura e transformação do trabalho com uma perspectiva humana.",
    audience: "Lideranças, profissionais de RH e responsáveis por cultura e desenvolvimento.",
    voice: "Próxima, estratégica, clara e orientada à prática.",
    keywords: ["recursos humanos", "recrutamento", "trabalho", "emprego", "liderança", "cultura", "carreira", "gestão de pessoas", "talentos", "rh", "human resources", "hiring", "workforce", "workplace"],
    avoid: ["Promessas universais sobre produtividade", "Exposição de pessoas e casos sem consentimento", "Conclusões sobre empregabilidade sem evidência"],
  },
  {
    id: "ache", name: "Aché",
    editorialFocus: "qualidade da informação sobre saúde e cuidado",
    description: "Saúde, ciência, cuidado e informação responsável sobre bem-estar.",
    audience: "Profissionais de saúde e públicos interessados em ciência e cuidado.",
    voice: "Responsável, acolhedora e precisa; distinguir pesquisa de prática estabelecida.",
    keywords: ["saúde", "medicina", "ciência", "farmacêutica", "medicamento", "pesquisa clínica", "cuidado", "bem-estar", "health", "medicine", "clinical", "pharma"],
    avoid: ["Recomendação de diagnóstico ou tratamento", "Promessa terapêutica", "Alegações de eficácia sem referência", "Promoção de medicamentos sem revisão especializada"],
  },
  {
    id: "prosper", name: "Prosper",
    editorialFocus: "decisões comerciais e relacionamento com clientes",
    description: "Gestão comercial, crescimento de negócios e desenvolvimento de equipes.",
    audience: "Empreendedores, gestores comerciais e equipes de vendas.",
    voice: "Direta, consultiva e orientada a decisões verificáveis.",
    keywords: ["vendas", "comercial", "negócios", "empreendedorismo", "cliente", "consumo", "gestão", "mercado", "economia", "marketing", "sales", "business", "growth", "customer"],
    avoid: ["Promessas de receita garantida", "Projeções financeiras sem base", "Generalizações a partir de um único caso"],
  },
  {
    id: "potencia", name: "Potenc.IA",
    editorialFocus: "aprendizado e aplicação crítica de tecnologia",
    description: "Educação e aplicação crítica da inteligência artificial no trabalho e nos negócios.",
    audience: "Profissionais e organizações que querem compreender e aplicar IA.",
    voice: "Didática, curiosa e prática, com limites e fontes explícitos.",
    keywords: ["inteligência artificial", "ia", "automação", "tecnologia", "algoritmo", "aprendizado de máquina", "chatgpt", "openai", "artificial intelligence", "ai", "llm", "machine learning", "automation"],
    avoid: ["Hype sem demonstração", "Promessa de substituição total de pessoas", "Exposição de dados pessoais", "Confundir demonstração com produto disponível"],
  },
];

export function getBrandContext(id: BrandId): BrandContext {
  return BRANDS.find((brand) => brand.id === id) ?? BRANDS[0];
}
