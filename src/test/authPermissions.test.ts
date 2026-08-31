import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getAppNavigation } from "@/lib/auth/navigation";
import { resolveUserModuleAccess } from "@/lib/auth/moduleAccessPolicy";

test("Admin vê a área administrativa e usuário comum não vê", () => {
  assert.ok(getAppNavigation(true).some((item) => item.label === "Admin"));
  assert.equal(getAppNavigation(false).some((item) => item.label === "Admin"), false);
});

test("permissão explícita de módulo prevalece sobre o padrão", () => {
  assert.equal(resolveUserModuleAccess("authority.personal", { active: true, admin: false, explicitValue: false }), false);
  assert.equal(resolveUserModuleAccess("authority.company", { active: true, admin: false, explicitValue: true }), true);
});

test("conta desativada não acessa nem módulos liberados", () => {
  assert.equal(resolveUserModuleAccess("authority.personal", { active: false, admin: false, explicitValue: true }), false);
  assert.equal(resolveUserModuleAccess("authority.personal", { active: false, admin: true }), false);
});

test("Admin ativo possui acesso administrativo aos módulos", () => {
  assert.equal(resolveUserModuleAccess("authority.leader", { active: true, admin: true }), true);
});

test("API de usuários não seleciona nem devolve senha", async () => {
  const source = await readFile("src/app/api/admin/users/route.ts", "utf8");
  assert.doesNotMatch(source, /password|senha|credentialHash/i);
  assert.match(source, /Acesso restrito a administradores/);
});
