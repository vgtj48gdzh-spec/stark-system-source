import http from './http';

export type ApprovalWarehouseCandidateStatus =
  | 'discovered'
  | 'evidence_ready'
  | 'owner_review_required';

export interface ApprovalWarehousePreviewQuery {
  limit?: number;
  candidateType?: 'supplier_payment' | 'reimbursement' | 'payment_request';
  sourceSystem?: 'stark_abc_sync' | 'stark_inventory' | 'stark_work_order';
  status?: ApprovalWarehouseCandidateStatus;
}

export interface ApprovalWarehouseEvidenceSummary {
  warehouse: Record<string, unknown> | null;
  material: Record<string, unknown> | null;
  supplier: Record<string, unknown> | null;
  workOrder: Record<string, unknown> | null;
  inventory: Record<string, unknown> | null;
  sourceEvidence: string[];
}

export interface ApprovalWarehousePreview {
  candidateRef: string;
  candidateType: string;
  sourceSystem: string;
  sourceEntityType: string;
  evidenceSummary: ApprovalWarehouseEvidenceSummary;
  amount: string | null;
  status: ApprovalWarehouseCandidateStatus;
  requiredGuards: string[];
  idempotencyKey: string;
  redactionPolicy: 'metadata_only_no_raw_pii';
  auditPolicy: 'append_only_candidate_preview_audit_required';
  boundary: {
    previewOnly: true;
    writesStark: false;
    createsApprovalRequest: false;
    createsPaymentIntent: false;
    confirmsBankSms: false;
    mutatesVirtualLedger: false;
    [key: string]: boolean;
  };
}

export interface CreateApprovalDraftPayload {
  candidateRef: string;
  idempotencyKey: string;
  draftReason?: string;
}

export interface SubmitApprovalDraftPayload {
  idempotencyKey: string;
  submissionReason: string;
  confirmHumanSubmission: true;
  confirmEvidenceReviewed: true;
  confirmNormalMaterial: true;
  humanOverrideAiSuggestion?: boolean;
}

export interface ApprovalRequestDraftSummary {
  id: number;
  draftNo: string;
  candidateRef: string;
  idempotencyKey: string;
  previewIdempotencyKey: string;
  evidenceRevision: number;
  draftStatus: string;
  amount: string | null;
  createdByUserId: number | null;
  linkedApprovalRequestId: number | null;
}

export function createApprovalRequest(payload: Record<string, unknown>) {
  return http.post('/approval-requests', payload);
}

export function getApprovalRequests(params?: { page?: number; pageSize?: number }) {
  return http.get('/approval-requests', { params });
}

export function getApprovalRequestDetail(id: string | number) {
  return http.get(`/approval-requests/${id}`);
}

export function getApprovalRequestPrecheck(id: string | number) {
  return http.get(`/approval-requests/${id}/precheck`);
}

export function approveApprovalRequest(id: string | number, payload: Record<string, unknown>) {
  return http.post(`/approval-requests/${id}/approve`, payload);
}

export function rejectApprovalRequest(id: string | number, payload: Record<string, unknown>) {
  return http.post(`/approval-requests/${id}/reject`, payload);
}

export function getApprovalWarehousePreviews(params: ApprovalWarehousePreviewQuery) {
  return http.get('/approval-requests/warehouse-preview', { params });
}

export function createApprovalDraftFromWarehousePreview(payload: CreateApprovalDraftPayload) {
  return http.post('/approval-request-drafts/warehouse-preview', payload);
}

export function submitApprovalRequestDraft(
  id: string | number,
  payload: SubmitApprovalDraftPayload,
) {
  return http.post(`/approval-request-drafts/${id}/submit`, payload);
}
