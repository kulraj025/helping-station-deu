#!/usr/bin/env node
/**
 * Zero-install development database.
 *
 * Runs PostgreSQL (compiled to WebAssembly) behind a local TCP socket so the
 * app can talk to it with the ordinary `pg` driver and Prisma — no Docker, no
 * local PostgreSQL install, no native build tools.
 *
 *   npm run db:dev
 *
 * Data is persisted in `.pgdata/` (git-ignored). For production, point
 * DATABASE_URL at any managed PostgreSQL instead.
 */
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const port = Number(process.env.DEV_DB_PORT ?? 5433);
const host = process.env.DEV_DB_HOST ?? "127.0.0.1";
const dataDir = process.env.DEV_DB_DIR ?? path.join(process.cwd(), ".pgdata");

console.log("Starting embedded PostgreSQL (PGlite)…");
const db = await PGlite.create({ dataDir });
const server = new PGLiteSocketServer({ db, port, host });

await server.start();

console.log("");
console.log("  ✅ Development database ready");
console.log("");
console.log(`  postgresql://postgres:postgres@${host}:${port}/postgres`);
console.log("");
console.log(`  Data directory: ${dataDir}`);
console.log("  Press Ctrl+C to stop.");
console.log("");

const shutdown = async () => {
  console.log("\nStopping development database…");
  try {
    await server.stop();
    await db.close();
  } finally {
    process.exit(0);
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
