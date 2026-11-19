import { StaffType } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { IsDateOnly } from '../../common/is-date-only';
import { MAX_SALARY } from '../../common/money';

export class CreateStaffDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(StaffType)
  type!: StaffType;

  @IsDateOnly()
  joinedAt!: string;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_SALARY)
  baseSalary?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  supervisorId?: string;
}
