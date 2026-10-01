import assert from "node:assert/strict";
import test from "node:test";
import { classifyManualLinkedin, manualLinkedinSchema, normalizeManualLinkedinUrl, shouldSearchHumanshipParticipant } from "@/lib/humanship/manualLinkedin";

test("manual LinkedIn accepts profile links and removes tracking parameters", () => {
  for (const value of [" linkedin.com/in/test-person/ ", "https://br.linkedin.com/in/test-person?trk=search#about", "http://www.linkedin.com/in/test-person"]) {
    assert.equal(normalizeManualLinkedinUrl(value), "https://www.linkedin.com/in/test-person");
  }
});

test("manual LinkedIn rejects non-profile URLs and deceptive hosts", () => {
  for (const value of ["", "https://linkedin.com/company/example", "https://linkedin.com/in/", "https://linkedin.com.evil.test/in/person", "https://linkedin.com@evil.test/in/person", "https://user:pass@linkedin.com/in/person", "javascript:alert(1)", "https://linkedin.com/in/person/details", "https://linkedin.com:444/in/person"]) {
    assert.equal(manualLinkedinSchema.safeParse({ action: "linkedin", linkedinUrl: value }).success, false, value);
  }
});

test("manual profile remains subject to review even for an accepted role", () => {
  const result = classifyManualLinkedin({ sourceCompany: "Hesselbach", sourceTitle: "Head de RH", roleRuleDecision: "accepted" });
  assert.equal(result.classification, "validate");
  assert.match(result.reason, /informado manualmente/);
  assert.equal(result.roleAssessment.score, 100);
});

test("manual profile retains company restrictions and rejected roles", () => {
  assert.equal(classifyManualLinkedin({ sourceCompany: "Gupy", sourceTitle: "Head de RH" }).classification, "possible_rejected");
  assert.equal(classifyManualLinkedin({ sourceCompany: "Outra empresa", sourceTitle: "Head de RH", roleRuleDecision: "rejected" }).classification, "possible_rejected");
});

test("ordinary search and rescan preserve manually supplied LinkedIn", () => {
  assert.equal(shouldSearchHumanshipParticipant("manual"), false);
  assert.equal(shouldSearchHumanshipParticipant("manual", true), false);
  assert.equal(shouldSearchHumanshipParticipant("not_found"), true);
  assert.equal(shouldSearchHumanshipParticipant("found"), false);
  assert.equal(shouldSearchHumanshipParticipant("found", true), true);
});
