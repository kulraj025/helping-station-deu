// ---------------------------------------------------------------------------
// Prisma CLI configuration (Prisma 7).
//
// The database URL is read from the environment so credentials never live in
// version control. `dotenv` is loaded here because Prisma 7 no longer does it
// implicitly.
// ---------------------------------------------------------------------------
import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

const schemaPath = path.join("prisma", "schema.prisma");

export default defineConfig({
  schema: schemaPath,
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/helpingstation?schema=public",
  },
});
