import "server-only";
import { inflateRawSync } from "node:zlib";
import {
  normalizedLinkedInSnapshotSchema,
  type NormalizedLinkedInSnapshot,
} from "@/lib/connectors/linkedinNormalization";

export type LinkedInImportSummary = {
  collectedAt: string;
  filesUsed: string[];
  name: string;
  headline: string;
  experiences: number;
  education: number;
  certifications: number;
  skills: number;
  posts: number;
  commentsDetected: boolean;
};

type ArchiveTextEntry = { name: string; text: string };

type CsvRecord = Record<string, string>;

const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 30 * 1024 * 1024;
const MAX_ENTRY_BYTES = 8 * 1024 * 1024;

export function parseLinkedInArchive(buffer: ArrayBuffer, filename: string, profileUrl: string) {
  const lower = filename.toLocaleLowerCase("pt-BR");
  if (!lower.endsWith(".zip") && !lower.endsWith(".csv")) {
    throw new Error("Formato não suportado. Envie o arquivo .zip recebido do LinkedIn ou um .csv exportado por ele.");
  }
  if (buffer.byteLength > MAX_ARCHIVE_BYTES) {
    throw new Error("O arquivo excede o limite de 25 MB.");
  }

  const entries = lower.endsWith(".zip")
    ? readZipTextEntries(Buffer.from(buffer))
    : [{ name: filename, text: decodeText(Buffer.from(buffer)) }];

  return parseLinkedInArchiveEntries(entries, profileUrl);
}

export function parseLinkedInArchiveEntries(entries: ArchiveTextEntry[], profileUrl: string) {
  const relevant = entries
    .map((entry) => ({ ...entry, basename: normalizeFileName(entry.name) }))
    .filter((entry) => entry.basename.endsWith(".csv"));

  if (!relevant.length) {
    throw new Error("O arquivo não contém CSVs reconhecíveis do LinkedIn.");
  }

  const filesUsed: string[] = [];
  const recordsFor = (...aliases: string[]) => {
    const match = relevant.find((entry) => aliases.some((alias) => entry.basename === `${alias}.csv` || entry.basename.includes(`${alias}.csv`)));
    if (!match) return [] as CsvRecord[];
    filesUsed.push(match.name);
    return csvToRecords(match.text);
  };

  const profileRows = recordsFor("profile", "perfil");
  const positionRows = recordsFor("positions", "position", "experiences", "experience", "cargos", "experiencias");
  const educationRows = recordsFor("education", "educacao", "formacao");
  const skillRows = recordsFor("skills", "competencias");
  const certificationRows = recordsFor("certifications", "certificates", "licenses and certifications", "certificacoes");
  const shareRows = recordsFor("shares", "posts", "publicacoes");
  const commentRows = recordsFor("comments", "comentarios");

  const profile = profileRows[0] ?? {};
  const firstName = readField(profile, "first name", "firstname", "primeiro nome", "nome");
  const lastName = readField(profile, "last name", "lastname", "sobrenome");
  const explicitName = readField(profile, "full name", "fullname", "name", "nome completo");
  const name = explicitName || [firstName, lastName].filter(Boolean).join(" ").trim();
  const collectedAt = new Date().toISOString();

  const experiences = positionRows.map((row) => ({
    role: readField(row, "title", "position", "job title", "cargo", "funcao"),
    company: readField(row, "company name", "company", "organization", "empresa"),
    location: nullable(readField(row, "location", "localizacao", "localidade")),
    employmentType: nullable(readField(row, "employment type", "tipo de emprego")),
    workMode: nullable(readField(row, "work mode", "location type", "modelo de trabalho")),
    startDate: nullable(readField(row, "started on", "start date", "from", "inicio")),
    endDate: nullable(readField(row, "finished on", "end date", "to", "fim")),
    description: nullable(readField(row, "description", "summary", "descricao")),
    skills: [] as string[],
    companyUrl: null as string | null,
  })).filter((item) => item.role || item.company || item.description);

  const education = educationRows.map((row) => ({
    institution: readField(row, "school name", "school", "institution", "instituicao", "escola"),
    degree: nullable(readField(row, "degree name", "degree", "qualification", "grau", "curso")),
    field: nullable(readField(row, "field of study", "field", "subject", "area de estudo", "area")),
    startDate: nullable(readField(row, "start date", "started on", "inicio")),
    endDate: nullable(readField(row, "end date", "finished on", "fim")),
    description: nullable(readField(row, "notes", "description", "activities", "descricao")),
  })).filter((item) => item.institution || item.degree || item.field);

  const certifications = certificationRows.map((row) => ({
    name: readField(row, "name", "title", "certificate name", "nome"),
    institution: nullable(readField(row, "authority", "issuer", "organization", "institution", "emissor", "instituicao")),
    issuedAt: nullable(readField(row, "started on", "issue date", "issued at", "data de emissao", "inicio")),
    credentialUrl: safeUrl(readField(row, "url", "credential url", "credentialurl", "link")),
  })).filter((item) => item.name);

  const skills = unique(skillRows.map((row) => readField(row, "name", "skill", "competencia", "nome")).filter(Boolean)).slice(0, 80);

  const posts = shareRows.map((row) => ({
    text: readField(row, "share commentary", "commentary", "text", "content", "post text", "comentario", "conteudo"),
    publishedAt: nullable(readField(row, "date", "published at", "created at", "data")),
    reactions: null as number | null,
    comments: null as number | null,
    reposts: null as number | null,
    url: safeUrl(readField(row, "sharelink", "share link", "url", "post url", "link")),
    mediaType: nullable(readField(row, "media type", "content type", "type", "tipo")),
  })).filter((item) => item.text).slice(0, 40);

  const snapshot = normalizedLinkedInSnapshotSchema.parse({
    schemaVersion: 2,
    profileUrl,
    collectedAt,
    profileAvailable: Boolean(profileRows.length || experiences.length || education.length),
    postsAvailable: posts.length > 0,
    userCommentsAvailable: commentRows.length > 0,
    name,
    headline: readField(profile, "headline", "title", "titulo"),
    about: readField(profile, "summary", "about", "description", "resumo", "sobre"),
    location: nullable(readField(profile, "geo location", "location", "localizacao")),
    experiences,
    education,
    certifications,
    skills,
    posts,
  });

  const summary = summarizeLinkedInSnapshot(snapshot, filesUsed, commentRows.length > 0);
  if (!snapshot.profileAvailable && !snapshot.postsAvailable && !snapshot.skills.length && !snapshot.certifications.length) {
    throw new Error("Os CSVs foram abertos, mas não encontrei dados profissionais utilizáveis. Tente solicitar o arquivo completo ou incluir Perfil, Cargos, Formação, Competências, Certificações e Publicações.");
  }

  return { snapshot, summary };
}

