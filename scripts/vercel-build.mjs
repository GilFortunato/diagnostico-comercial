import { spawnSync } from "node:child_process";

function run(command, args, { allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });

  if (result.status !== 0 && !allowFailure) {
    process.exit(result.status ?? 1);
  }
}

run("pnpm", ["exec", "prisma", "generate"]);

if (process.env.VERCEL_ENV === "production") {
  run("pnpm", ["exec", "prisma", "migrate", "resolve", "--rolled-back", "20260831040000_add_hr_hunting"], { allowFailure: true });
  run("pnpm", ["exec", "prisma", "migrate", "resolve", "--applied", "20260913183000_add_humanship_role_rules"], { allowFailure: true });
  run("pnpm", ["exec", "prisma", "migrate", "deploy"]);
} else {
  console.log("[vercel-build] Preview/development: skipping prisma migrate deploy.");
}

run("pnpm", ["exec", "next", "build"]);
