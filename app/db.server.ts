import pkg from "@prisma/client";
const { PrismaClient } = pkg;

declare global {
  var prismaGlobal: InstanceType<typeof PrismaClient>;
}

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}

const prisma = global.prismaGlobal ?? new PrismaClient();

export default prisma;