export function summarizeLinkedInSnapshot(snapshot: NormalizedLinkedInSnapshot, filesUsed: string[] = [], commentsDetected = snapshot.userCommentsAvailable): LinkedInImportSummary {
  return {
    collectedAt: snapshot.collectedAt,
    filesUsed: unique(filesUsed.map((item) => item.split(/[\\/]/).pop() || item)),
    name: snapshot.name,
    headline: snapshot.headline,
    experiences: snapshot.experiences.length,
    education: snapshot.education.length,
    certifications: snapshot.certifications.length,
    skills: snapshot.skills.length,
    posts: snapshot.posts.length,
    commentsDetected,
  };
}

function readZipTextEntries(buffer: Buffer): ArchiveTextEntry[] {
  const eocd = findEndOfCentralDirectory(buffer);
  const totalEntries = buffer.readUInt16LE(eocd + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocd + 16);
  let offset = centralDirectoryOffset;
  let totalUncompressed = 0;
  const output: ArchiveTextEntry[] = [];

  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("O ZIP do LinkedIn parece estar corrompido ou usa um formato não suportado.");
    }
    const flags = buffer.readUInt16LE(offset + 8);
    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const filenameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + filenameLength).toString("utf8");
    offset += 46 + filenameLength + extraLength + commentLength;

    if (!name.toLocaleLowerCase("pt-BR").endsWith(".csv")) continue;
    if (flags & 0x1) throw new Error("O arquivo ZIP está protegido por senha; envie uma exportação sem criptografia.");
    if (uncompressedSize > MAX_ENTRY_BYTES) continue;
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) throw new Error("O conteúdo descompactado excede o limite seguro para importação.");
    if (localHeaderOffset + 30 > buffer.length || buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) continue;

    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    let raw: Buffer;
    if (compression === 0) raw = compressed;
    else if (compression === 8) raw = inflateRawSync(compressed);
    else continue;
    output.push({ name, text: decodeText(raw) });
  }

  return output;
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const signature = 0x06054b50;
  const minOffset = Math.max(0, buffer.length - 65557);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === signature) return offset;
  }
  throw new Error("Não foi possível abrir o ZIP. Baixe novamente o arquivo diretamente do LinkedIn.");
}

function decodeText(buffer: Buffer) {
  const utf8 = buffer.toString("utf8").replace(/^\uFEFF/, "");
  return utf8.includes("�") ? buffer.toString("latin1").replace(/^\uFEFF/, "") : utf8;
}

function csvToRecords(text: string): CsvRecord[] {
  const rows = parseDelimited(text, detectDelimiter(text));
  if (rows.length < 2) return [];
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).filter((row) => row.some((value) => value.trim())).map((row) => {
    const record: CsvRecord = {};
    headers.forEach((header, index) => {
      if (header) record[header] = clean(row[index] ?? "");
    });
    return record;
  });
}

function parseDelimited(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
      continue;
    }
    if (!quoted && char === delimiter) { row.push(field); field = ""; continue; }
    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field); field = "";
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      continue;
    }
    field += char;
  }
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function detectDelimiter(text: string) {
  const sample = text.split(/\r?\n/).slice(0, 8).join("\n");
  const candidates = [",", ";", "\t"];
  return candidates.map((delimiter) => ({ delimiter, count: countDelimiter(sample, delimiter) })).sort((a, b) => b.count - a.count)[0]?.delimiter ?? ",";
}

function countDelimiter(text: string, delimiter: string) {
  let count = 0;
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '"') {
      if (quoted && text[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && text[index] === delimiter) count += 1;
  }
  return count;
}

function readField(record: CsvRecord, ...aliases: string[]) {
  for (const alias of aliases) {
    const value = record[normalizeHeader(alias)];
    if (value) return value;
  }
  return "";
}

function normalizeFileName(value: string) {
  return value.split(/[\\/]/).pop()?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim() ?? "";
}

function normalizeHeader(value: string) {
  return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim();
}

function clean(value: string) {
  return String(value ?? "").replace(/^\uFEFF/, "").replace(/\s+/g, " ").trim();
}

function nullable(value: string) {
  return value || null;
}

function safeUrl(value: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function unique(values: string[]) {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}
