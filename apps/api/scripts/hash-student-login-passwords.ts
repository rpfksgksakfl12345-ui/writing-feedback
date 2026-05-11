import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/services/auth";

const prisma = new PrismaClient();

function isBcryptHash(value: string) {
  return /^\$2[aby]\$\d{2}\$/.test(value);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const studentProfiles = await prisma.studentProfile.findMany({
    select: {
      id: true,
      classroomLoginPassword: true,
    },
  });

  const plaintextProfiles = studentProfiles.filter(
    (profile) =>
      profile.classroomLoginPassword.trim() &&
      !isBcryptHash(profile.classroomLoginPassword)
  );

  if (dryRun) {
    console.log(
      `${plaintextProfiles.length} student login password(s) would be hashed.`
    );
    return;
  }

  for (const profile of plaintextProfiles) {
    await prisma.studentProfile.update({
      where: { id: profile.id },
      data: {
        classroomLoginPassword: await hashPassword(profile.classroomLoginPassword),
      },
    });
  }

  console.log(`${plaintextProfiles.length} student login password(s) hashed.`);
}

main()
  .catch((error) => {
    console.error("Failed to hash existing student login passwords.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
