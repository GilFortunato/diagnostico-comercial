import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCompanies } from "@/lib/decision-makers/normalization";

test("normalizes a nested LinkedIn company URL for B2B decision-maker handoff", () => {
  const companies = normalizeCompanies([
    {
      name: "Empresa Exemplo",
      website: "https://empresaexemplo.com.br",
      metadata: {
        navigation: {
          target: "https://www.linkedin.com/company/empresa-exemplo/?trk=public_profile",
        },
      },
    },
  ], "test");

  assert.equal(companies.length, 1);
  assert.equal(companies[0]?.linkedinUrl, "https://www.linkedin.com/company/empresa-exemplo");
});

test("prefers company LinkedIn URLs and does not mistake profile URLs for company pages", () => {
  const companies = normalizeCompanies([
    {
      companyName: "Outra Empresa",
      url: "https://www.linkedin.com/in/pessoa-exemplo",
      company: {
        navigationUrl: "https://www.linkedin.com/company/outra-empresa/",
      },
    },
  ], "test");

  assert.equal(companies.length, 1);
  assert.equal(companies[0]?.linkedinUrl, "https://www.linkedin.com/company/outra-empresa");
});
