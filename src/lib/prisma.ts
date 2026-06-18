import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../../generated/prisma/client.ts";

/**
 * Prisma 7 uses the WASM query compiler and connects through a driver adapter
 * (no Rust engine binary). For Neon we use the serverless WebSocket pool, which
 * supports interactive transactions (needed for nested writes).
 *
 * In serverless environments (Vercel) the module is reused across warm
 * invocations, so we memoise the client on `globalThis` to avoid exhausting
 * connections.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add it to your environment (.env locally, or Vercel project settings).",
    );
  }

  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

// Reuse the same client across warm serverless invocations (and dev hot-reloads)
// so we never open more than one connection pool per container instance.
globalForPrisma.prisma = prisma;
