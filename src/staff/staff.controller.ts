import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { StaffService } from './staff.service';

@Controller('companies/:companyId/staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Post()
  create(@Param('companyId') companyId: string, @Body() dto: CreateStaffDto) {
    return this.staff.create(companyId, dto);
  }

  @Get()
  list(@Param('companyId') companyId: string) {
    return this.staff.list(companyId);
  }

  @Get(':staffId')
  get(
    @Param('companyId') companyId: string,
    @Param('staffId') staffId: string,
  ) {
    return this.staff.get(companyId, staffId);
  }

  @Patch(':staffId')
  update(
    @Param('companyId') companyId: string,
    @Param('staffId') staffId: string,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.staff.update(companyId, staffId, dto);
  }

  @Delete(':staffId')
  @HttpCode(204)
  async remove(
    @Param('companyId') companyId: string,
    @Param('staffId') staffId: string,
  ): Promise<void> {
    await this.staff.remove(companyId, staffId);
  }
}
