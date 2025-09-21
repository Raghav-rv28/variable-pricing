import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

declare global {
  var prismaGlobal: InstanceType<typeof PrismaClient>;
}

const adapter = new PrismaLibSQL({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient({ adapter });
  }
}

const prisma = global.prismaGlobal ?? new PrismaClient({ adapter });

export default prisma;
