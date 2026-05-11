import "dotenv/config";
import { randomBytes } from "crypto";
import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "../src/services/auth";

const prisma = new PrismaClient();

function getEmailArg() {
  const emailFlagIndex = process.argv.indexOf("--email");
  if (emailFlagIndex >= 0) {
    return process.argv[emailFlagIndex + 1]?.trim();
  }

  return process.argv[2]?.trim();
}

function createTemporaryPassword() {
  return randomBytes(8).toString("base64url");
}

async function main() {
  const email = getEmailArg();

  if (!email) {
    console.error(
      "Usage: npm run teacher:reset-password --workspace @writing-feedback/api -- teacher@example.com"
    );
    process.exitCode = 1;
    return;
  }

  const teacher = await prisma.user.findUnique({
    where: { email },
  });

  if (!teacher || teacher.role !== Role.TEACHER) {
    console.error("Teacher account not found.");
    process.exitCode = 1;
    return;
  }

  const temporaryPassword = createTemporaryPassword();

  await prisma.user.update({
    where: { id: teacher.id },
    data: {
      password: await hashPassword(temporaryPassword),
    },
  });

  console.log("Teacher password reset complete.");
  console.log(`Email: ${teacher.email}`);
  console.log(`Temporary password: ${temporaryPassword}`);
  console.log("Share this password once, then ask the teacher to change it after login.");
}

main()
  .catch((error) => {
    console.error("Failed to reset teacher password.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
