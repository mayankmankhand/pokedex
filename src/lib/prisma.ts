import { PrismaClient } from "@prisma/client";

// Prevent multiple Prisma Client instances in development
// (Next.js hot-reloads cause module re-evaluation)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Shared filter for soft-deleted attachments.
// All attachment queries must use this to exclude REMOVED records.
// See docs/DATABASE.md "Soft-delete" section for details.
export const ACTIVE_ATTACHMENT_FILTER = { status: "ACTIVE" as const };
