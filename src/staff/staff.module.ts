import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

@Module({
  imports: [CompaniesModule],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
