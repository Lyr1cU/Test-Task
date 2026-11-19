import { Controller, Get, Param, Query } from '@nestjs/common';
import { OnDateQueryDto } from './dto/on-date-query.dto';
import { SalaryService } from './salary.service';

@Controller('companies/:companyId')
export class SalaryController {
  constructor(private readonly salary: SalaryService) {}

  @Get('payroll')
  payroll(
    @Param('companyId') companyId: string,
    @Query() query: OnDateQueryDto,
  ) {
    return this.salary.payroll(companyId, query.on);
  }

  @Get('staff/:staffId/salary')
  salaryOf(
    @Param('companyId') companyId: string,
    @Param('staffId') staffId: string,
    @Query() query: OnDateQueryDto,
  ) {
    return this.salary.forMember(companyId, staffId, query.on);
  }
}
