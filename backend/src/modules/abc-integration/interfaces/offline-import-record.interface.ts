export interface OfflineImportRecord {
  sourceId: string;
  sourceOrderNo?: string | null;
  sourceUpdatedAt?: Date | null;
  rawPayload: Record<string, unknown>;
}
