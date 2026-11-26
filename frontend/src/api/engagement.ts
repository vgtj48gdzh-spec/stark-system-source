import http from './http';

export function createPlatformContent(payload: Record<string, unknown>) {
  return http.post('/engagement/platform-contents', payload);
}

export function getPlatformContents(params?: Record<string, unknown>) {
  return http.get('/engagement/platform-contents', { params });
}

export function getPlatformContent(id: number) {
  return http.get(`/engagement/platform-contents/${id}`);
}

export function createPlatformInteraction(payload: Record<string, unknown>) {
  return http.post('/engagement/platform-interactions', payload);
}

export function getPlatformInteractions(params?: Record<string, unknown>) {
  return http.get('/engagement/platform-interactions', { params });
}

export function getPlatformInteraction(id: number) {
  return http.get(`/engagement/platform-interactions/${id}`);
}

export function createMemoryEntry(payload: Record<string, unknown>) {
  return http.post('/engagement/memories', payload);
}

export function getMemoryEntries(params?: Record<string, unknown>) {
  return http.get('/engagement/memories', { params });
}

export function getMemoryEntry(id: number) {
  return http.get(`/engagement/memories/${id}`);
}

export function updateMemoryEntry(id: number, payload: Record<string, unknown>) {
  return http.patch(`/engagement/memories/${id}`, payload);
}

export function deactivateMemoryEntry(id: number, payload: Record<string, unknown>) {
  return http.post(`/engagement/memories/${id}/deactivate`, payload);
}

export function createInteractionLink(payload: Record<string, unknown>) {
  return http.post('/engagement/interaction-links', payload);
}

export function getInteractionLinks(params?: Record<string, unknown>) {
  return http.get('/engagement/interaction-links', { params });
}

export function createAiRecommendation(payload: Record<string, unknown>) {
  return http.post('/engagement/ai-recommendations', payload);
}

export function getAiRecommendations(params?: Record<string, unknown>) {
  return http.get('/engagement/ai-recommendations', { params });
}

export function getAiRecommendation(id: number) {
  return http.get(`/engagement/ai-recommendations/${id}`);
}

export function getRecommendationRules(params?: Record<string, unknown>) {
  return http.get('/engagement/recommendation-rules', { params });
}

export function createRecommendationRule(payload: Record<string, unknown>) {
  return http.post('/engagement/recommendation-rules', payload);
}

export function updateRecommendationRule(id: number, payload: Record<string, unknown>) {
  return http.patch(`/engagement/recommendation-rules/${id}`, payload);
}

export function toggleRecommendationRule(id: number, payload: Record<string, unknown>) {
  return http.post(`/engagement/recommendation-rules/${id}/toggle`, payload);
}

export function getScriptTemplates(params?: Record<string, unknown>) {
  return http.get('/engagement/script-templates', { params });
}

export function createScriptTemplate(payload: Record<string, unknown>) {
  return http.post('/engagement/script-templates', payload);
}

export function updateScriptTemplate(id: number, payload: Record<string, unknown>) {
  return http.patch(`/engagement/script-templates/${id}`, payload);
}

export function toggleScriptTemplate(id: number, payload: Record<string, unknown>) {
  return http.post(`/engagement/script-templates/${id}/toggle`, payload);
}

export function getScriptExperiments(params?: Record<string, unknown>) {
  return http.get('/engagement/script-experiments', { params });
}

export function createScriptExperiment(payload: Record<string, unknown>) {
  return http.post('/engagement/script-experiments', payload);
}

export function getScriptExperiment(id: number) {
  return http.get(`/engagement/script-experiments/${id}`);
}

export function getFollowupFeedback(params?: Record<string, unknown>) {
  return http.get('/engagement/followup-feedback', { params });
}

export function createFollowupFeedback(payload: Record<string, unknown>) {
  return http.post('/engagement/followup-feedback', payload);
}

export function getFollowupFeedbackById(id: number) {
  return http.get(`/engagement/followup-feedback/${id}`);
}

export function getExecutionPlaybooks(params?: Record<string, unknown>) {
  return http.get('/engagement/execution-playbooks', { params });
}

export function createExecutionPlaybook(payload: Record<string, unknown>) {
  return http.post('/engagement/execution-playbooks', payload);
}

export function updateExecutionPlaybook(id: number, payload: Record<string, unknown>) {
  return http.patch(`/engagement/execution-playbooks/${id}`, payload);
}

export function toggleExecutionPlaybook(id: number, payload: Record<string, unknown>) {
  return http.post(`/engagement/execution-playbooks/${id}/toggle`, payload);
}

export function getExecutionTasks(params?: Record<string, unknown>) {
  return http.get('/engagement/execution-tasks', { params });
}

export function createExecutionTask(payload: Record<string, unknown>) {
  return http.post('/engagement/execution-tasks', payload);
}

export function getExecutionTask(id: number) {
  return http.get(`/engagement/execution-tasks/${id}`);
}

export function confirmExecutionTask(id: number, payload: Record<string, unknown> = {}) {
  return http.post(`/engagement/execution-tasks/${id}/confirm`, payload);
}

export function closeExecutionTask(id: number, payload: Record<string, unknown> = {}) {
  return http.post(`/engagement/execution-tasks/${id}/close`, payload);
}

