import { IsDateOnly } from '../../common/is-date-only';

export class OnDateQueryDto {
  @IsDateOnly()
  on!: string;
}
