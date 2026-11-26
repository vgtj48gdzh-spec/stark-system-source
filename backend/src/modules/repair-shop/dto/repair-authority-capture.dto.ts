import { IsObject } from 'class-validator';

// Each unchanged domain contract validates the exact closed command schema.
// No actor, readiness, operating-group or calculated wage is accepted here.
export class RepairAuthorityCaptureCommandDto {
  @IsObject()
  command!: Record<string, unknown>;
}

export enum RepairAuthorityCaptureFamily {
  Lineage = 'lineage',
  Assignment = 'assignment',
  Baseline = 'baseline',
}

export enum RepairAuthorityCaptureAction {
  LineagePropose = 'lineage-propose',
  LineageApprove = 'lineage-approve',
  AssignmentDraft = 'assignment-draft',
  AssignmentSubmit = 'assignment-submit',
  AssignmentDecide = 'assignment-decide',
  BaselineDraft = 'baseline-draft',
  BaselineSubmit = 'baseline-submit',
  BaselineDecide = 'baseline-decide',
}
