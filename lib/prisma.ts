import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const user = encodeURIComponent(process.env.DB_USER || "postgres");
  const password = encodeURIComponent(process.env.DB_PASSWORD || "");
  const host = process.env.DB_HOST || "localhost";
  const port = parseInt(process.env.DB_PORT || "5432", 10);
  const dbName = process.env.DB_NAME || "mydb";
  const schema = process.env.DB_SCHEMA || "public";
  const connectionString = `postgresql://${user}:${password}@${host}:${port}/${dbName}?schema=${schema}`;
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
