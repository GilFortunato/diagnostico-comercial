import { neon } from "@neondatabase/serverless";

const migrationName = "20260830203000_add_users_profiles_permissions";
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) throw new Error("DATABASE_URL is required to recover the failed migration.");

const sql = neon(databaseUrl);
const failed = await sql`
  SELECT "id"
  FROM "_prisma_migrations"
  WHERE "migration_name" = ${migrationName}
    AND "finished_at" IS NULL
    AND "rolled_back_at" IS NULL
`;

if (failed.length) {
  await sql`
    UPDATE "_prisma_migrations"
    SET "rolled_back_at" = NOW()
    WHERE "migration_name" = ${migrationName}
      AND "finished_at" IS NULL
      AND "rolled_back_at" IS NULL
  `;
  console.log(`Recovered failed migration record: ${migrationName}`);
} else {
  console.log(`No failed migration record found: ${migrationName}`);
}
