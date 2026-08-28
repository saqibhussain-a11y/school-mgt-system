import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src";

const SCHOOL_SUBDOMAIN = "default";
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@school.test";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

async function main() {
  const school = await prisma.school.upsert({
    where: { subdomain: SCHOOL_SUBDOMAIN },
    update: {},
    create: {
      name: "Default School",
      subdomain: SCHOOL_SUBDOMAIN,
    },
  });

  console.log(`Seeded school "${school.name}" (id: ${school.id})`);

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admin = await prisma.platformAdmin.upsert({
    where: { email: ADMIN_EMAIL },
    update: { firstName: "Platform", lastName: "Admin" },
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      firstName: "Platform",
      lastName: "Admin",
    },
  });

  console.log(`Seeded platform admin: ${admin.email} / ${ADMIN_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
