import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { StaffMember } from '@prisma/client';
import { CompaniesService } from '../companies/companies.service';
import { parseDateOnly } from '../common/dates';
import { fromCents } from '../common/money';
import { PrismaService } from '../prisma/prisma.service';
import {
  calculateSalaries,
  HierarchyCycleError,
  payrollTotalCents,
  SalaryBreakdown,
  SalaryNode,
} from './salary-calculator';

export interface SalaryView {
  id: string;
  name: string;
  type: StaffMember['type'];
  employed: boolean;
  years: number;
  baseSalary: number;
  tenureBonus: number;
  subordinateBonus: number;
  total: number;
}

@Injectable()
export class SalaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompaniesService,
  ) {}

  async payroll(companyId: string, on: string) {
    await this.companies.requireCompany(companyId);
    const staff = await this.prisma.staffMember.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
    const breakdowns = this.calculate(staff, on);

    return {
      companyId,
      on,
      total: fromCents(payrollTotalCents(breakdowns.values())),
      members: staff.map((member) =>
        this.present(member, this.readLine(breakdowns, member.id)),
      ),
    };
  }

  async forMember(companyId: string, staffId: string, on: string) {
    const payroll = await this.payroll(companyId, on);
    const member = payroll.members.find((line) => line.id === staffId);
    if (!member) {
      throw new NotFoundException('Staff member not found');
    }

    return { companyId, on, ...member };
  }

  private calculate(staff: StaffMember[], on: string) {
    const nodes: SalaryNode[] = staff.map((member) => ({
      id: member.id,
      type: member.type,
      joinedAt: member.joinedAt,
      baseSalaryCents: member.baseSalaryCents,
      supervisorId: member.supervisorId,
    }));

    try {
      return calculateSalaries(nodes, parseDateOnly(on));
    } catch (error) {
      if (error instanceof HierarchyCycleError) {
        throw new InternalServerErrorException(error.message);
      }
      throw error;
    }
  }

  private readLine(
    breakdowns: Map<string, SalaryBreakdown>,
    id: string,
  ): SalaryBreakdown {
    const line = breakdowns.get(id);
    if (!line) {
      throw new NotFoundException('Staff member not found');
    }
    return line;
  }

  private present(member: StaffMember, line: SalaryBreakdown): SalaryView {
    return {
      id: member.id,
      name: member.name,
      type: member.type,
      employed: line.employed,
      years: line.years,
      baseSalary: fromCents(line.baseSalaryCents),
      tenureBonus: fromCents(line.tenureBonusCents),
      subordinateBonus: fromCents(line.subordinateBonusCents),
      total: fromCents(line.totalCents),
    };
  }
}
