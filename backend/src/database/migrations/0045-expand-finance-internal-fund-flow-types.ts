import { MigrationInterface, QueryRunner } from 'typeorm';

const INTERNAL_FUND_FLOW_TYPES = [
  'loan_interest_expense',
  'internal_transfer_in',
  'internal_transfer_out',
  'loan_in',
  'loan_out',
  'repayment_in',
  'repayment_out',
];

export class ExpandFinanceInternalFundFlowTypes00451750812800000
  implements MigrationInterface
{
  name = 'ExpandFinanceInternalFundFlowTypes00451750812800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE finance_reconciliation_link
      MODIFY link_type ENUM('receipt_item', 'approval_order', 'manual_fee', 'wechat_settlement_batch', 'internal_fund_flow', 'receivable_tracking', 'ignore') NOT NULL
    `);

    if (await queryRunner.hasTable('finance_internal_fund_flow')) {
      await queryRunner.query(`
        ALTER TABLE finance_internal_fund_flow
        MODIFY flow_type ENUM('${INTERNAL_FUND_FLOW_TYPES.join("','")}') NOT NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('finance_internal_fund_flow')) {
      const unsupportedRows = await queryRunner.query(`
        SELECT COUNT(*) AS count
        FROM finance_internal_fund_flow
        WHERE flow_type <> 'loan_interest_expense'
      `);
      const unsupportedCount = Number(unsupportedRows?.[0]?.count ?? 0);
      if (unsupportedCount > 0) {
        throw new Error(
          'Cannot narrow finance_internal_fund_flow.flow_type while non-loan-interest rows exist.',
        );
      }

      await queryRunner.query(`
        ALTER TABLE finance_internal_fund_flow
        MODIFY flow_type ENUM('loan_interest_expense') NOT NULL
      `);
    }
  }
}