export function getExecutionTaskItems(params?: Record<string, unknown>) {
  return http.get('/engagement/execution-task-items', { params });
}

export function confirmExecutionTaskItem(id: number, payload: Record<string, unknown> = {}) {
  return http.post(`/engagement/execution-task-items/${id}/confirm`, payload);
}

export function skipExecutionTaskItem(id: number, payload: Record<string, unknown> = {}) {
  return http.post(`/engagement/execution-task-items/${id}/skip`, payload);
}

export function getExecutionResults(params?: Record<string, unknown>) {
  return http.get('/engagement/execution-results', { params });
}

export function getExecutionResultsSummary(params?: Record<string, unknown>) {
  return http.get('/engagement/execution-results/summary', { params });
}

export function createExecutionResult(payload: Record<string, unknown>) {
  return http.post('/engagement/execution-results', payload);
}

export function getExecutionResult(id: number) {
  return http.get(`/engagement/execution-results/${id}`);
}

export function generateLeadCandidates(payload: Record<string, unknown>) {
  return http.post('/engagement/lead-candidates/generate', payload);
}

export function getLeadCandidates(params?: Record<string, unknown>) {
  return http.get('/engagement/lead-candidates', { params });
}

export function getLeadCandidate(id: number) {
  return http.get(`/engagement/lead-candidates/${id}`);
}

export function generateAttributions(payload: Record<string, unknown>) {
  return http.post('/engagement/attributions/generate', payload);
}

export function getAttributions(params?: Record<string, unknown>) {
  return http.get('/engagement/attributions', { params });
}

export function getAttribution(id: number) {
  return http.get(`/engagement/attributions/${id}`);
}

export function confirmAttribution(id: number, payload: Record<string, unknown>) {
  return http.post(`/engagement/attributions/${id}/confirm`, payload);
}

export function rejectAttribution(id: number, payload: Record<string, unknown>) {
  return http.post(`/engagement/attributions/${id}/reject`, payload);
}

export function reassignAttribution(id: number, payload: Record<string, unknown>) {
  return http.post(`/engagement/attributions/${id}/reassign`, payload);
}

export function getCustomerProfiles(params?: Record<string, unknown>) {
  return http.get('/engagement/profiles/customers', { params });
}

export function getCustomerProfile(id: number) {
  return http.get(`/engagement/profiles/customers/${id}`);
}

export function getEmployeeProfiles(params?: Record<string, unknown>) {
  return http.get('/engagement/profiles/employees', { params });
}

export function getEmployeeProfile(id: number) {
  return http.get(`/engagement/profiles/employees/${id}`);
}

export function getFollowupSuggestions(params?: Record<string, unknown>) {
  return http.get('/engagement/followup-suggestions', { params });
}

export function getFollowupSuggestion(id: number) {
  return http.get(`/engagement/followup-suggestions/${id}`);
}

export function createPlatformImportBatch(payload: {
  sourcePlatform: string;
  accountId?: string;
  importType: string;
  connectorConfigId?: number;
  triggerLeadGeneration?: boolean;
  triggerAttributionGeneration?: boolean;
  syncLeadMemories?: boolean;
  remark?: string;
  file: File;
}) {
  const formData = new FormData();
  formData.append('sourcePlatform', payload.sourcePlatform);
  formData.append('importType', payload.importType);
  formData.append('file', payload.file);

  if (payload.accountId) formData.append('accountId', payload.accountId);
  if (payload.connectorConfigId != null) {
    formData.append('connectorConfigId', String(payload.connectorConfigId));
  }
  if (payload.triggerLeadGeneration != null) {
    formData.append('triggerLeadGeneration', String(payload.triggerLeadGeneration));
  }
  if (payload.triggerAttributionGeneration != null) {
    formData.append('triggerAttributionGeneration', String(payload.triggerAttributionGeneration));
  }
  if (payload.syncLeadMemories != null) {
    formData.append('syncLeadMemories', String(payload.syncLeadMemories));
  }
  if (payload.remark) formData.append('remark', payload.remark);

  return http.post('/engagement/import-batches', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export function getPlatformImportBatches(params?: Record<string, unknown>) {
  return http.get('/engagement/import-batches', { params });
}

export function getPlatformImportBatch(id: number) {
  return http.get(`/engagement/import-batches/${id}`);
}

export function getPlatformImportRecords(params?: Record<string, unknown>) {
  return http.get('/engagement/import-records', { params });
}

export function getPlatformImportRecord(id: number) {
  return http.get(`/engagement/import-records/${id}`);
}

export function createPlatformLeadEntry(payload: Record<string, unknown>) {
  return http.post('/engagement/platform-leads', payload);
}

export function getPlatformLeads(params?: Record<string, unknown>) {
  return http.get('/engagement/platform-leads', { params });
}

export function getPlatformLead(id: number) {
  return http.get(`/engagement/platform-leads/${id}`);
}

export function getPlatformConnectorConfigs(params?: Record<string, unknown>) {
  return http.get('/engagement/connector-configs', { params });
}

export function createPlatformConnectorConfig(payload: Record<string, unknown>) {
  return http.post('/engagement/connector-configs', payload);
}

export function updatePlatformConnectorConfig(id: number, payload: Record<string, unknown>) {
  return http.patch(`/engagement/connector-configs/${id}`, payload);
}
