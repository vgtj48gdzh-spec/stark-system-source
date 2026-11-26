import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedRbacDevData1710800001000 implements MigrationInterface {
  public transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT IGNORE INTO roles (name, code, description) VALUES
      ('系统管理员', 'admin', '拥有全部权限'),
      ('操作员', 'operator', '创建和修改工单、提交审批'),
      ('审批人', 'approver', '审批付款申请'),
      ('财务', 'finance', '登记收款和付款');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {

    await queryRunner.query(`
      DELETE FROM roles
      WHERE code IN ('admin', 'operator', 'approver', 'finance');
    `);
  }
}
