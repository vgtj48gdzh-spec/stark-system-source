import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedFinanceBankSmsRbac00381745163100000
  implements MigrationInterface
{
  name = 'SeedFinanceBankSmsRbac00381745163100000';
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT IGNORE INTO roles (name, code, description) VALUES
      ('超级管理员', 'super_admin', '银行短信对账与高风险财务确认'),
      ('老板', 'owner', '银行短信对账结果与最终财务确认'),
      ('财务经理', 'finance_manager', '银行短信对账、建议匹配与人工确认'),
      ('财务专员', 'finance_operator', '银行短信对账执行与人工核对'),
      ('审计员', 'auditor', '只读查看银行短信对账结果');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {

    await queryRunner.query(`
      DELETE FROM roles
      WHERE code IN ('super_admin', 'owner', 'finance_manager', 'finance_operator', 'auditor');
    `);
  }
}
