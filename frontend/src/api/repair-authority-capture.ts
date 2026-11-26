import http from './http';
import type { CaptureAction, CaptureFamily, CaptureSnapshot } from '../utils/repair-authority-capture';

const config = { headers: { 'x-suppress-global-error': '1' } };
export async function readRepairAuthorityCapture(workOrderId: string, family: CaptureFamily): Promise<CaptureSnapshot> {
  const response = await http.get(`/repair-shop/work-orders/${encodeURIComponent(workOrderId)}/authority-capture/${family}`, config);
  return response.data.data;
}
export async function executeRepairAuthorityCapture(action: CaptureAction, command: Readonly<Record<string, unknown>>): Promise<void> {
  // Deliberately no auto-retry, logging, receipt persistence or downstream call.
  await http.post(`/repair-shop/authority-capture/${action}`, { command }, config);
}
