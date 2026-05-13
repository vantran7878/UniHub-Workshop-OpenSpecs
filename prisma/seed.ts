import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_DEFAULT_EMAIL || 'admin@unihub.local';
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD;

  if (!adminPassword) {
    console.error('Environment variable ADMIN_DEFAULT_PASSWORD is required for seeding.');
    process.exit(1);
  }

  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(adminPassword, saltRounds);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      fullName: 'System Administrator',
      passwordHash,
      role: Role.admin,
      isActive: true,
    },
  });

  console.log(`Admin user seeded: ${adminUser.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
