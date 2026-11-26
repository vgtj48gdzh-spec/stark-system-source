import { IsString, Length } from 'class-validator';

export class ConfirmPerformanceSummaryCustomerBindingDto {
  @IsString()
  @Length(1, 100)
  matchedCustomerId!: string;

  @IsString()
  @Length(1, 500)
  confirmRemark!: string;
}
