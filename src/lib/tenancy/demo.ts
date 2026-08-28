import { prosperContext } from "@/lib/tenancy/prosper";

export const demoOrganization = {
  id: "org_share_demo",
  name: "Share",
  slug: "share",
};

export const demoBusinessUnits = [
  {
    id: "bu_share",
    name: "Share",
    description: "Marca principal e contexto institucional.",
    brandPack: {
      primary: "#00563a",
      accent: "#9cff00",
      surface: "#eef8eb",
      voice: "corporativo, claro, consultivo",
    },
  },
  {
    id: "bu_prosper",
    name: "Prosper",
    description: "Habilidades digitais, aplicacao de IA, talentos e transformacao com impacto real de negocio.",
    brandPack: {
      primary: "#ff0048",
      secondary: "#5b19ef",
      accent: "#2ef2ce",
      surface: "#fff1f7",
      voice: "pratico, acessivel, transformador, conectado a negocio",
      context: prosperContext,
    },
  },
  {
    id: "bu_education_recruit",
    name: "Education Recruit",
    description: "Recrutamento e solucoes para educacao.",
    brandPack: {
      primary: "#00563a",
      accent: "#00d4c7",
      surface: "#eefcfa",
      voice: "especialista, objetivo, cuidadoso",
    },
  },
];
