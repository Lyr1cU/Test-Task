import { Injectable, NotFoundException } from '@nestjs/common';
import { Company } from '@prisma/client';
import { fromCents } from '../common/money';
import { readAmount } from '../common/read-amount';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCompanyDto) {
    const company = await this.prisma.company.create({
      data: {
        name: dto.name,
        defaultBaseSalaryCents: readAmount(dto.defaultBaseSalary),
      },
    });
    return this.present(company);
  }

  async list() {
    const companies = await this.prisma.company.findMany({
      orderBy: { name: 'asc' },
    });
    return companies.map((company) => this.present(company));
  }

  async get(companyId: string) {
    return this.present(await this.requireCompany(companyId));
  }

  async requireCompany(companyId: string): Promise<Company> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return company;
  }

  private present(company: Company) {
    return {
      id: company.id,
      name: company.name,
      defaultBaseSalary: fromCents(company.defaultBaseSalaryCents),
    };
  }
}
