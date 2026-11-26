import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveApprovalRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
