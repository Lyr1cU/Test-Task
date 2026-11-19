import 'dotenv/config';
import { PrismaClient, StaffType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.staffMember.updateMany({ data: { supervisorId: null } });
  await prisma.staffMember.deleteMany();
  await prisma.company.deleteMany();

  const company = await prisma.company.create({
    data: {
      name: 'Acme',
      defaultBaseSalaryCents: 1_000_000,
    },
  });

  const alice = await prisma.staffMember.create({
    data: {
      name: 'Alice',
      type: StaffType.sales,
      joinedAt: new Date(Date.UTC(2018, 0, 1)),
      baseSalaryCents: 1_000_000,
      companyId: company.id,
    },
  });

  const bob = await prisma.staffMember.create({
    data: {
      name: 'Bob',
      type: StaffType.manager,
      joinedAt: new Date(Date.UTC(2019, 5, 1)),
      baseSalaryCents: 1_000_000,
      companyId: company.id,
      supervisorId: alice.id,
    },
  });

  await prisma.staffMember.createMany({
    data: [
      {
        name: 'Carol',
        type: StaffType.employee,
        joinedAt: new Date(Date.UTC(2020, 1, 1)),
        baseSalaryCents: 1_000_000,
        companyId: company.id,
        supervisorId: bob.id,
      },
      {
        name: 'Dan',
        type: StaffType.employee,
        joinedAt: new Date(Date.UTC(2021, 2, 15)),
        baseSalaryCents: 1_000_000,
        companyId: company.id,
        supervisorId: bob.id,
      },
      {
        name: 'Eve',
        type: StaffType.employee,
        joinedAt: new Date(Date.UTC(2022, 0, 10)),
        baseSalaryCents: 1_200_000,
        companyId: company.id,
        supervisorId: alice.id,
      },
    ],
  });

  console.log(`Seeded company ${company.id}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
