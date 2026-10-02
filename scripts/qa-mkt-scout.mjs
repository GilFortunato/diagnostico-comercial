/**
 * Local UI audit helper. Creates an untracked, development-only fixture route
 * from the real MKT Scout page's JSX, without changing its protected route.
 * Run `node scripts/qa-mkt-scout.mjs setup` before a local audit and
 * `node scripts/qa-mkt-scout.mjs cleanup` before build, commit, or handoff.
 * All API fixtures must be intercepted in the browser, never added to src.
 */
import { readFile, writeFile, mkdir, unlink, rmdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const root = process.cwd();
const directory = path.resolve(root, "src/app/scout-local-qa");
const target = path.join(directory, "page.tsx");
const marker = "// TEMPORARY MKT SCOUT LOCAL QA — DO NOT COMMIT";
const mode = process.argv[2];

if (!directory.startsWith(`${path.resolve(root)}${path.sep}`)) {
  throw new Error("QA route must stay inside the current workspace.");
}

if (mode === "cleanup") {
  const existing = await readFile(target, "utf8").catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (existing === null) {
    console.log("No temporary MKT Scout QA route exists.");
  } else {
    if (!existing.startsWith(marker)) throw new Error("Refusing to remove a route not created by this helper.");
    await unlink(target);
    await rmdir(directory);
    console.log("Temporary QA route removed. Protected application routes were not changed.");
  }
} else if (mode === "setup") {
  if (process.env.NODE_ENV === "production") throw new Error("Local QA cannot run in production mode.");
  const sourcePath = path.resolve(root, "src/app/sharetrendintelligence/page.tsx");
  const source = await readFile(sourcePath, "utf8");
  const parsed = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = parsed.statements.find((statement) => ts.isFunctionDeclaration(statement)
    && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword));
  const returned = component?.body?.statements.find((statement) => ts.isReturnStatement(statement));
  if (!returned?.expression) throw new Error("Could not find the MKT Scout page's direct JSX return.");
  const imports = parsed.statements.filter((statement) => ts.isImportDeclaration(statement)
    && ts.isStringLiteral(statement.moduleSpecifier)
    && statement.moduleSpecifier.text.startsWith("@/components/scout/"));
  if (!imports.length) throw new Error("Could not locate the real Scout component imports.");
  const page = `${marker}\nimport { notFound } from "next/navigation";\n${imports.map((statement) => statement.getText(parsed)).join("\n")}\n\nexport default async function LocalMktScoutAudit({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {\n  if (process.env.NODE_ENV !== "development") notFound();\n  const params = await searchParams;\n  const generationId = typeof params.generation === "string" ? params.generation : undefined;\n  const initialQuery = typeof params.q === "string" ? params.q : undefined;\n  return ${returned.expression.getText(parsed)};\n}\n`;
  await mkdir(directory, { recursive: true });
  await writeFile(target, page, { flag: "wx" });
  console.log("Created /scout-local-qa using real MKT Scout components and page JSX.");
  console.log("Use browser-only test fixtures. Run cleanup before build or commit.");
} else {
  throw new Error("Usage: node scripts/qa-mkt-scout.mjs setup|cleanup");
}
