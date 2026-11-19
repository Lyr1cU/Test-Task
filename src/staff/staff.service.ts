import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StaffMember } from '@prisma/client';
import { CompaniesService } from '../companies/companies.service';
import { formatDateOnly, parseDateOnly } from '../common/dates';
import { fromCents } from '../common/money';
import { readAmount } from '../common/read-amount';
import { PrismaService } from '../prisma/prisma.service';
import { canHaveSubordinates } from '../salary/roles';
import { CreateStaffDto } from './dto/create-staff.dto';
import { wouldCreateCycle } from './hierarchy';
import { UpdateStaffDto } from './dto/update-staff.dto';

const hierarchyTransaction = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
} as const;

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
  ) {}

  async create(companyId: string, dto: CreateStaffDto) {
    const company = await this.companies.requireCompany(companyId);
    const member = await this.prisma.$transaction(async (tx) => {
      if (dto.supervisorId) {
        await this.assertSupervisor(tx, companyId, dto.supervisorId);
      }
      return tx.staffMember.create({
        data: {
          name: dto.name,
          type: dto.type,
          joinedAt: parseDateOnly(dto.joinedAt),
          baseSalaryCents:
            dto.baseSalary === undefined
              ? company.defaultBaseSalaryCents
              : readAmount(dto.baseSalary),
          companyId,
          supervisorId: dto.supervisorId ?? null,
        },
      });
    }, hierarchyTransaction);

    return this.present(member);
  }

  async list(companyId: string) {
    await this.companies.requireCompany(companyId);
    const staff = await this.prisma.staffMember.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
    return staff.map((member) => this.present(member));
  }

  async get(companyId: string, staffId: string) {
    await this.companies.requireCompany(companyId);
    return this.present(await this.findStaff(this.prisma, companyId, staffId));
  }

  async update(companyId: string, staffId: string, dto: UpdateStaffDto) {
    await this.companies.requireCompany(companyId);
    const member = await this.prisma.$transaction(async (tx) => {
      await this.findStaff(tx, companyId, staffId);
      if (dto.supervisorId) {
        await this.assertSupervisor(tx, companyId, dto.supervisorId, staffId);
      }
      return tx.staffMember.update({
        where: { id: staffId },
        data: {
          name: dto.name,
          joinedAt:
            dto.joinedAt === undefined
              ? undefined
              : parseDateOnly(dto.joinedAt),
          baseSalaryCents:
            dto.baseSalary === undefined
              ? undefined
              : readAmount(dto.baseSalary),
          supervisorId: dto.supervisorId,
        },
      });
    }, hierarchyTransaction);

    return this.present(member);
  }

  async remove(companyId: string, staffId: string): Promise<void> {
    await this.companies.requireCompany(companyId);
    await this.prisma.$transaction(async (tx) => {
      await this.findStaff(tx, companyId, staffId);
      const reports = await tx.staffMember.count({
        where: { supervisorId: staffId },
      });
      if (reports > 0) {
        throw new BadRequestException(
          'Reassign subordinates before deleting this member',
        );
      }
      await tx.staffMember.delete({ where: { id: staffId } });
    }, hierarchyTransaction);
  }

  private async assertSupervisor(
    tx: Prisma.TransactionClient,
    companyId: string,
    supervisorId: string,
    memberId?: string,
  ): Promise<void> {
    const supervisor = await tx.staffMember.findFirst({
      where: { id: supervisorId, companyId },
    });
    if (!supervisor) {
      throw new BadRequestException(
        'Supervisor must belong to the same company',
      );
    }
    if (!canHaveSubordinates(supervisor.type)) {
      throw new BadRequestException(
        'Only managers and sales can have subordinates',
      );
    }
    if (!memberId) {
      return;
    }

    const links = await tx.staffMember.findMany({
      where: { companyId },
      select: { id: true, supervisorId: true },
    });
    if (wouldCreateCycle(links, memberId, supervisorId)) {
      throw new BadRequestException(
        'This assignment would create a cycle in the hierarchy',
      );
    }
  }

  private async findStaff(
    db: Prisma.TransactionClient | PrismaService,
    companyId: string,
    staffId: string,
  ): Promise<StaffMember> {
    const member = await db.staffMember.findFirst({
      where: { id: staffId, companyId },
    });
    if (!member) {
      throw new NotFoundException('Staff member not found');
    }
    return member;
  }

  private present(member: StaffMember) {
    return {
      id: member.id,
      companyId: member.companyId,
      name: member.name,
      type: member.type,
      joinedAt: formatDateOnly(member.joinedAt),
      baseSalary: fromCents(member.baseSalaryCents),
      supervisorId: member.supervisorId,
    };
  }
}
