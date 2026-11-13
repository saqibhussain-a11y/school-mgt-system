// Template for prisma/seed.ts, which is git-ignored so real Super Admin
// credentials never reach the repository. To use it:
//   cp packages/db/prisma/seed.example.ts packages/db/prisma/seed.ts
// then set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (in packages/db/.env or
// the shell) and run `npm run db:seed`.
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src";

const SCHOOL_SUBDOMAIN = "default";
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD before seeding.");
  }

  const school = await prisma.school.upsert({
    where: { subdomain: SCHOOL_SUBDOMAIN },
    update: {},
    create: { name: "Default School", subdomain: SCHOOL_SUBDOMAIN },
  });
  console.log(`Seeded school "${school.name}" (id: ${school.id})`);

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const admin = await prisma.platformAdmin.upsert({
    where: { email: ADMIN_EMAIL },
    update: { firstName: "Platform", lastName: "Admin" },
    create: { email: ADMIN_EMAIL, passwordHash, firstName: "Platform", lastName: "Admin" },
  });
  console.log(`Seeded platform admin: ${admin.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
