import assert from "node:assert/strict";
import test from "node:test";
import { buildHumanshipLinkedinQueries, chooseHumanshipLinkedinMatch, personNameSimilarity } from "@/lib/humanship/linkedinMatch";
import { buildWhatsAppLink, normalizeWhatsAppPhone } from "@/lib/humanship/whatsapp";
import type { HrCandidate } from "@/lib/hr-hunting/types";

function candidate(input: Partial<HrCandidate> & Pick<HrCandidate, "name">): HrCandidate {
  return {
    id: input.id ?? input.name,
    name: input.name,
    currentTitle: input.currentTitle,
    currentCompany: input.currentCompany,
    profileUrl: input.profileUrl ?? "https://www.linkedin.com/in/teste",
    fitScore: 0,
    fitClassification: "Parcial",
    pointsToValidate: [],
    sourceName: "teste",
    confidence: "provável",
    evidence: [],
    contacts: [],
    shortlisted: false,
  };
}

test("Humanship treats a shortened LinkedIn name as a probable match", () => {
  const match = chooseHumanshipLinkedinMatch(
    { fullName: "Ariana Tardelli Ribeir", company: "Smart Consulting", jobTitle: "Head de RH" },
    [candidate({ name: "Ariana Tardelli", currentCompany: "Smart Consulting", currentTitle: "Head de RH", profileUrl: "https://www.linkedin.com/in/arianatardelli/" })],
  );
  assert.ok(match);
  assert.equal(match?.candidate.profileUrl, "https://www.linkedin.com/in/arianatardelli/");
  assert.ok(match?.confidence === "confirmed" || match?.confidence === "probable");
  assert.ok(personNameSimilarity("Ariana Tardelli Ribeir", "Ariana Tardelli") >= 0.68);
});

test("Humanship builds a second broader name query when the source name may contain an extra surname or typo", () => {
  const queries = buildHumanshipLinkedinQueries({ fullName: "Ariana Tardelli Ribeir", company: "Smart Consulting" });
  assert.equal(queries.length, 2);
  assert.match(queries[0], /Smart Consulting/);
  assert.equal(queries[1], '"Ariana Tardelli"');
});

test("Humanship does not accept a weak unrelated LinkedIn name", () => {
  const match = chooseHumanshipLinkedinMatch(
    { fullName: "Ariana Tardelli Ribeir", company: "Smart Consulting", jobTitle: "Head de RH" },
    [candidate({ name: "Mariana Souza", currentCompany: "Outra Empresa", currentTitle: "Analista" })],
  );
  assert.equal(match, null);
});

test("WhatsApp normalizes Brazilian mobile numbers and pre-fills the message", () => {
  assert.equal(normalizeWhatsAppPhone("(11) 99999-8888"), "5511999998888");
  assert.equal(normalizeWhatsAppPhone("+55 11 99999-8888"), "5511999998888");
  const url = buildWhatsAppLink("(11) 99999-8888", "Oi, Ana! Tudo bem?");
  assert.equal(url, "https://wa.me/5511999998888?text=Oi%2C%20Ana!%20Tudo%20bem%3F");
});
