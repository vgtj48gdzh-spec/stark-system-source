import { IsIn } from 'class-validator';

export const WORK_ORDER_CONTACT_ACCESS_REASON_CODES = [
  'customer_callback',
  'appointment_coordination',
  'after_sales_follow_up',
  'owner_review',
] as const;

export type WorkOrderContactAccessReasonCode =
  (typeof WORK_ORDER_CONTACT_ACCESS_REASON_CODES)[number];

export class AccessWorkOrderCustomerContactDto {
  @IsIn(WORK_ORDER_CONTACT_ACCESS_REASON_CODES)
  reasonCode!: WorkOrderContactAccessReasonCode;
}
