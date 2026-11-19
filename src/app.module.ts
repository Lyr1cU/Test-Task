import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { CompaniesModule } from './companies/companies.module';
import { PrismaModule } from './prisma/prisma.module';
import { SalaryModule } from './salary/salary.module';
import { StaffModule } from './staff/staff.module';

@Module({
  imports: [PrismaModule, CompaniesModule, StaffModule, SalaryModule],
  controllers: [AppController],
})
export class AppModule {}
