import { IsNumber, IsString, Max, Min, IsNotEmpty } from 'class-validator';
import { MAX_SALARY } from '../../common/money';

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_SALARY)
  defaultBaseSalary!: number;
}
