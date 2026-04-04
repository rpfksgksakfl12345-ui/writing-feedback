import bcrypt from "bcrypt";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("password123", 10);

  const teacher = await prisma.user.upsert({
    where: { email: "teacher@test.com" },
    update: {},
    create: {
      email: "teacher@test.com",
      password,
      name: "Test Teacher",
      role: Role.TEACHER,
    },
  });

  await prisma.user.upsert({
    where: { email: "student1@test.com" },
    update: {},
    create: {
      email: "student1@test.com",
      password,
      name: "Student 1",
      role: Role.STUDENT,
      grade: 3,
    },
  });

  await prisma.user.upsert({
    where: { email: "student2@test.com" },
    update: {},
    create: {
      email: "student2@test.com",
      password,
      name: "Student 2",
      role: Role.STUDENT,
      grade: 4,
    },
  });

  const topicCount = await prisma.topic.count();

  if (topicCount === 0) {
    await prisma.topic.createMany({
      data: [
        {
          title: "What happened on the spring picnic",
          description: "Write about the moment you remember most.",
          grade: 3,
          teacherId: teacher.id,
        },
        {
          title: "My favorite place",
          description: "Explain why you like that place.",
          grade: 4,
          teacherId: teacher.id,
        },
      ],
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
