import assert from "node:assert/strict";
import test from "node:test";
import { parseLinkedInArchiveEntries } from "@/lib/connectors/linkedinArchive";
import { mergeLinkedInSnapshots } from "@/lib/connectors/linkedinSnapshotMerge";
import { normalizeLinkedInPayload } from "@/lib/connectors/linkedinNormalization";

const profileUrl = "https://www.linkedin.com/in/pessoa-teste/";

test("LinkedIn archive imports profile, positions, education, skills, certifications and shares", () => {
  const { snapshot, summary } = parseLinkedInArchiveEntries([
    { name: "Profile.csv", text: 'First Name,Last Name,Headline,Summary,Geo Location\nAna,Silva,"Head de T&D","Atuo com IA aplicada ao trabalho","São Paulo"\n' },
    { name: "Positions.csv", text: 'Company Name,Title,Description,Location,Started On,Finished On\nEmpresa A,"Head de T&D","Implantei automação e reduzi lead time em 35%","São Paulo",2024,\n' },
    { name: "Education.csv", text: 'School Name,Degree Name,Field Of Study,Start Date,End Date\nUniversidade X,MBA,IA,2025,2026\n' },
    { name: "Skills.csv", text: 'Name\nInteligência Artificial\nAutomação\n' },
    { name: "Certifications.csv", text: 'Name,Authority,Started On,Url\nLean Six Sigma,Instituição Y,2026,https://example.com/cert\n' },
    { name: "Shares.csv", text: 'Date,ShareLink,ShareCommentary\n2026-09-01,https://www.linkedin.com/posts/teste,"Como aplicar IA no trabalho sem começar pela ferramenta"\n' },
    { name: "Comments.csv", text: 'Date,Link,Message\n2026-09-02,https://www.linkedin.com/posts/outro,"Concordo e acrescentaria um critério de adoção."\n' },
  ], profileUrl);

  assert.equal(snapshot.name, "Ana Silva");
  assert.equal(snapshot.headline, "Head de T&D");
  assert.equal(snapshot.experiences.length, 1);
  assert.equal(snapshot.education.length, 1);
  assert.equal(snapshot.skills.length, 2);
  assert.equal(snapshot.certifications.length, 1);
  assert.equal(snapshot.posts.length, 1);
  assert.equal(snapshot.userCommentsAvailable, true);
  assert.equal(summary.experiences, 1);
  assert.equal(summary.commentsDetected, true);
});

test("LinkedIn archive parser accepts semicolon CSV and Portuguese aliases", () => {
  const { snapshot } = parseLinkedInArchiveEntries([
    { name: "Perfil.csv", text: 'Nome completo;Título;Sobre;Localização\n"Maria Souza";"People Director";"Lidero times de RH";"Rio de Janeiro"\n' },
    { name: "Cargos.csv", text: 'Empresa;Cargo;Descrição;Início\nAcme;"People Director";"Estruturei a área de pessoas";2025\n' },
  ], profileUrl);

  assert.equal(snapshot.name, "Maria Souza");
  assert.equal(snapshot.headline, "People Director");
  assert.equal(snapshot.experiences[0]?.company, "Acme");
});

test("Imported LinkedIn profile remains authoritative while public data fills gaps and recent posts", () => {
  const imported = parseLinkedInArchiveEntries([
    { name: "Profile.csv", text: 'First Name,Last Name,Headline,Summary\nAna,Silva,"Head de T&D","Sobre oficial do arquivo"\n' },
    { name: "Positions.csv", text: 'Company Name,Title,Description\nEmpresa A,"Head de T&D","Descrição oficial"\n' },
  ], profileUrl).snapshot;

  const publicSnapshot = normalizeLinkedInPayload({
    profileUrl,
    profile: { fullName: "Ana S. Silva", headline: "Título público diferente", skills: ["IA"] },
    posts: [{ text: "Post público recente", publishedAt: "2026-09-14" }],
  });

  const merged = mergeLinkedInSnapshots(imported, publicSnapshot);
  assert.ok(merged);
  assert.equal(merged?.headline, "Head de T&D");
  assert.equal(merged?.about, "Sobre oficial do arquivo");
  assert.equal(merged?.experiences.length, 1);
  assert.equal(merged?.posts[0]?.text, "Post público recente");
  assert.ok(merged?.skills.includes("IA"));
});
