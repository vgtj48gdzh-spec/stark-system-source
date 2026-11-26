import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectApprovalRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  remark!: string;
}
