import {
  Equals,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SubmitApprovalRequestDraftDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  idempotencyKey!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  submissionReason!: string;

  @IsBoolean()
  @Equals(true, { message: '必须确认已人工核对工单、材料、仓库和出库证据' })
  confirmEvidenceReviewed!: true;

  @IsBoolean()
  @Equals(true, { message: '必须确认本次提交由人工主动发起' })
  confirmHumanSubmission!: true;

  @IsBoolean()
  @Equals(true, { message: '必须人工确认该材料不属于特殊材料审批范围' })
  confirmNormalMaterial!: true;

  @IsOptional()
  @IsBoolean()
  humanOverrideAiSuggestion?: boolean;
}
