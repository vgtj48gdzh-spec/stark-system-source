import { IsIn, IsString, Matches } from 'class-validator';

const HASH = /^[0-9a-f]{64}$/;

export const COLLECTION_CONFIRMATION_REASON_CODES = [
  'repair_bank_collection_confirmed',
] as const;
export type CollectionConfirmationReasonCode = (typeof COLLECTION_CONFIRMATION_REASON_CODES)[number];

/**
 * Formal collection-order confirmation request. The caller may only supply the
 * server-generated expected evidence fingerprint and a controlled reason code;
 * no free text, amounts, times or source ids are accepted.
 */
export class ConfirmCollectionOrderDto {
  @IsString()
  @Matches(HASH)
  expectedEvidenceFingerprint!: string;

  @IsIn(COLLECTION_CONFIRMATION_REASON_CODES)
  reasonCode!: CollectionConfirmationReasonCode;
}
