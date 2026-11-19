import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

interface CompanyBody {
  id: string;
  defaultBaseSalary: number;
}

interface StaffBody {
  id: string;
  name: string;
  baseSalary: number;
  supervisorId: string | null;
}

interface SalaryBody {
  name: string;
  employed: boolean;
  years: number;
  tenureBonus: number;
  subordinateBonus: number;
  total: number;
}

interface PayrollBody {
  total: number;
  members: SalaryBody[];
}

describe('Staff payroll (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(() => {
    rmSync('prisma/e2e.db', { force: true });
    rmSync('prisma/e2e.db-journal', { force: true });
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      stdio: 'inherit',
      env: process.env,
    });
  });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.staffMember.updateMany({ data: { supervisorId: null } });
    await prisma.staffMember.deleteMany();
    await prisma.company.deleteMany();
  });

  it('calculates a nested payroll on a date', async () => {
    const company = await createCompany();
    expect(company.defaultBaseSalary).toBe(10000);

    const alice = await createStaff(company.id, {
      name: 'Alice',
      type: 'sales',
      joinedAt: '2020-01-01',
    });
    expect(alice.baseSalary).toBe(10000);
    const bob = await createStaff(company.id, {
      name: 'Bob',
      type: 'manager',
      joinedAt: '2020-01-01',
      supervisorId: alice.id,
    });
    await createStaff(company.id, {
      name: 'Carol',
      type: 'employee',
      joinedAt: '2020-01-01',
      supervisorId: bob.id,
    });
    await createStaff(company.id, {
      name: 'Dan',
      type: 'employee',
      joinedAt: '2020-01-01',
      supervisorId: alice.id,
    });
    await createStaff(company.id, {
      name: 'Eve',
      type: 'employee',
      joinedAt: '2026-01-01',
      supervisorId: bob.id,
    });

    const payroll = await payrollOn(company.id, '2024-06-01');
    const byName = new Map(
      payroll.members.map((member) => [member.name, member]),
    );
    expect(byName.get('Carol')).toMatchObject({
      employed: true,
      years: 4,
      tenureBonus: 1200,
      subordinateBonus: 0,
      total: 11200,
    });
    expect(byName.get('Eve')).toMatchObject({ employed: false, total: 0 });
    expect(byName.get('Bob')).toMatchObject({
      years: 4,
      tenureBonus: 2000,
      subordinateBonus: 56,
      total: 12056,
    });
    expect(byName.get('Alice')).toMatchObject({ years: 4, tenureBonus: 400 });
    expect(byName.get('Alice')?.subordinateBonus).toBeCloseTo(103.37, 2);
    expect(byName.get('Alice')?.total).toBeCloseTo(10503.37, 2);
    expect(payroll.total).toBeCloseTo(44959.37, 2);

    const aliceSalary = await request(app.getHttpServer())
      .get(`/companies/${company.id}/staff/${alice.id}/salary`)
      .query({ on: '2024-06-01' })
      .expect(200);
    expect((aliceSalary.body as SalaryBody).total).toBeCloseTo(10503.37, 2);
  });

  it('renames a member and deletes a leaf, then the manager', async () => {
    const company = await createCompany();
    const bob = await createStaff(company.id, {
      name: 'Bob',
      type: 'manager',
      joinedAt: '2020-01-01',
    });
    const carol = await createStaff(company.id, {
      name: 'Carol',
      type: 'employee',
      joinedAt: '2020-01-01',
      supervisorId: bob.id,
    });

    const renamed = await request(app.getHttpServer())
      .patch(`/companies/${company.id}/staff/${carol.id}`)
      .send({ name: 'Caroline', baseSalary: 11000 })
      .expect(200);
    expect(renamed.body as StaffBody).toMatchObject({
      name: 'Caroline',
      baseSalary: 11000,
      supervisorId: bob.id,
    });

    await request(app.getHttpServer())
      .delete(`/companies/${company.id}/staff/${carol.id}`)
      .expect(204);
    await request(app.getHttpServer())
      .get(`/companies/${company.id}/staff/${carol.id}`)
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/companies/${company.id}/staff/${bob.id}`)
      .expect(204);
  });

  it('returns 404 for an unknown company or staff member', async () => {
    await request(app.getHttpServer()).get('/companies/missing').expect(404);
    const company = await createCompany();
    await request(app.getHttpServer())
      .get(`/companies/${company.id}/staff/missing`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/companies/${company.id}/staff/missing/salary`)
      .query({ on: '2020-01-01' })
      .expect(404);
  });

  it('rejects an impossible date before it looks up the company', async () => {
    await request(app.getHttpServer())
      .get('/companies/missing/payroll')
      .query({ on: '2021-02-30' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/companies/missing/staff')
      .send({
        name: 'Ghost',
        type: 'employee',
        joinedAt: '2021-02-30',
      })
      .expect(400);
  });

  it('rejects null for fields that cannot be cleared', async () => {
    const company = await createCompany();
    const carol = await createStaff(company.id, {
      name: 'Carol',
      type: 'employee',
      joinedAt: '2020-01-01',
    });

    await request(app.getHttpServer())
      .patch(`/companies/${company.id}/staff/${carol.id}`)
      .send({ name: null })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/companies/${company.id}/staff/${carol.id}`)
      .send({ joinedAt: null })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/companies/${company.id}/staff/${carol.id}`)
      .send({ baseSalary: null })
      .expect(400);

    const stored = await request(app.getHttpServer())
      .get(`/companies/${company.id}/staff/${carol.id}`)
      .expect(200);
    expect(stored.body as StaffBody).toMatchObject({
      name: 'Carol',
      baseSalary: 10000,
    });
  });

  it('rejects amounts that are not a currency number', async () => {
    const company = await createCompany();
    for (const baseSalary of ['', true, 10.129]) {
      await request(app.getHttpServer())
        .post(`/companies/${company.id}/staff`)
        .send({
          name: 'Carol',
          type: 'employee',
          joinedAt: '2020-01-01',
          baseSalary,
        })
        .expect(400);
      await request(app.getHttpServer())
        .post('/companies')
        .send({ name: 'Bad', defaultBaseSalary: baseSalary })
        .expect(400);
    }

    const staff = await request(app.getHttpServer())
      .get(`/companies/${company.id}/staff`)
      .expect(200);
    expect(staff.body).toEqual([]);
  });

  it('rejects a salary that does not fit in a 32-bit integer and keeps reads working', async () => {
    await request(app.getHttpServer())
      .post('/companies')
      .send({ name: 'Too big', defaultBaseSalary: 30_000_000 })
      .expect(400);
    const companies = await request(app.getHttpServer())
      .get('/companies')
      .expect(200);
    expect(companies.body).toEqual([]);

    const company = await createCompany();
    await request(app.getHttpServer())
      .post(`/companies/${company.id}/staff`)
      .send({
        name: 'Carol',
        type: 'employee',
        joinedAt: '2020-01-01',
        baseSalary: 30_000_000,
      })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/companies/${company.id}/staff`)
      .send({
        name: 'Carol',
        type: 'employee',
        joinedAt: '2020-01-01',
        baseSalary: 21474836.48,
      })
      .expect(400);

    const accepted = await request(app.getHttpServer())
      .post(`/companies/${company.id}/staff`)
      .send({
        name: 'Max',
        type: 'employee',
        joinedAt: '2020-01-01',
        baseSalary: 21474836.47,
      })
      .expect(201);
    expect((accepted.body as StaffBody).baseSalary).toBeCloseTo(21474836.47, 2);

    const staff = await request(app.getHttpServer())
      .get(`/companies/${company.id}/staff`)
      .expect(200);
    expect(staff.body).toHaveLength(1);
    await payrollOn(company.id, '2020-01-01');
  });

  it('rejects a supervisor who cannot lead or who would close a cycle', async () => {
    const company = await createCompany();
    const other = await createCompany('Other', 8000);
    const alice = await createStaff(company.id, {
      name: 'Alice',
      type: 'sales',
      joinedAt: '2020-01-01',
    });
    const bob = await createStaff(company.id, {
      name: 'Bob',
      type: 'manager',
      joinedAt: '2020-01-01',
      supervisorId: alice.id,
    });
    const carol = await createStaff(company.id, {
      name: 'Carol',
      type: 'employee',
      joinedAt: '2020-01-01',
      supervisorId: bob.id,
    });
    const outsider = await createStaff(other.id, {
      name: 'Zoe',
      type: 'manager',
      joinedAt: '2020-01-01',
    });

    await request(app.getHttpServer())
      .patch(`/companies/${company.id}/staff/${alice.id}`)
      .send({ supervisorId: outsider.id })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/companies/${company.id}/staff`)
      .send({
        name: 'Frank',
        type: 'employee',
        joinedAt: '2020-01-01',
        supervisorId: carol.id,
      })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/companies/${company.id}/staff/${alice.id}`)
      .send({ supervisorId: bob.id })
      .expect(400);
    await request(app.getHttpServer())
      .delete(`/companies/${company.id}/staff/${bob.id}`)
      .expect(400);
  });

  it('reports a stored cycle as a server error, not a bad request', async () => {
    const company = await createCompany();
    const alice = await createStaff(company.id, {
      name: 'Alice',
      type: 'manager',
      joinedAt: '2020-01-01',
    });
    const bob = await createStaff(company.id, {
      name: 'Bob',
      type: 'manager',
      joinedAt: '2020-01-01',
    });
    await prisma.staffMember.update({
      where: { id: alice.id },
      data: { supervisorId: bob.id },
    });
    await prisma.staffMember.update({
      where: { id: bob.id },
      data: { supervisorId: alice.id },
    });

    await request(app.getHttpServer())
      .get(`/companies/${company.id}/payroll`)
      .query({ on: '2020-01-01' })
      .expect(500);
  });

  it('does not record a cycle when two supervisor changes run together', async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const company = await createCompany(`Race ${attempt}`);
      const alice = await createStaff(company.id, {
        name: 'Alice',
        type: 'manager',
        joinedAt: '2020-01-01',
      });
      const bob = await createStaff(company.id, {
        name: 'Bob',
        type: 'manager',
        joinedAt: '2020-01-01',
      });
      const [first, second] = await Promise.all([
        request(app.getHttpServer())
          .patch(`/companies/${company.id}/staff/${alice.id}`)
          .send({ supervisorId: bob.id }),
        request(app.getHttpServer())
          .patch(`/companies/${company.id}/staff/${bob.id}`)
          .send({ supervisorId: alice.id }),
      ]);

      expect([first.status, second.status].sort()).toEqual([200, 400]);
      await payrollOn(company.id, '2020-01-01');
    }
  });

  it('deletes a company that still has a hierarchy', async () => {
    const company = await createCompany();
    const bob = await createStaff(company.id, {
      name: 'Bob',
      type: 'manager',
      joinedAt: '2020-01-01',
    });
    await createStaff(company.id, {
      name: 'Carol',
      type: 'employee',
      joinedAt: '2020-01-01',
      supervisorId: bob.id,
    });

    await prisma.company.delete({ where: { id: company.id } });
    expect(
      await prisma.staffMember.count({ where: { companyId: company.id } }),
    ).toBe(0);
  });

  async function createCompany(
    name = 'Acme',
    defaultBaseSalary = 10000,
  ): Promise<CompanyBody> {
    const response = await request(app.getHttpServer())
      .post('/companies')
      .send({ name, defaultBaseSalary })
      .expect(201);
    return response.body as CompanyBody;
  }

  async function createStaff(
    companyId: string,
    body: Record<string, unknown>,
  ): Promise<StaffBody> {
    const response = await request(app.getHttpServer())
      .post(`/companies/${companyId}/staff`)
      .send(body)
      .expect(201);
    return response.body as StaffBody;
  }

  async function payrollOn(
    companyId: string,
    on: string,
  ): Promise<PayrollBody> {
    const response = await request(app.getHttpServer())
      .get(`/companies/${companyId}/payroll`)
      .query({ on })
      .expect(200);
    return response.body as PayrollBody;
  }
});
