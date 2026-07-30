import bcrypt from "bcryptjs";
import { prisma, Role } from "../src";

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

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { schoolId_email: { schoolId: school.id, email: ADMIN_EMAIL } },
    update: {},
    create: {
      schoolId: school.id,
      email: ADMIN_EMAIL,
      passwordHash,
      role: Role.SUPER_ADMIN,
      firstName: "Super",
      lastName: "Admin",
    },
  });

  console.log(`Seeded school "${school.name}" (id: ${school.id})`);
  console.log(`Seeded super admin: ${admin.email} / ${ADMIN_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
