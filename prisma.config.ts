// Prisma CLI configuration (used by `prisma generate`, `migrate`, `db push`...).
// The runtime client connects via the Neon driver adapter in src/lib/prisma.ts.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations/introspection use a DIRECT (unpooled) connection.
    // Fall back to DATABASE_URL when no separate direct URL is provided.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
