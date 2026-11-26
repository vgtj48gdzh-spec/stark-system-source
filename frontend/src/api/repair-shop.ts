import http from './http';

export type RepairDocumentType =
  | 'intake_inspection'
  | 'diagnosis'
  | 'repair_plan'
  | 'quote'
  | 'customer_explanation';

export interface RepairScopePayload {
  companyRef: string;
  businessSectorRef: string;
  storeRef: string;
  customerRef: string;
}

export interface RepairVehiclePayload extends RepairScopePayload {
  plateNumber: string;
  plateEvidenceRef: string;
  customerRelationshipType: 'owner' | 'user' | 'contact';
  customerRelationshipEvidenceRef: string;
  vin: string;
  brand?: string;
  model?: string;
  modelYear?: number;
  engineCode?: string;
  salesMarket?: string;
  odometerKm?: number;
}

export function getRepairWorkspace(workOrderId: string | number) {
  return http.get(`/repair-shop/work-orders/${workOrderId}/workspace`);
}

export interface OwnerProposalDocumentInput {
  requestId: string;
  proposalVersion: number;
  proposalHash: string;
  materialBindings: Array<{ row: number; materialId: number }>;
}
export function getOwnerProposalDocumentSource(workOrderId: string | number) {
  return http.get(`/repair-shop/work-orders/${workOrderId}/owner-proposal-document-source`);
}

export function getAvailableBusinessScopes() {
  return http.get('/business-foundation/available-scopes');
}

export function getBusinessCustomers(params: Omit<RepairScopePayload, 'customerRef'>) {
  return http.get('/business-foundation/customers', { params });
}

export function getRepairVehicles(params: RepairScopePayload) {
  return http.get('/repair-shop/vehicles', { params });
}

export function createRepairVehicle(payload: RepairVehiclePayload) {
  return http.post('/repair-shop/vehicles', payload);
}

export function createRepairVehicleCustomerLink(
  vehicleId: number,
  payload: RepairScopePayload & {
    relationshipType: 'owner' | 'user' | 'contact';
    evidenceRef: string;
    expectedVehicleVersion: number;
  },
) {
  return http.post(`/repair-shop/vehicles/${vehicleId}/customer-links`, payload);
}

export function closeRepairVehicleCustomerLink(
  vehicleId: number,
  linkId: number,
  payload: { expectedVehicleVersion: number; evidenceRef: string },
) {
  return http.patch(`/repair-shop/vehicles/${vehicleId}/customer-links/${linkId}/close`, payload);
}

export function attachRepairWorkOrder(
  workOrderId: string | number,
  payload: RepairScopePayload & { vehicleId: number; scopeResolutionEvidenceRef: string },
) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/profile`, payload);
}

export interface PrequoteSelection extends RepairScopePayload { vehicleId: number }
export interface PrequoteAdmissionRequest extends PrequoteSelection {
  requestId: string;
  expectedRevision: number;
  expectedAuthorityHash: string;
  scopeResolutionEvidenceRef: string;
}
export function getRepairPrequoteReadiness(workOrderId: string | number, params: PrequoteSelection) {
  return http.get(`/repair-shop/work-orders/${workOrderId}/prequote-readiness`, { params });
}
export function admitRepairPrequote(workOrderId: string | number, payload: PrequoteAdmissionRequest) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/prequote-admission`, payload);
}

export function createRepairDocument(
  workOrderId: string | number,
  payload: {
    documentType: RepairDocumentType;
    expectedProfileVersion: number;
    summary: string;
    payload: Record<string, unknown>;
    sourceReferences?: Array<Record<string, unknown>>;
    generatedBy?: 'human' | 'ai';
    ownerProposalSource?: OwnerProposalDocumentInput;
  },
) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/documents`, payload);
}

export function reviewRepairDocument(
  workOrderId: string | number,
  documentId: number,
  payload: { expectedProfileVersion: number; decision: 'approved' | 'rejected'; reviewNote: string },
) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/documents/${documentId}/review`, payload);
}

export function createRepairConfirmationRequest(
  workOrderId: string | number,
  payload: Record<string, unknown>,
) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/confirmation-requests`, payload);
}

export function recordRepairConfirmationDecision(
  workOrderId: string | number,
  requestId: number,
  payload: Record<string, unknown>,
) {
  return http.post(
    `/repair-shop/work-orders/${workOrderId}/confirmation-requests/${requestId}/decision`,
    payload,
  );
}

export function createRepairTask(workOrderId: string | number, payload: Record<string, unknown>) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/tasks`, payload);
}

export function updateRepairTaskStatus(
  workOrderId: string | number,
  taskId: number,
  payload: Record<string, unknown>,
) {
  return http.patch(`/repair-shop/work-orders/${workOrderId}/tasks/${taskId}/status`, payload);
}

export function createRepairLaborItem(
  workOrderId: string | number,
  payload: Record<string, unknown>,
) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/labor-items`, payload);
}

export function createRepairPartLink(
  workOrderId: string | number,
  payload: Record<string, unknown>,
) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/part-links`, payload);
}

