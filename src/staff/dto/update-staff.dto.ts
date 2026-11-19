import {
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { IsDateOnly } from '../../common/is-date-only';
import { MAX_SALARY } from '../../common/money';

export class UpdateStaffDto {
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsDateOnly()
  joinedAt?: string;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_SALARY)
  baseSalary?: number;

  // null clears the supervisor. Omit the field to leave it unchanged.
  @ValidateIf((_, value: unknown) => value !== undefined && value !== null)
  @IsString()
  @IsNotEmpty()
  supervisorId?: string | null;
}