export function createRepairQualityInspection(
  workOrderId: string | number,
  payload: Record<string, unknown>,
) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/quality-inspections`, payload);
}

export function createRepairDelivery(
  workOrderId: string | number,
  payload: Record<string, unknown>,
) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/delivery`, payload);
}

export function createRepairWarranty(
  workOrderId: string | number,
  payload: Record<string, unknown>,
) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/warranties`, payload);
}

export function createRepairAiDraft(
  workOrderId: string | number,
  payload: Record<string, unknown>,
) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/ai-drafts`, payload);
}

export function transitionRepairLifecycle(
  workOrderId: string | number,
  payload: {
    expectedProfileVersion: number;
    targetStatus: 'suspended' | 'cancelled' | 'closed' | 'resume';
    reason: string;
  },
) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/transition`, payload);
}

export function getRepairKnowledge(params?: { query?: string; referenceType?: string }) {
  return http.get('/repair-shop/knowledge-references', { params });
}

export function getRepairProcurementWorkspace(workOrderId: string | number) {
  return http.get(`/repair-shop/work-orders/${workOrderId}/procurement/workspace`);
}

export function createRepairVehicleIdentityEvidence(vehicleId: number, payload: Record<string, unknown>) {
  return http.post(`/repair-shop/vehicles/${vehicleId}/identity-evidence`, payload);
}

export function reviewRepairVehicleIdentityEvidence(
  vehicleId: number,
  evidenceId: number,
  payload: Record<string, unknown>,
) {
  return http.post(`/repair-shop/vehicles/${vehicleId}/identity-evidence/${evidenceId}/review`, payload);
}

export function createRepairFitmentEvidence(workOrderId: string | number, payload: Record<string, unknown>) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/procurement/fitment-evidence`, payload);
}

export function reviewRepairFitmentEvidence(
  workOrderId: string | number,
  evidenceId: number,
  payload: Record<string, unknown>,
) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/procurement/fitment-evidence/${evidenceId}/review`, payload);
}

export function createRepairProcurementDemand(workOrderId: string | number, payload: Record<string, unknown>) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/procurement/demands`, payload);
}

export function checkRepairProcurementInventory(
  workOrderId: string | number,
  demandId: number,
  expectedVersion: number,
) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/procurement/demands/${demandId}/inventory-check`, { expectedVersion });
}

export function createRepairSupplierInquiries(
  workOrderId: string | number,
  demandId: number,
  payload: Record<string, unknown>,
) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/procurement/demands/${demandId}/inquiries`, payload);
}

export function recordRepairSupplierQuote(
  workOrderId: string | number,
  inquiryId: number,
  payload: Record<string, unknown>,
) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/procurement/inquiries/${inquiryId}/quotes`, payload);
}

export function requestRepairProcurementLeaderApproval(
  workOrderId: string | number,
  demandId: number,
  payload: { selectedQuoteId: number; reason: string },
) {
  return http.post(
    `/repair-shop/work-orders/${workOrderId}/procurement/demands/${demandId}/leader-approval-requests`,
    payload,
  );
}

export function createRepairProcurementDecision(
  workOrderId: string | number,
  demandId: number,
  payload: Record<string, unknown>,
) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/procurement/demands/${demandId}/decisions`, payload);
}

export function refreshRepairProcurementDecision(
  workOrderId: string | number,
  decisionId: number,
  expectedVersion: number,
) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/procurement/decisions/${decisionId}/refresh`, { expectedVersion });
}

export function createRepairPurchaseOrder(workOrderId: string | number, payload: Record<string, unknown>) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/procurement/purchase-orders`, payload);
}

export function issueRepairPurchaseOrder(
  workOrderId: string | number,
  orderId: number,
  payload: Record<string, unknown>,
) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/procurement/purchase-orders/${orderId}/issue`, payload);
}

export function bindRepairPurchasePaymentIntent(
  workOrderId: string | number,
  orderId: number,
  payload: Record<string, unknown>,
) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/procurement/purchase-orders/${orderId}/payment-intent`, payload);
}

export function refreshRepairPurchasePaymentState(
  workOrderId: string | number,
  orderId: number,
  expectedVersion: number,
) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/procurement/purchase-orders/${orderId}/payment-state/refresh`, { expectedVersion });
}

export function recordRepairSupplierShipment(
  workOrderId: string | number,
  orderId: number,
  payload: Record<string, unknown>,
) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/procurement/purchase-orders/${orderId}/shipments`, payload);
}

export function recordRepairGoodsReceipt(
  workOrderId: string | number,
  orderId: number,
  payload: Record<string, unknown>,
) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/procurement/purchase-orders/${orderId}/receipts`, payload);
}

export function bindRepairProcurementAllocation(
  workOrderId: string | number,
  receiptId: number,
  payload: Record<string, unknown>,
) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/procurement/receipts/${receiptId}/allocations`, payload);
}

export function markRepairProcurementInstalled(
  workOrderId: string | number,
  allocationId: number,
  payload: Record<string, unknown>,
) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/procurement/allocations/${allocationId}/install`, payload);
}

export function createRepairSupplierWarrantyClaim(
  workOrderId: string | number,
  payload: Record<string, unknown>,
) {
  return http.post(`/repair-shop/work-orders/${workOrderId}/procurement/warranty-claims`, payload);
}
